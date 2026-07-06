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

const staffMembers = [
  { email: 'operator1@busnow.app', name: 'Ravi Operator',  role: 'operator' },
  { email: 'operator2@busnow.app', name: 'Priya Operator', role: 'operator' },
  { email: 'driver1@busnow.app',   name: 'Arun Driver',    role: 'driver' },
  { email: 'driver2@busnow.app',   name: 'Sita Driver',    role: 'driver' },
  { email: 'checker1@busnow.app',  name: 'Mohan Checker',  role: 'checker' },
  { email: 'checker2@busnow.app',  name: 'Lata Checker',   role: 'checker' }
];

async function setupStaff() {
  for (const staff of staffMembers) {
    console.log(`Setting up ${staff.email}...`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: staff.email,
      password: STAFF_DEMO_PASSWORD,
      options: {
        data: { full_name: staff.name }
      }
    });

    let userId = null;
    if (authError && authError.message.includes('already registered')) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: staff.email,
        password: STAFF_DEMO_PASSWORD
      });
      userId = signInData?.user?.id;
      console.log(`  - Existing user found, ID: ${userId}`);
    } else if (authData?.user) {
      userId = authData.user.id;
      console.log(`  - New user created, ID: ${userId}`);
    } else {
      console.error(`  - Failed to create/login:`, authError?.message);
      continue;
    }

    if (userId) {
      // Upsert into public.staff (without is_active)
      const { error: profileError } = await supabase
        .from('staff')
        .upsert({
          id: userId,
          email: staff.email,
          full_name: staff.name,
          role: staff.role
        });
      
      if (profileError) {
        console.error(`  - Profile upsert failed:`, profileError.message);
      } else {
        console.log(`  - Profile created/updated successfully!`);
      }
    }
  }
  console.log("Done!");
}

setupStaff();

