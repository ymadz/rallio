
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from web/.env.local
dotenv.config({ path: path.join(__dirname, '../../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking for recurrence_group_id column...');

    // Try to select the column. If it doesn't exist, Supabase/Postgres will error.
    const { data, error } = await supabase
        .from('reservations')
        .select('recurrence_group_id')
        .limit(1);

    if (error) {
        if (error.message.includes('does not exist')) {
            console.log('❌ Column recurrence_group_id DOES NOT exist.');
            console.log('Error details:', error.message);
        } else {
            console.log('⚠️ Unexpected error:', error.message);
        }
    } else {
        console.log('✅ Column recurrence_group_id EXISTS.');
    }
}

checkSchema();
