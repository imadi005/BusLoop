const fs = require('fs');
const https = require('https');
const path = require('path');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qsmmstpkidrmecevtrwv';
let ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const sqlPath = path.join(__dirname, process.argv[2] || '010_production_hardening.sql');

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => resolve(input.trim()));
  });
}

async function requireAccessToken() {
  if (ACCESS_TOKEN) return;
  if (!process.stdin.isTTY) ACCESS_TOKEN = await readStdin();
  if (!ACCESS_TOKEN) {
    console.error('Missing SUPABASE_ACCESS_TOKEN. Pipe it through stdin or set it as an environment variable.');
    process.exit(1);
  }
}

function query(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
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
  await requireAccessToken();
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Applying ${path.basename(sqlPath)} via Supabase Management API...`);
  const res = await query(sql);
  if (res.status < 200 || res.status >= 300) {
    console.error(`Migration failed (${res.status}): ${res.body.slice(0, 1000)}`);
    process.exit(1);
  }
  console.log(`${path.basename(sqlPath)} applied successfully.`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
