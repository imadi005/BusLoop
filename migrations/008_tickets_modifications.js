const https = require('https');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qsmmstpkidrmecevtrwv';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run migration with an embedded secret.');
  process.exit(1);
}

const STATEMENTS = [
  // 1. Make trip_id nullable in tickets table
  `ALTER TABLE public.tickets ALTER COLUMN trip_id DROP NOT NULL`,

  // 2. Drop legacy direct passenger insert policy. Tickets are created by verified payment functions.
  `DROP POLICY IF EXISTS "Passengers can insert own tickets" ON public.tickets`,

  // 3. Ensure fare amount exists for collection reporting and verified payment tickets
  `ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0`
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
  console.log('🚀 BusNow — Applying 008 tickets modifications to Supabase...\n');
  let ok = 0;
  let fail = 0;

  for (const sql of STATEMENTS) {
    const label = sql.trim().split('\n')[0].substring(0, 70);
    try {
      let res = await makeRequest('/rest/v1/rpc/exec_sql', 'POST', { query: sql });
      if (res.status < 300) {
        console.log(`  ✅ ${label}`);
        ok++;
      } else {
        let res2 = await makeRequest('/rest/v1/rpc/exec', 'POST', { sql });
        if (res2.status < 300) {
          console.log(`  ✅ ${label} (via exec)`);
          ok++;
        } else {
          console.warn(`  ⚠️  ${label}\n     Failed with status ${res.status}: ${res.body.substring(0, 100)}`);
          fail++;
        }
      }
    } catch (e) {
      console.error(`  ❌ ${label}\n     Error: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${ok > 0 && fail === 0 ? '✅' : '⚠️'} Done — ${ok} OK, ${fail} failed.`);
  if (fail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMigration();
