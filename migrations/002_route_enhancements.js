// BusNow Migration 002 â€” Route Enhancements + Smart Presets
// Run: node migrations/002_route_enhancements.js

const https = require('https');

const PROJECT_REF = 'qsmmstpkidrmecevtrwv';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run with an embedded secret.');
  process.exit(1);
}

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

// Each statement separately so we can log individual results
const STATEMENTS = [
  // 1. Add origin / destination / notes / search_keywords to routes
  `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS origin TEXT`,
  `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS destination TEXT`,
  `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS landmarks TEXT`,
  `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS search_keywords TEXT`,

  // 2. Add landmark_type to stops so we can distinguish stops vs landmarks
  `ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS stop_type TEXT NOT NULL DEFAULT 'stop' CHECK (stop_type IN ('stop','landmark'))`,

  // 3. Create route_presets table for smart presets
  `CREATE TABLE IF NOT EXISTS public.route_presets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type         TEXT NOT NULL CHECK (type IN ('location','stop','landmark','keyword')),
    label        TEXT NOT NULL,
    lat          DECIMAL(10,8),
    lng          DECIMAL(11,8),
    use_count    INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 4. RLS for route_presets â€” anyone can read, operators can manage
  `ALTER TABLE public.route_presets ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='route_presets' AND policyname='Anyone can view presets') THEN
      CREATE POLICY "Anyone can view presets" ON public.route_presets FOR SELECT USING (TRUE);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='route_presets' AND policyname='Operators manage presets') THEN
      CREATE POLICY "Operators manage presets" ON public.route_presets FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin','driver'))
      );
    END IF;
  END $$`,

  // 5. Index on presets
  `CREATE INDEX IF NOT EXISTS route_presets_type_idx ON public.route_presets(type)`,
  `CREATE INDEX IF NOT EXISTS route_presets_label_idx ON public.route_presets USING gin(to_tsvector('english', label))`,

  // 6. Enable realtime for route_presets
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='route_presets') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.route_presets;
    END IF;
  END $$`,

  // 7. Seed existing routes with origin/destination from name
  `UPDATE public.routes
   SET
     origin = CASE id
       WHEN '11111111-0000-0000-0000-000000000001' THEN 'City Center'
       WHEN '11111111-0000-0000-0000-000000000002' THEN 'Main Gate'
       WHEN '11111111-0000-0000-0000-000000000003' THEN 'North Terminal'
       ELSE NULL
     END,
     destination = CASE id
       WHEN '11111111-0000-0000-0000-000000000001' THEN 'Airport Terminal'
       WHEN '11111111-0000-0000-0000-000000000002' THEN 'Main Gate'
       WHEN '11111111-0000-0000-0000-000000000003' THEN 'South Terminal'
       ELSE NULL
     END,
     landmarks = CASE id
       WHEN '11111111-0000-0000-0000-000000000001' THEN 'Nagaraesh Lake, Hennur Basavur Road'
       WHEN '11111111-0000-0000-0000-000000000002' THEN 'Library Block, Sports Complex'
       WHEN '11111111-0000-0000-0000-000000000003' THEN 'Central Park, City Mall'
       ELSE NULL
     END,
     notes = CASE id
       WHEN '11111111-0000-0000-0000-000000000001' THEN 'Express route â€” no stops between Kannuru Junction and Airport'
       WHEN '11111111-0000-0000-0000-000000000002' THEN 'Circular route â€” runs every 15 minutes on weekdays'
       WHEN '11111111-0000-0000-0000-000000000003' THEN 'Limited stops â€” only at designated express stops'
       ELSE NULL
     END,
     search_keywords = CASE id
       WHEN '11111111-0000-0000-0000-000000000001' THEN 'airport shuttle, city center, terminal, kannuru'
       WHEN '11111111-0000-0000-0000-000000000002' THEN 'university, campus, library, hostel, sports'
       WHEN '11111111-0000-0000-0000-000000000003' THEN 'express, north, south, city mall, central park'
       ELSE NULL
     END
   WHERE id IN (
     '11111111-0000-0000-0000-000000000001',
     '11111111-0000-0000-0000-000000000002',
     '11111111-0000-0000-0000-000000000003'
   )`,

  // 8. Seed some starter presets
  `INSERT INTO public.route_presets (type, label, lat, lng, use_count) VALUES
    ('location', 'City Center',        13.05500, 77.61000, 5),
    ('location', 'Airport Terminal',   13.02000, 77.63500, 5),
    ('location', 'Main Gate',          13.04200, 77.61800, 3),
    ('location', 'Library Block',      13.04300, 77.61600, 2),
    ('location', 'Hostel Block',       13.04400, 77.61400, 2),
    ('location', 'Sports Complex',     13.04500, 77.61300, 2),
    ('stop',     'City Center',        13.05500, 77.61000, 5),
    ('stop',     'Airport Terminal',   13.02000, 77.63500, 5),
    ('stop',     'Kannuru Junction',   13.04800, 77.61500, 4),
    ('landmark', 'Nagaraesh Lake',     13.04200, 77.62000, 3),
    ('landmark', 'Central Park',       13.0460,  77.6200,  2),
    ('keyword',  'airport',            NULL,      NULL,     5),
    ('keyword',  'university',         NULL,      NULL,     4),
    ('keyword',  'express',            NULL,      NULL,     3)
  ON CONFLICT DO NOTHING`,
];

async function runMigration() {
  console.log('ðŸš€ BusNow Migration 002 â€” Route Enhancements\n');
  let ok = 0;
  let fail = 0;

  for (const sql of STATEMENTS) {
    const label = sql.trim().split('\n')[0].substring(0, 70);
    try {
      const res = await makeRequest('/rest/v1/rpc/exec_sql', 'POST', { query: sql });
      if (res.status < 300) {
        console.log(`  âœ… ${label}`);
        ok++;
      } else {
        // Try alternate endpoint
        const res2 = await makeRequest('/rest/v1/rpc/exec', 'POST', { sql });
        if (res2.status < 300) {
          console.log(`  âœ… ${label} (via exec)`);
          ok++;
        } else {
          console.warn(`  âš ï¸  ${label}\n     ${res.body.substring(0, 100)}`);
          fail++;
        }
      }
    } catch (e) {
      console.error(`  âŒ ${label}\n     ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${ok > 0 ? 'âœ…' : 'âŒ'} Done â€” ${ok} OK, ${fail} failed`);
  if (fail > 0) {
    console.log('\nðŸ“‹ If RPC not available, run this SQL manually:');
    console.log('   https://supabase.com/dashboard/project/qsmmstpkidrmecevtrwv/sql/new');
    console.log('\n--- SQL START ---');
    STATEMENTS.forEach(s => console.log(s + ';\n'));
    console.log('--- SQL END ---');
  }
}

runMigration();

