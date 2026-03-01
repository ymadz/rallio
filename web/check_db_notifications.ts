import { createServiceClient } from './src/lib/supabase/service'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkDb() {
    const supabase = createServiceClient()

    console.log('--- Checking DB Structure ---')

    const { data: roles, error } = await supabase.from('roles').select('*')

    if (error) {
        console.error('Error fetching roles:', error.message)
    } else {
        console.log('Roles:', JSON.stringify(roles, null, 2))
    }
}

checkDb()
