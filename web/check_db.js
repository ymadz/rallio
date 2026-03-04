const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // Get ALL recent reservations with full details
    const { data, error } = await supabase
        .from('reservations')
        .select('id, user_id, court_id, status, start_time, end_time, cancellation_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(15);

    if (error) { console.error(error); return; }

    console.log('\n=== ALL RECENT RESERVATIONS ===');
    data.forEach(r => {
        const start = new Date(r.start_time).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        console.log(`[${r.status.padEnd(16)}] Court: ${r.court_id.slice(0,8)} | ${start} | User: ${r.user_id.slice(0,8)} | ID: ${r.id.slice(0,8)}`);
        if (r.cancellation_reason) console.log(`  ↳ Reason: ${r.cancellation_reason}`);
    });

    // Find reserved bookings that SHOULD be cancelled
    console.log('\n=== CHECKING RESERVED vs CONFIRMED OVERLAPS ===');
    const reserved = data.filter(r => r.status === 'reserved');
    const confirmed = data.filter(r => ['confirmed', 'partially_paid', 'ongoing'].includes(r.status));

    for (const res of reserved) {
        const overlapping = confirmed.filter(c =>
            c.court_id === res.court_id &&
            c.id !== res.id &&
            new Date(c.start_time) < new Date(res.end_time) &&
            new Date(c.end_time) > new Date(res.start_time)
        );
        if (overlapping.length > 0) {
            console.log(`⚠️ STALE: Reserved ${res.id.slice(0,8)} overlaps with ${overlapping.length} confirmed booking(s)!`);
        } else {
            console.log(`✅ Reserved ${res.id.slice(0,8)} - no overlapping confirmed bookings (no action needed)`);
        }
    }

    if (reserved.length === 0) {
        console.log('No reserved bookings found - all clean!');
    }
}

main();
