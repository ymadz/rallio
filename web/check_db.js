const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
    const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error:', error);
    } else {
        for (const r of reservations) {
            console.log('RES ID:', r.id);
            console.log('Status:', r.status);
            console.log('Start Time:', r.start_time);
            console.log('Metadata:', JSON.stringify(r.metadata));
            console.log('---');
        }
    }

    const { data: qs, error: qsError } = await supabase
        .from('queue_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

    if (qsError) {
        console.error('QS Error:', qsError);
    } else {
        for (const q of qs) {
            console.log('QS ID:', q.id);
            console.log('QS Status:', q.status);
            console.log('QS Metadata:', JSON.stringify(q.metadata));
            console.log('---');
        }
    }
}

main();
