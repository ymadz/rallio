const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'web/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'queue_sessions' });
  if (error) {
    const { data: cols, error: colErr } = await supabase.from('queue_sessions').select('*').limit(1);
    console.log(cols);
  } else {
    console.log(data);
  }
}
run();
