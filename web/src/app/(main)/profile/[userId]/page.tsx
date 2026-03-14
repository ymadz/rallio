import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, display_name')
    .eq('id', userId)
    .single()

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || profile?.display_name
    || 'Player'

  return {
    title: `${name} | Rallio`,
    description: `View ${name}'s player profile on Rallio`,
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()

  // Check if viewer is the profile owner — redirect to own profile
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (currentUser?.id === userId) {
    redirect('/profile')
  }

  // Fetch the target user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .single()

  const fullName = [profile?.first_name, profile?.middle_initial, profile?.last_name]
    .filter(Boolean)
    .join(' ') || profile?.display_name || 'Player'

  const playStyles = player?.play_style?.split(',').filter(Boolean) || []

  const getSkillTier = (level: number | null) => {
    if (!level) return 'UNRANKED'
    if (level <= 3) return 'BEGINNER'
    if (level <= 6) return 'INTERMEDIATE'
    if (level <= 8) return 'ADVANCED'
    return 'ELITE'
  }

  const totalGames = player?.total_games_played || 0
  const wins = player?.total_wins || 0
  const losses = player?.total_losses || 0
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Unknown'

  // Recent matches for this user
  const { data: recentMatches } = await supabase
    .from('matches')
    .select('id, score_a, score_b, winner, completed_at, game_format, team_a_players, team_b_players, courts(name, venues(name))')
    .or(`team_a_players.cs.{${userId}},team_b_players.cs.{${userId}}`)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

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
        .pf-stats-card {
          position: relative; overflow: hidden;
          border-radius: 1.25rem;
          border: 1px solid #e5e7eb;
        }
      `}</style>

      {/* Hero Banner */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div
          className="pb-banner h-48 rounded-2xl"
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
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {/* Avatar + Name Row */}
        <div className="relative z-10 -mt-14 mb-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
          <div className="w-32 h-32 rounded-full ring-4 ring-white bg-white flex items-center justify-center overflow-hidden flex-shrink-0 sm:translate-x-[15%]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl font-bold text-gray-300 select-none">{fullName.charAt(0)}</span>
            )}
          </div>
          <div className="pb-1 flex flex-1 items-end justify-between gap-4 flex-wrap">
            <div className="sm:translate-x-[5%]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                {player?.verified_player && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide border ${
                  !player?.skill_level
                    ? 'bg-gray-100 text-gray-500 border-gray-200'
                    : player.skill_level <= 3
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : player.skill_level <= 6
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : player.skill_level <= 8
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  {getSkillTier(player?.skill_level || null)}
                </span>
              </div>
              {profile?.display_name && profile.display_name !== fullName && (
                <p className="text-sm text-gray-500 mt-0.5">@{profile.display_name}</p>
              )}
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Zamboanga City · Member since {memberSince}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
          <div className="p-5 text-center">
            <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{totalGames}</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">Games</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-3xl font-extrabold text-emerald-600 tabular-nums">{wins}</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">Wins</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-3xl font-extrabold text-red-500 tabular-nums">{losses}</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">Losses</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-3xl font-extrabold text-primary tabular-nums">{winRate}%</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">Win Rate</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-5">
            {/* Skill & Rating */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Skill & Rating</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Skill Level</span>
                    <span className="text-sm font-bold text-gray-900">
                      {player?.skill_level ? `${player.skill_level} / 10` : 'Unranked'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        !player?.skill_level
                          ? 'bg-gray-300'
                          : player.skill_level <= 3
                          ? 'bg-emerald-500'
                          : player.skill_level <= 6
                          ? 'bg-blue-500'
                          : player.skill_level <= 8
                          ? 'bg-amber-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${player?.skill_level ? (player.skill_level / 10) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-sm text-gray-600">ELO Rating</span>
                  <span className="text-lg font-bold text-gray-900 tabular-nums">{player?.rating ?? '—'}</span>
                </div>
                {player?.average_rating && (
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Player Rating</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-bold text-gray-900">{player.average_rating.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-5">
            {/* Bio */}
            {player?.bio && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">About</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{player.bio}</p>
              </div>
            )}

            {/* Play Styles */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Play Styles</h3>
              {playStyles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {playStyles.map((style: string) => (
                    <span
                      key={style}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20"
                    >
                      {style.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No play styles set yet</p>
              )}
            </div>

            {/* Recent Matches */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Matches</h3>
              {recentMatches && recentMatches.length > 0 ? (
                <div className="space-y-2">
                  {recentMatches.map((match) => {
                    const isTeamA = (match.team_a_players as string[]).includes(userId)
                    const userWon = isTeamA ? match.winner === 'team_a' : match.winner === 'team_b'
                    const isDraw = match.winner === 'draw'
                    const courtData = match.courts as any
                    const courtName = courtData?.name ?? null
                    const venueName = courtData?.venues?.name ?? null
                    const displayPlace = courtName ?? venueName ?? 'Unknown Court'
                    const scoreDisplay = match.score_a != null && match.score_b != null
                      ? isTeamA ? `${match.score_a} – ${match.score_b}` : `${match.score_b} – ${match.score_a}`
                      : null
                    const matchDate = match.completed_at
                      ? new Date(match.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Unknown date'
                    const resultLabel = isDraw ? 'DRAW' : userWon ? 'WIN' : 'LOSS'
                    const badgeStyle = isDraw
                      ? 'bg-gray-100 text-gray-600 border-gray-200'
                      : userWon
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                    const borderStyle = isDraw ? 'border-l-gray-300' : userWon ? 'border-l-emerald-500' : 'border-l-red-400'

                    return (
                      <div key={match.id} className={`flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 border-l-4 ${borderStyle}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border flex-shrink-0 ${badgeStyle}`}>
                            {resultLabel}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {match.game_format === 'singles' ? 'Singles' : 'Doubles'}
                            </p>
                            <p className="text-xs text-gray-500">{displayPlace} · {matchDate}</p>
                          </div>
                        </div>
                        {scoreDisplay && (
                          <span className="text-base font-bold text-gray-800 tabular-nums">{scoreDisplay}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-1">No match history yet</p>
                  <p className="text-gray-400 text-xs">This player hasn&apos;t completed any matches.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
