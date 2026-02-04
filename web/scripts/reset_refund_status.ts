
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetRefunds() {
    console.log('Resetting "processing" refunds to "pending"...')

    const { data, error } = await supabase
        .from('refunds')
        .update({ status: 'pending' })
        .eq('status', 'processing')
        .select()

    if (error) {
        console.error('Error:', error)
    } else {
        console.log(`Updated ${data.length} refunds to pending status.`)
    }
}

resetRefunds()
