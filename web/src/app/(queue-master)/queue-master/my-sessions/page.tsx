import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MySessionsClient } from '@/components/queue-master/my-sessions-client'
import { redirect } from 'next/navigation'
import { getQueueMasterHistory } from '@/app/actions/queue-actions'

export const metadata: Metadata = {
    title: 'My Sessions | Queue Master | Rallio',
    description: 'View and manage all your created queue sessions',
}

async function getMySessions() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return []
    }

    // Fetch all sessions for this organizer
    const { data: sessions, error } = await supabase
        .from('queue_sessions')
        .select(`
      *,
      courts (
        name,
        venues (
          name
        )
      )
    `)
        .eq('organizer_id', user.id)
        .order('start_time', { ascending: false })

    if (error) {
        console.error('Error fetching sessions:', error)
        return []
    }

    return sessions.map(session => ({
        id: session.id,
        courtName: session.courts?.name || 'Unknown Court',
        venueName: session.courts?.venues?.name || 'Unknown Venue',
        status: session.status,
        currentPlayers: session.current_players_count || 0,
        maxPlayers: session.max_players,
        costPerGame: session.cost_per_game,
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time),
        createdAt: new Date(session.created_at),
        mode: session.mode,
        gameFormat: session.game_format,
        participants: [] // We don't need full participant list for the summary view
    }))
}

export default async function MySessionsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Parallel fetch for active sessions and history
    const [sessions, historyResult] = await Promise.all([
        getMySessions(),
        getQueueMasterHistory()
    ])

    const history = historyResult.success ? historyResult.history : []

    return <MySessionsClient initialSessions={sessions} initialHistory={history || []} />
}
