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
      <style>{`
        @keyframes pb-shimmer {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .pb-banner { position: relative; overflow: hidden; }
        .pb-noise {
          position: absolute; inset: 0; pointer-events: none; z-index: 1;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 150px 150px;
          mix-blend-mode: overlay;
        }
        .pb-highlight {
          position: absolute; inset: 0; pointer-events: none; z-index: 2;
          background: linear-gradient(135deg, rgba(204,251,241,0.16) 0%, rgba(153,246,228,0.06) 30%, transparent 55%, rgba(0,0,0,0.06) 100%);
        }
        .pb-shimmer {
          position: absolute; top: -20%; left: -30%; width: 80%; height: 160%;
          pointer-events: none; z-index: 3;
          background: linear-gradient(125deg, transparent 30%, rgba(255,255,255,0.05) 48%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 52%, transparent 70%);
          transform: rotate(-15deg);
          animation: pb-shimmer 5s ease-in-out infinite;
        }
      `}</style>

      {/* Hero Banner */}
      <div
        className="pb-banner h-40"
        style={{ background: [
          'radial-gradient(ellipse 90% 80% at 50% 4%, rgba(153,246,228,0.50) 0%, transparent 55%)',
          'radial-gradient(ellipse 68% 80% at 5% 80%, rgba(13,148,136,0.26) 0%, transparent 56%)',
          'radial-gradient(ellipse 68% 80% at 95% 78%, rgba(13,148,136,0.22) 0%, transparent 56%)',
          'linear-gradient(180deg, #14b8a6 0%, #0d9488 40%, #0f766e 100%)',
        ].join(', ') }}
      >
        <div className="pb-noise" />
        <div className="pb-highlight" />
        <div className="pb-shimmer" />
        <div className="relative z-[4] max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-end pb-5">
          <div>
            <p className="text-teal-200/70 text-xs font-semibold uppercase tracking-widest mb-1">Performance</p>
            <h1 className="text-2xl font-extrabold text-white tracking-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>My Matches</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Card */}
        {stats && stats.totalGames > 0 && (
          <div className="mb-8">
            <MatchStatsCard stats={stats} />
          </div>
        )}

        {/* Match History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Match History</h2>
            <MatchFilters currentFilter={filter} totalMatches={matches.length} />
          </div>

          {matches.length > 0 ? (
            <div className="space-y-3">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
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
              {filter !== 'all' && stats && stats.totalGames > 0 && (
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
