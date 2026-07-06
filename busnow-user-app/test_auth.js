import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const STAFF_DEMO_PASSWORD = process.env.STAFF_DEMO_PASSWORD;

if (!STAFF_DEMO_PASSWORD) {
  throw new Error('Missing STAFF_DEMO_PASSWORD');
}

async function testAuth() {
  const { data, error } = await supabase.auth.signUp({
    email: 'checker1@busnow.app',
    password: STAFF_DEMO_PASSWORD
  });

  console.log("SignUp response:", data, error?.message);
}

testAuth();

