const https = require('https');

const PROJECT_REF = 'ztkzofjklpzrzskxacll';
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
  const tables = ['staff', 'trips', 'locations', 'buses'];
  for (const table of tables) {
    try {
      const res = await makeGetRequest(`/rest/v1/${table}?limit=1`);
      console.log(`Table '${table}' check status:`, res.status);
      if (res.status === 200) {
        console.log(`Table '${table}' exists! Sample row:`, res.body);
      } else {
        console.log(`Table '${table}' error:`, res.body);
      }
    } catch (e) {
      console.error(`Error checking '${table}':`, e.message);
    }
  }
}

main();

