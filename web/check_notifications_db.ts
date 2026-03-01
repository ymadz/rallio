import { createServiceClient } from './src/lib/supabase/service'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkDb() {
    const supabase = createServiceClient()

    console.log('--- Checking Notifications Table Columns ---')

    const { data: columns, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(0) // Just to get metadata about the table if possible, but select * with limit 0 is better

    // Actually, let's use a query that's more reliable for finding columns
    const { data: colData, error: colError } = await supabase
        .rpc('get_table_columns', { table_name: 'notifications' })

    if (colError) {
        console.log('RPC get_table_columns failed, trying select head...')
        const { data: head, error: headError } = await supabase
            .from('notifications')
            .select('*')
            .limit(1)

        if (head && head.length > 0) {
            console.log('Found columns:', Object.keys(head[0]))
        } else {
            console.log('Table is empty or not found.')
        }
    } else {
        console.log('Columns:', colData)
    }
}

checkDb()
