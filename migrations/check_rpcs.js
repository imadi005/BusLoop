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
  console.log('Fetching OpenAPI spec from PostgREST...');
  try {
    const res = await makeGetRequest('/rest/v1/');
    if (res.status === 200) {
      const spec = JSON.parse(res.body);
      const paths = Object.keys(spec.paths || {});
      const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
      console.log('Available RPC paths:');
      console.log(rpcPaths);
    } else {
      console.error('Failed with status:', res.status);
      console.error(res.body);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();

