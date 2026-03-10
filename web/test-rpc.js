const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '/Users/madz/Documents/GitHub/rallio/web/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
    const { data: matches } = await supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(1)
    console.log('Matches:', JSON.stringify(matches, null, 2))

    if (matches && matches.length > 0) {
        const { data: participants } = await supabase.from('queue_participants').select('*').eq('queue_session_id', matches[0].queue_session_id)
        console.log('Participants:', JSON.stringify(participants, null, 2))
    }
}
run()
