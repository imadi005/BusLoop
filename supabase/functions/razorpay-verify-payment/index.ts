const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentOrder = {
  id: string;
  passenger_id: string;
  trip_id: string;
  route_id: string;
  from_stop_id: string;
  to_stop_id: string;
  amount: number | string;
  amount_paise: number;
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  ticket_id?: string | null;
  status: 'created' | 'paid' | 'failed' | 'cancelled';
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('Supabase function env is not configured');
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function timeoutSignal(timeoutMs = 20000) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Supabase function env is not configured');

  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    signal: timeoutSignal(15000),
    headers: serviceHeaders((init.headers || {}) as Record<string, string>),
  });
}

async function readJsonArray<T>(path: string) {
  const res = await supabaseRest(path, { method: 'GET' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || 'Database request failed');
  return Array.isArray(body) ? body as T[] : [];
}

async function requireCapturedPayment(paymentId: string, orderId: string, expectedAmountPaise: number) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) throw new Error('Razorpay env is not configured');

  const credentials = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    signal: timeoutSignal(20000),
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error('Could not verify payment with Razorpay');

  const payment = await res.json();
  if (payment.order_id !== orderId) throw new Error('Payment does not match this order');
  if (payment.status !== 'captured') throw new Error('Payment is not captured');
  if (Number(payment.amount) !== expectedAmountPaise) throw new Error('Payment amount mismatch');
  if (payment.currency && payment.currency !== 'INR') throw new Error('Payment currency mismatch');
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !serviceKey) throw new Error('Supabase function env is not configured');
  if (!authHeader) throw new Error('Missing user session');

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    signal: timeoutSignal(15000),
    headers: { Authorization: authHeader, apikey: serviceKey },
  });
  if (!res.ok) throw new Error('Invalid user session');
  return res.json();
}

async function requirePassenger(userId: string) {
  const rows = await readJsonArray<{ id: string }>(`users?id=eq.${userId}&role=eq.passenger&select=id&limit=1`);
  if (!rows[0]) throw new Error('Only passenger accounts can verify ticket payments');
}

async function getPaymentOrder(orderId: string, passengerId: string) {
  const rows = await readJsonArray<PaymentOrder>(
    `payment_orders?razorpay_order_id=eq.${orderId}&passenger_id=eq.${passengerId}&select=*&limit=1`,
  );
  if (!rows[0]) throw new Error('Payment order not found');
  return rows[0];
}

async function getTicketByOrder(orderId: string) {
  const rows = await readJsonArray(
    `tickets?razorpay_order_id=eq.${orderId}&select=*,routes(name),from_stop:stops!tickets_from_stop_id_fkey(name),to_stop:stops!tickets_to_stop_id_fkey(name),trips(id,buses(name,registration_no))&limit=1`,
  );
  return rows[0] || null;
}

function formatTicket(ticket: any) {
  return {
    ...ticket,
    amount_paid: ticket.amount,
    route_name: ticket.routes?.name || 'Bus Ticket',
    bus_name: ticket.trips?.buses?.name || 'Bus',
    from_stop_name: ticket.from_stop?.name || null,
    to_stop_name: ticket.to_stop?.name || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await requireUser(req);
    await requirePassenger(user.id);

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) throw new Error('Razorpay env is not configured');

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing payment verification fields' }, 400);
    }

    const paymentOrder = await getPaymentOrder(razorpay_order_id, user.id);
    if (paymentOrder.status === 'paid') {
      const existing = await getTicketByOrder(razorpay_order_id);
      if (existing) return json({ ticket: formatTicket(existing), reused: true });
    }

    const expected = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) return json({ error: 'Payment signature verification failed' }, 400);

    await requireCapturedPayment(
      razorpay_payment_id,
      razorpay_order_id,
      Number(paymentOrder.amount_paise),
    );

    const existing = await getTicketByOrder(razorpay_order_id);
    if (existing) return json({ ticket: formatTicket(existing), reused: true });

    const ticketPayload = {
      passenger_id: user.id,
      trip_id: paymentOrder.trip_id,
      route_id: paymentOrder.route_id,
      from_stop_id: paymentOrder.from_stop_id,
      to_stop_id: paymentOrder.to_stop_id,
      amount: Number(paymentOrder.amount),
      status: 'active',
      razorpay_order_id,
      razorpay_payment_id,
    };

    const ticketRes = await supabaseRest(
      'tickets?select=*,routes(name),from_stop:stops!tickets_from_stop_id_fkey(name),to_stop:stops!tickets_to_stop_id_fkey(name),trips(id,buses(name,registration_no))',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(ticketPayload),
      },
    );

    const ticketBody = await ticketRes.json().catch(() => null);
    if (!ticketRes.ok) {
      const duplicate = await getTicketByOrder(razorpay_order_id);
      if (duplicate) return json({ ticket: formatTicket(duplicate), reused: true });
      return json({ error: ticketBody?.message || 'Could not create ticket' }, 400);
    }

    const ticket = Array.isArray(ticketBody) ? ticketBody[0] : ticketBody;
    await supabaseRest(`payment_orders?id=eq.${paymentOrder.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'paid',
        razorpay_payment_id,
        ticket_id: ticket.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    return json({ ticket: formatTicket(ticket) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Payment verification failed' }, 400);
  }
});
