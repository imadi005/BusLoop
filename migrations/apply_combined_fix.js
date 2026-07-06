const https = require('https');

const PROJECT_REF = 'qsmmstpkidrmecevtrwv';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run with an embedded secret.');
  process.exit(1);
}

const STATEMENTS = [
  // PART 1: Add columns
  `ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS from_location TEXT, ADD COLUMN IF NOT EXISTS to_location TEXT`,
  `COMMENT ON COLUMN public.trips.from_location IS 'Driver-entered origin name (e.g. Kothanur)'`,
  `COMMENT ON COLUMN public.trips.to_location IS 'Driver-entered destination name (e.g. Bangalore Airport)'`,

  // PART 2: Fix FK
  `ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_driver_id_fkey`,
  `ALTER TABLE public.trips ALTER COLUMN driver_id DROP NOT NULL`,
  `ALTER TABLE public.trips ADD CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.staff(id) ON DELETE SET NULL`,

  // PART 3: Fix Trips RLS Policies
  `DROP POLICY IF EXISTS "Drivers can manage own trips" ON public.trips`,
  `DROP POLICY IF EXISTS "Operators can view all trips" ON public.trips`,
  `DROP POLICY IF EXISTS "Anyone can view active trips" ON public.trips`,
  `DROP POLICY IF EXISTS "Staff can manage own trips" ON public.trips`,
  `DROP POLICY IF EXISTS "Operators can manage all trips" ON public.trips`,

  `CREATE POLICY "Anyone can view active trips" ON public.trips FOR SELECT USING (status = 'active')`,
  `CREATE POLICY "Staff can manage own trips" ON public.trips FOR ALL USING (auth.uid() = driver_id)`,
  `CREATE POLICY "Operators can manage all trips" ON public.trips FOR ALL USING (EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')))`,

  // PART 4: Fix Locations RLS Policies
  `DROP POLICY IF EXISTS "Drivers can insert own trip locations" ON public.locations`,
  `DROP POLICY IF EXISTS "Staff can insert trip locations" ON public.locations`,

  `CREATE POLICY "Staff can insert trip locations" ON public.locations FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND driver_id = auth.uid()))`,

  // PART 5: Realtime
  `DO $$
  BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END;
  $$`
];

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runMigration() {
  console.log('ðŸš€ BusNow â€” Applying 007 combined fix statements to Supabase...\n');
  let ok = 0;
  let fail = 0;

  for (const sql of STATEMENTS) {
    const label = sql.trim().split('\n')[0].substring(0, 70);
    try {
      // 1. Try exec_sql (with { query: sql })
      let res = await makeRequest('/rest/v1/rpc/exec_sql', 'POST', { query: sql });
      if (res.status < 300) {
        console.log(`  âœ… ${label}`);
        ok++;
      } else {
        // 2. Try exec (with { sql })
        let res2 = await makeRequest('/rest/v1/rpc/exec', 'POST', { sql });
        if (res2.status < 300) {
          console.log(`  âœ… ${label} (via exec)`);
          ok++;
        } else {
          console.warn(`  âš ï¸  ${label}\n     Failed with status ${res.status}: ${res.body.substring(0, 100)}`);
          fail++;
        }
      }
    } catch (e) {
      console.error(`  âŒ ${label}\n     Error: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${ok > 0 && fail === 0 ? 'âœ…' : 'âš ï¸'} Done â€” ${ok} OK, ${fail} failed.`);
  if (fail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMigration();

