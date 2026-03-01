const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetadata() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, metadata, start_time, end_time')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching reservations:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

checkMetadata();
