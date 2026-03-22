require('dotenv').config({ path: 'web/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/queue_sessions?limit=1`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  
  const text = await result.text();
  console.log(text);
  
  // also get schema:
  console.log("=== COLUMNS ===");
  const res = await supabase.rpc('get_table_schema', { table_name: 'queue_sessions' });
  if (res.error) console.error(res.error);
  else console.log(res.data);
}
run();
