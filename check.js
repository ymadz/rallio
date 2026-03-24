const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.log('Missing env vars');
  process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
  console.log(`Checking against ${url} ...`);
  const res = await fetch(`${url}/rest/v1/carts?select=*&limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  if (!res.ok) {
    console.error('Error:', res.status, await res.text());
  } else {
    console.log('Success, table exists! Data:', await res.json());
  }
}
run();
