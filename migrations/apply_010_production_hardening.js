const fs = require('fs');
const https = require('https');
const path = require('path');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qsmmstpkidrmecevtrwv';
let SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sqlPath = path.join(__dirname, '010_production_hardening.sql');

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => resolve(input.trim()));
  });
}

async function requireServiceKey() {
  if (SERVICE_KEY) return;
  if (process.stdin.isTTY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Pipe the key through stdin or set it as an environment variable.');
    process.exit(1);
  }
  SERVICE_KEY = await readStdin();
  if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run migration with an embedded secret.');
    process.exit(1);
  }
}

function makeRequest(pathname, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  await requireServiceKey();
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const endpoints = [
    { path: '/rest/v1/rpc/exec_sql', body: { query: sql } },
    { path: '/rest/v1/rpc/exec', body: { sql } },
  ];

  console.log('Applying 010 production hardening migration...');

  for (const endpoint of endpoints) {
    const res = await makeRequest(endpoint.path, endpoint.body);
    if (res.status >= 200 && res.status < 300) {
      console.log(`Migration applied via ${endpoint.path}`);
      return;
    }
    console.warn(`${endpoint.path} failed (${res.status}): ${res.body.slice(0, 500)}`);
  }

  throw new Error('Could not apply migration. SQL RPC endpoint is unavailable or rejected the migration.');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
