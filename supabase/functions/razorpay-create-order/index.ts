const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DbTrip = {
  id: string;
  route_id: string | null;
  bus_id: string;
  buses?: {
    id: string;
    name?: string;
    registration_no?: string;
    route_id?: string | null;
    routes?: {
      id: string;
      name?: string;
      base_fare?: number | string | null;
    } | null;
  } | null;
};

type DbStop = { id: string; name?: string; stop_order: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireUuid(value: unknown, label: string) {
  const text = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`Invalid ${label}`);
  }
  return text;
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

async function supabaseRest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Supabase function env is not configured');
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders((init.headers || {}) as Record<string, string>),
  });
}

async function readJsonArray<T>(path: string) {
  const res = await supabaseRest(path, { method: 'GET' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || 'Database request failed');
  return Array.isArray(body) ? body as T[] : [];
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !serviceKey) throw new Error('Supabase function env is not configured');
  if (!authHeader) throw new Error('Missing user session');

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceKey },
  });
  if (!res.ok) throw new Error('Invalid user session');
  return res.json();
}

async function requirePassenger(userId: string) {
  const rows = await readJsonArray<{ id: string }>(`users?id=eq.${userId}&role=eq.passenger&select=id&limit=1`);
  if (!rows[0]) throw new Error('Only passenger accounts can book tickets');
}

async function loadTrip(tripId: string) {
  const select = 'id,route_id,bus_id,buses(id,name,registration_no,route_id,routes(id,name,base_fare))';
  const rows = await readJsonArray<DbTrip>(`trips?id=eq.${tripId}&status=eq.active&select=${select}&limit=1`);
  if (!rows[0]) throw new Error('This bus does not have an active trip');
  return rows[0];
}

async function loadStops(routeId: string, fromStopId: string, toStopId: string) {
  const rows = await readJsonArray<DbStop>(
    `stops?route_id=eq.${routeId}&stop_type=eq.stop&id=in.(${fromStopId},${toStopId})&select=id,name,stop_order&order=stop_order.asc`,
  );
  const fromStop = rows.find((s) => s.id === fromStopId);
  const toStop = rows.find((s) => s.id === toStopId);
  if (!fromStop || !toStop) throw new Error('Selected stops do not belong to this route');
  if (fromStop.id === toStop.id) throw new Error('Pickup and destination cannot be the same');
  if (Number(fromStop.stop_order) >= Number(toStop.stop_order)) {
    throw new Error('Destination must come after pickup on this route');
  }
  return { fromStop, toStop };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await requireUser(req);
    await requirePassenger(user.id);

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) throw new Error('Razorpay env is not configured');

    const body = await req.json();
    const tripId = requireUuid(body.trip_id, 'trip');
    const routeId = requireUuid(body.route_id, 'route');
    const fromStopId = requireUuid(body.from_stop_id, 'pickup stop');
    const toStopId = requireUuid(body.to_stop_id, 'destination stop');

    const trip = await loadTrip(tripId);
    const trustedRouteId = trip.route_id || trip.buses?.route_id || trip.buses?.routes?.id;
    if (trustedRouteId !== routeId) throw new Error('Route does not match active trip');

    const { fromStop, toStop } = await loadStops(routeId, fromStopId, toStopId);
    const amount = Number(trip.buses?.routes?.base_fare ?? 30);
    if (!Number.isFinite(amount) || amount < 1) throw new Error('Route fare is not configured');
    const amountInPaise = Math.round(amount * 100);

    const auth = btoa(`${keyId}:${keySecret}`);
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `BN-${Date.now()}`,
        notes: {
          passenger_id: user.id,
          trip_id: tripId,
          route_id: routeId,
          from_stop_id: fromStopId,
          to_stop_id: toStopId,
        },
      }),
    });

    const order = await orderRes.json();
    if (!orderRes.ok) return json({ error: order?.error?.description || 'Could not create payment order' }, 400);

    const paymentOrderRes = await supabaseRest('payment_orders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        passenger_id: user.id,
        trip_id: tripId,
        route_id: routeId,
        from_stop_id: fromStopId,
        to_stop_id: toStopId,
        amount,
        amount_paise: amountInPaise,
        currency: 'INR',
        razorpay_order_id: order.id,
        status: 'created',
      }),
    });

    if (!paymentOrderRes.ok) {
      const err = await paymentOrderRes.json().catch(() => null);
      return json({ error: err?.message || 'Could not record payment order' }, 400);
    }

    return json({
      order,
      ticket_context: {
        amount,
        bus_name: trip.buses?.name || 'Bus',
        route_name: trip.buses?.routes?.name || 'Bus Ticket',
        from_stop_name: fromStop.name || 'Pickup',
        to_stop_name: toStop.name || 'Destination',
      },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Order creation failed' }, 400);
  }
});
