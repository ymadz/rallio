const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '/Users/madz/Documents/GitHub/rallio/web/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
    const { data: q } = await supabase.from('queue_sessions').select('*').limit(1)
    // Let's create a fake match to test the RPC
    const { data: match } = await supabase.from('matches').insert({
        queue_session_id: q[0].id,
        court_id: q[0].court_id,
        match_number: 999,
        game_format: 'any',
        team_a_players: ['440ea88a-bc6a-4080-bf8d-85e8b2b52e53'],
        team_b_players: ['9078b559-84fa-4d3a-8fc4-27d937faa874'],
        status: 'in_progress'
    }).select('*').single()

    console.log('Match created:', match.id)
    // Add them to participants
    await supabase.from('queue_participants').upsert([
        { queue_session_id: match.queue_session_id, user_id: match.team_a_players[0], status: 'playing' },
        { queue_session_id: match.queue_session_id, user_id: match.team_b_players[0], status: 'playing' }
    ])

    // Call RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('update_match_results', {
        p_match_id: match.id,
        p_winner: 'team_a',
        p_metadata: {}
    })
    console.log('RPC result:', rpcResult, 'Error:', rpcError)

    const { data: participants } = await supabase.from('queue_participants').select('*').in('user_id', [match.team_a_players[0], match.team_b_players[0]]).eq('queue_session_id', match.queue_session_id)
    console.log('Participants after RPC:', JSON.stringify(participants, null, 2))
}
run()
