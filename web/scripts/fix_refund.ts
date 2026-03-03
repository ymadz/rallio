import { createClient } from '@supabase/supabase-js';

async function main() {
    console.log("Fixing stuck refund...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) { console.error("Missing env"); return; }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the pending refund for this payment_id
    const paymentId = 'pay_bwU4mMQNvQkNkDHEtbcAGDgU';

    const { data: refunds, error: fetchErr } = await supabase
        .from('refunds')
        .select('*')
        .eq('payment_external_id', paymentId)
        .eq('status', 'pending');

    if (fetchErr) {
        console.error("Error fetching refunds:", fetchErr);
        return;
    }

    if (!refunds || refunds.length === 0) {
        console.log("No pending refunds found for payment", paymentId);
        return;
    }

    console.log(`Found ${refunds.length} pending refunds. Fixing...`);

    for (const refund of refunds) {
        // Update refund status to succeeded
        const { error: updateErr } = await supabase
            .from('refunds')
            .update({
                status: 'succeeded',
                notes: 'Automatically updated: already refunded on PayMongo',
                processed_at: new Date().toISOString()
            })
            .eq('id', refund.id);

        if (updateErr) {
            console.error("Failed to update refund", refund.id, updateErr);
            continue;
        }

        // Also update the reservation to 'refunded'
        const { error: resErr } = await supabase
            .from('reservations')
            .update({ status: 'refunded' })
            .eq('id', refund.reservation_id);

        if (resErr) {
            console.error("Failed to update reservation", refund.reservation_id, resErr);
        } else {
            console.log("Successfully fixed refund", refund.id, "and reservation", refund.reservation_id);
        }
    }
}
main().catch(console.error);
