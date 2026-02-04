
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugReservation() {
    const reservationId = '7ccc5116-030b-44fd-afef-8795469b826d'

    console.log(`\n🔍 Inspecting Reservation: ${reservationId}\n`)

    // 1. Fetch Reservation
    const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

    if (resError) {
        console.error('❌ Error fetching reservation:', resError)
        return
    }

    console.log('📋 Reservation Details:')
    console.log(`- ID: ${reservation.id}`)
    console.log(`- Status: ${reservation.status}`)
    console.log(`- Amount Paid: ${reservation.amount_paid}`)
    console.log(`- Metadata:`, JSON.stringify(reservation.metadata, null, 2))

    // 2. Check for Payment ID in Metadata
    const metadataPaymentId = reservation.metadata?.payment_paid_event?.payment_id ||
        reservation.metadata?.payment_confirmed_event?.payment_id

    if (metadataPaymentId) {
        console.log(`\nfound payment_id in metadata: ${metadataPaymentId}`)
        const { data: linkedPayment, error: lpError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', metadataPaymentId)
            .single()
        if (linkedPayment) {
            console.log(`✅ Found Payment via Metadata ID:`, linkedPayment)
        } else {
            console.log(`❌ Payment ${metadataPaymentId} NOT found in DB (even though it's in metadata)`)
        }
    } else {
        console.log('\n⚠️ No payment_id found in reservation metadata')
    }

    // 3. Search detailed payments table
    console.log('\n🔎 Searching payments table...')

    // By reservation_id column
    const { data: paymentsByCol, error: pbcError } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)

    console.log(`- Found by 'reservation_id' column: ${paymentsByCol?.length || 0}`)
    if (paymentsByCol?.length) console.log(paymentsByCol)

    // By metadata containing reservation_id
    const { data: paymentsByMeta, error: pbmError } = await supabase
        .from('payments')
        .select('*')
        .contains('metadata', { reservation_id: reservationId })

    console.log(`- Found by 'metadata->reservation_id': ${paymentsByMeta?.length || 0}`)
    if (paymentsByMeta?.length) console.log(paymentsByMeta)

    // 4. Check Recurrence Group
    const recurrenceGroupId = reservation.recurrence_group_id || reservation.metadata?.recurrence_group_id

    if (recurrenceGroupId) {
        console.log(`\n🔄 Reservation is part of recurrence group: ${recurrenceGroupId}`)

        // Search payments by recurrence_group_id in metadata
        const { data: groupPayments, error: gpError } = await supabase
            .from('payments')
            .select('*')
            .contains('metadata', { recurrence_group_id: recurrenceGroupId })

        console.log(`- Found payments for this group (via metadata): ${groupPayments?.length || 0}`)
        if (groupPayments?.length) {
            console.log('Group Payment IDs:', groupPayments.map(p => p.id))
            console.log('Linked Reservation IDs:', groupPayments.map(p => p.reservation_id))
            console.log('Full Payment Object:', JSON.stringify(groupPayments[0], null, 2))
        }
    } else {
        console.log('\n❌ Not a recurring reservation (no recurrence_group_id)')
    }

}

debugReservation()
