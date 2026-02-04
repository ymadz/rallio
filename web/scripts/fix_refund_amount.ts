
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixRefundAmount() {
    console.log('Fixing refund amounts...')

    // Find refunds that look like they are in Pesos instead of Centavos (e.g. 630 instead of 63000)
    const { data, error } = await supabase
        .from('refunds')
        .select('*')
        // We'll target both pending and failed refunds with amount 630
        .in('status', ['pending', 'failed'])
        .eq('amount', 630)

    if (error) {
        console.error('Error fetching refunds:', error)
        return
    }

    console.log(`Found ${data.length} refunds to fix.`)

    for (const refund of data) {
        const newAmount = refund.amount * 100
        // Reset status to pending so they can try again
        console.log(`Updating refund ${refund.id}: Amount ${refund.amount} -> ${newAmount}, Status -> pending`)

        const { error: updateError } = await supabase
            .from('refunds')
            .update({
                amount: newAmount,
                status: 'pending',
                error_message: null, // Clear error message
                processed_at: null
            })
            .eq('id', refund.id)

        if (updateError) console.error(`Failed to update ${refund.id}:`, updateError)
        else console.log(`Success!`)
    }
}

fixRefundAmount()
