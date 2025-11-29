'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Clock, Users, TrendingUp, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Match {
  id: string
  match_number: number
  game_format: 'singles' | 'doubles' | 'mixed'
  team_a_players: string[]
  team_b_players: string[]
  score_a: number
  score_b: number
  winner: 'team_a' | 'team_b' | 'draw'
  completed_at: string
  started_at: string
}

interface MatchHistoryViewerProps {
  sessionId: string
  userId: string
  courtId: string
}

export function MatchHistoryViewer({ sessionId, userId, courtId }: MatchHistoryViewerProps) {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        // Fetch completed matches for this session
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('queue_session_id', sessionId)
          .eq('status', 'completed')
          .order('match_number', { ascending: true })

        if (error) throw error

        setMatches(data || [])

        // Fetch player names
        const allPlayerIds = new Set<string>()
        data?.forEach((match) => {
          match.team_a_players?.forEach((id: string) => allPlayerIds.add(id))
          match.team_b_players?.forEach((id: string) => allPlayerIds.add(id))
        })

        if (allPlayerIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', Array.from(allPlayerIds))

          if (profiles) {
            const names: Record<string, string> = {}
            profiles.forEach((p) => {
              names[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player'
            })
            setPlayerNames(names)
          }
        }
      } catch (error) {
        console.error('Error fetching match history:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMatches()
  }, [sessionId])

  // Calculate user stats
  const userStats = matches.reduce(
    (stats, match) => {
      const isTeamA = match.team_a_players.includes(userId)
      const isTeamB = match.team_b_players.includes(userId)

      if (!isTeamA && !isTeamB) return stats

      stats.totalGames++

      if (
        (isTeamA && match.winner === 'team_a') ||
        (isTeamB && match.winner === 'team_b')
      ) {
        stats.wins++
      } else if (match.winner === 'draw') {
        stats.draws++
      } else {
        stats.losses++
      }

      return stats
    },
    { totalGames: 0, wins: 0, losses: 0, draws: 0 }
  )

  const winRate = userStats.totalGames > 0
    ? ((userStats.wins / userStats.totalGames) * 100).toFixed(0)
    : 0

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading match history...</p>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No matches completed yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Match history will appear here once games are completed
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* User Stats Card */}
      {userStats.totalGames > 0 && (
        <div className="bg-gradient-to-br from-primary/10 to-blue-50 border border-primary/20 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Your Session Stats
          </h3>

          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{userStats.totalGames}</div>
              <div className="text-xs text-gray-600 mt-1">Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userStats.wins}</div>
              <div className="text-xs text-gray-600 mt-1">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{userStats.losses}</div>
              <div className="text-xs text-gray-600 mt-1">Losses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{winRate}%</div>
              <div className="text-xs text-gray-600 mt-1">Win Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Match History List */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Match History ({matches.length})
        </h3>

        <div className="space-y-3">
          {matches.map((match) => {
            const isTeamA = match.team_a_players.includes(userId)
            const isTeamB = match.team_b_players.includes(userId)
            const isUserMatch = isTeamA || isTeamB

            const userWon =
              (isTeamA && match.winner === 'team_a') ||
              (isTeamB && match.winner === 'team_b')

            const isDraw = match.winner === 'draw'

            const duration = match.started_at && match.completed_at
              ? Math.floor(
                  (new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) / 60000
                )
              : null

            return (
              <Link
                key={match.id}
                href={`/queue/${courtId}/match/${match.id}`}
                className={`block p-4 border-2 rounded-lg transition-all hover:shadow-md ${
                  isUserMatch
                    ? userWon
                      ? 'border-green-200 bg-green-50 hover:border-green-300'
                      : isDraw
                      ? 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      : 'border-red-200 bg-red-50 hover:border-red-300'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Match Number */}
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-gray-900">#{match.match_number}</span>
                    </div>

                    {/* Score */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xl font-bold ${isTeamA ? 'text-primary' : 'text-gray-900'}`}>
                          {match.score_a}
                        </span>
                        <span className="text-gray-400 font-bold">-</span>
                        <span className={`text-xl font-bold ${isTeamB ? 'text-primary' : 'text-gray-900'}`}>
                          {match.score_b}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{match.game_format}</div>
                    </div>
                  </div>

                  {/* Result Badge */}
                  <div className="text-right">
                    {isUserMatch && (
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold mb-1 ${
                          userWon
                            ? 'bg-green-600 text-white'
                            : isDraw
                            ? 'bg-gray-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {userWon ? '✓ Won' : isDraw ? '= Draw' : '✗ Lost'}
                      </div>
                    )}
                    {duration !== null && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{duration} min</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Teams */}
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">Team A</div>
                    <div className="space-y-0.5">
                      {match.team_a_players.map((playerId) => (
                        <div
                          key={playerId}
                          className={playerId === userId ? 'font-semibold text-primary' : 'text-gray-700'}
                        >
                          {playerNames[playerId] || 'Player'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Team B</div>
                    <div className="space-y-0.5">
                      {match.team_b_players.map((playerId) => (
                        <div
                          key={playerId}
                          className={playerId === userId ? 'font-semibold text-primary' : 'text-gray-700'}
                        >
                          {playerNames[playerId] || 'Player'}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
