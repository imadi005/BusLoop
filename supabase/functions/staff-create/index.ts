const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

async function requireCurrentUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase function env is not configured');
  if (!authHeader) throw new Error('Missing staff session');

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceKey },
  });
  if (!res.ok) throw new Error('Invalid staff session');
  return res.json();
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Supabase function env is not configured');
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders((init.headers || {}) as Record<string, string>),
  });
}

async function requireOperator(userId: string) {
  const res = await supabaseRest(
    `staff?id=eq.${userId}&role=in.(operator,super_admin)&is_terminated=eq.false&select=id&limit=1`,
  );
  const rows = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(rows) || !rows[0]) {
    throw new Error('Only active operators can create staff accounts');
  }
}

async function createAuthUser(payload: { email: string; password: string; full_name: string; role: string }) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Supabase function env is not configured');

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name, role: payload.role },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.msg || body?.message || 'Failed to create staff login');
  return body;
}

async function deleteAuthUser(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return;
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let authUserId = '';
  try {
    const currentUser = await requireCurrentUser(req);
    await requireOperator(currentUser.id);

    const body = await req.json();
    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '').trim();
    const phone = String(body.phone || '').trim();
    const employee_id = String(body.employee_id || '').trim();

    if (!full_name) throw new Error('Full name is required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Valid email is required');
    if (password.length < 8) throw new Error('Temporary password must be at least 8 characters');
    if (!['driver', 'checker'].includes(role)) throw new Error('Operators can create only driver or checker accounts');

    const authUser = await createAuthUser({ email, password, full_name, role });
    authUserId = authUser?.id || authUser?.user?.id;
    if (!authUserId) throw new Error('Could not read created auth user id');

    const staffPayload: Record<string, unknown> = {
      id: authUserId,
      full_name,
      email,
      role,
      is_terminated: false,
    };
    if (phone) staffPayload.phone = phone;
    if (employee_id) staffPayload.employee_id = employee_id;

    const staffRes = await supabaseRest('staff?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(staffPayload),
    });
    const staffBody = await staffRes.json().catch(() => null);
    if (!staffRes.ok) {
      await deleteAuthUser(authUserId);
      throw new Error(staffBody?.message || 'Failed to create staff profile');
    }

    return json({ staff: Array.isArray(staffBody) ? staffBody[0] : staffBody });
  } catch (err) {
    if (authUserId) await deleteAuthUser(authUserId);
    return json({ error: err instanceof Error ? err.message : 'Staff creation failed' }, 400);
  }
});
