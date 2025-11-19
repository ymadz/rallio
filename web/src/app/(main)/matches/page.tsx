import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'My Matches | Rallio',
  description: 'View your match history',
}

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get player's queue sessions/matches
  const { data: matches } = await supabase
    .from('queue_participants')
    .select(`
      id,
      joined_at,
      status,
      queue_session:queue_sessions(
        id,
        session_date,
        status,
        court:courts(
          id,
          name,
          venue:venues(name)
        )
      )
    `)
    .eq('player_id', user?.id)
    .order('joined_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Upcoming Matches */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming</h2>
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 text-sm mb-3">No upcoming matches</p>
            <Link
              href="/courts"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Find a Court
            </Link>
          </div>
        </section>

        {/* Match History */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Match History</h2>

          {matches && matches.length > 0 ? (
            <div className="space-y-3">
              {matches.map((match: any) => (
                <div
                  key={match.id}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-lg">🏸</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {match.queue_session?.court?.venue?.name || match.queue_session?.court?.name || 'Queue Match'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {match.queue_session?.session_date
                        ? new Date(match.queue_session.session_date).toLocaleDateString()
                        : 'Date unknown'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    match.status === 'won' ? 'bg-green-100 text-green-600' :
                    match.status === 'lost' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {match.status?.toUpperCase() || 'PLAYED'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-sm">No match history yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
