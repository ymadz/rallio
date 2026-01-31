
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];
const userId = process.argv[4]; // Optional, if we can guess/find it. Or just list latest reservations.

if (!supabaseUrl || !supabaseKey) {
    console.log('Usage: node check_reservations.js <URL> <KEY>');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReservations() {
    console.log('Fetching latest 10 reservations...');

    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('Latest Reservations:');
        data.forEach(r => {
            console.log(`ID: ${r.id}`);
            console.log(`  Date: ${r.start_time} - ${r.end_time}`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Recurrence Group: ${r.recurrence_group_id}`);
            console.log(`  Metadata:`, r.metadata);
            console.log('---');
        });
    }
}

checkReservations();
