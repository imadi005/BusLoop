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
    const res = await makeGetRequest('/rest/v1/');
    if (res.status === 200) {
      const spec = JSON.parse(res.body);
      console.log('rls_auto_enable details:');
      console.log(JSON.stringify(spec.paths['/rpc/rls_auto_enable'], null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

main();

