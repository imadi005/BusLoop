const https = require('https');

const PROJECT_REF = 'qsmmstpkidrmecevtrwv';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run with an embedded secret.');
  process.exit(1);
}

function makeGetRequest(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const res = await makeGetRequest('/rest/v1/trips?select=from_location,to_location&limit=1');
    console.log('Query status:', res.status);
    console.log('Query response:', res.body);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();

