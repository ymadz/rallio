require('dotenv').config({ path: 'web/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('queue_sessions').select('*').limit(1);
  if (error) {
    console.error('Error fetching queue_sessions:', error);
  } else {
    console.log(data);
  }
}

run();
