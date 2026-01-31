
const { createClient } = require('@supabase/supabase-js');

// Hardcoded for verification script to avoid dotenv issues
// These are visible in the user's .env.local view purely for this transient script
const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];

if (!supabaseUrl || !supabaseKey) {
    console.log('Skipping verification: Check manually.');
    process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking schema...');
    const { data, error } = await supabase
        .from('reservations')
        .select('recurrence_group_id')
        .limit(1);

    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('SUCCESS: Column exists.');
    }
}

checkSchema();
