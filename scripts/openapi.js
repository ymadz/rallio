require('dotenv').config({ path: 'web/.env.local' });

async function run() {
  const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  const json = await result.json();
  console.log(JSON.stringify(json.definitions.queue_sessions.properties, null, 2));
}
run();
