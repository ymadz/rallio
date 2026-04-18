require('dotenv').config({ path: 'web/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('queue_sessions')
    .insert({
      court_id: null,
      organizer_id: '123e4567-e89b-12d3-a456-426614174000', // random UUID
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      cost_per_game: 50,
      mode: 'casual',
      max_players: 8
    })
    .select();
  
  console.log('Error:', JSON.stringify(error, null, 2));
  console.log('Data:', data);
}
run();
