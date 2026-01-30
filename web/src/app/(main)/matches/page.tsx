import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPlayerMatchHistory, getPlayerStats } from '@/app/actions/match-stats'
import { MatchStatsCard } from '@/components/matches/match-stats-card'
import { MatchCard } from '@/components/matches/match-card'
import { MatchFilters } from '@/components/matches/match-filters'

export const metadata = {
  title: 'My Matches | Rallio',
  description: 'View your match history and performance stats',
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { filter: rawFilter } = await searchParams
  const filter = (rawFilter || 'all') as 'all' | 'wins' | 'losses' | 'draws'

  // Fetch player stats and match history
  const [statsResult, matchesResult] = await Promise.all([
    getPlayerStats(user.id),
    getPlayerMatchHistory(user.id, filter),
  ])

  const stats = statsResult.stats
  const matches = matchesResult.matches

  // Log errors for debugging
  if (statsResult.error) {
    console.error('[MatchesPage] Stats error:', statsResult.error)
  }
  if (matchesResult.error) {
    console.error('[MatchesPage] Matches error:', matchesResult.error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
          <p className="text-sm text-gray-500 mt-1">Track your performance and match history</p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Card */}
        {stats && stats.totalGames > 0 && (
          <div className="mb-8">
            <MatchStatsCard stats={stats} />
          </div>
        )}

        {/* Match History */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Match History</h2>
            <MatchFilters currentFilter={filter} totalMatches={matches.length} />
          </div>

          {matches.length > 0 ? (
            <div className="grid gap-4">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No matches yet' : `No ${filter} yet`}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {filter === 'all'
                  ? 'Join a queue session to start playing and tracking your matches'
                  : `You haven't recorded any ${filter} yet. Keep playing!`}
              </p>
              {filter !== 'all' && (
                <a
                  href="/matches"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80"
                >
                  View all matches
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
