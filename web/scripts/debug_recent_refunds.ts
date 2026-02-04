
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugRefunds() {
    const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    if (error) {
        console.error(error)
        return
    }

    console.table(data.map(r => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        created_at: r.created_at
    })))
}

debugRefunds()
