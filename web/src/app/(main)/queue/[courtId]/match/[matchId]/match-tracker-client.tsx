'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startMatch as startMatchAction, recordMatchScore } from '@/app/actions/match-actions'
import { useRouter } from 'next/navigation'
import { Clock, Trophy, Users, Play, CheckCircle, Loader2, AlertCircle, Star } from 'lucide-react'
import Link from 'next/link'

interface Player {
  id: string
  name: string
  avatar_url?: string
}

interface Match {
  id: string
  queue_session_id: string
  court_id: string
  match_number: number
  game_format: 'singles' | 'doubles' | 'mixed'
  team_a_players: string[]
  team_b_players: string[]
  score_a: number | null
  score_b: number | null
  winner: 'team_a' | 'team_b' | 'draw' | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  created_at: string
  queue_sessions?: {
    organizer_id: string
    cost_per_game: number
    courts: {
      name: string
      venues: {
        name: string
      }
    }
  }
}

interface MatchTrackerClientProps {
  courtId: string
  matchId: string
}

export function MatchTrackerClient({ courtId, matchId }: MatchTrackerClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [match, setMatch] = useState<Match | null>(null)
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isQueueMaster, setIsQueueMaster] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Match result selection (Queue Master only)
  const [selectedWinner, setSelectedWinner] = useState<'team_a' | 'team_b' | 'draw' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load match data
  const fetchMatch = async () => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          queue_sessions (
            organizer_id,
            cost_per_game,
            courts (
              name,
              venues (
                name
              )
            )
          )
        `)
        .eq('id', matchId)
        .single()

      if (matchError) throw matchError
      if (!matchData) throw new Error('Match not found')

      setMatch(matchData)

      // Initialize winner if match has existing result
      if (matchData.winner) setSelectedWinner(matchData.winner)

      // Fetch player details for Team A
      const { data: teamAData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', matchData.team_a_players)

      if (teamAData) {
        setTeamAPlayers(
          teamAData.map(p => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player',
            avatar_url: p.avatar_url,
          }))
        )
      }

      // Fetch player details for Team B
      const { data: teamBData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', matchData.team_b_players)

      if (teamBData) {
        setTeamBPlayers(
          teamBData.map(p => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player',
            avatar_url: p.avatar_url,
          }))
        )
      }

      // Check if current user is queue master
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        setIsQueueMaster(user.id === matchData.queue_sessions?.organizer_id)
      }

      setError(null)
    } catch (err: any) {
      console.error('Error fetching match:', err)
      setError(err.message || 'Failed to load match')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMatch()
  }, [matchId])

  // Timer for match duration
  useEffect(() => {
    if (!match?.started_at || match.status !== 'in_progress') return

    const startTime = new Date(match.started_at).getTime()

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000) // seconds
      setElapsedTime(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [match?.started_at, match?.status])

  // Real-time subscription for match updates
  useEffect(() => {
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        () => {
          fetchMatch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  const handleStartMatch = async () => {
    setIsSubmitting(true)
    try {
      const result = await startMatchAction(matchId)
      if (!result.success) {
        setError(result.error || 'Failed to start match')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start match')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecordScore = async () => {
    if (!selectedWinner) {
      setError('Please select a match result')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await recordMatchScore(matchId, {
        winner: selectedWinner,
      })

      if (!result.success) {
        setError(result.error || 'Failed to record match result')
      } else {
        // Navigate back to queue details
        setTimeout(() => {
          router.push(`/queue/${courtId}`)
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to record match result')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-800 font-medium mb-4">{error}</p>
        <Link
          href={`/queue/${courtId}`}
          className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Back to Queue
        </Link>
      </div>
    )
  }

  if (!match) return null

  const isUserPlaying =
    match.team_a_players.includes(currentUser?.id) || match.team_b_players.includes(currentUser?.id)

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Match #{match.match_number}</h1>
            <p className="text-gray-600 mt-1">
              {match.queue_sessions?.courts?.venues?.name} • {match.queue_sessions?.courts?.name}
            </p>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 bg-primary/10 text-primary rounded-lg font-semibold capitalize">
              {match.status === 'scheduled' && 'Scheduled'}
              {match.status === 'in_progress' && '🔴 Live'}
              {match.status === 'completed' && '✅ Completed'}
              {match.status === 'cancelled' && 'Cancelled'}
            </div>
            {match.game_format && (
              <p className="text-sm text-gray-500 mt-2 capitalize">{match.game_format}</p>
            )}
          </div>
        </div>

        {/* Timer */}
        {match.status === 'in_progress' && (
          <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg font-semibold">{formatTime(elapsedTime)}</span>
            <span className="text-sm text-gray-500">elapsed</span>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="bg-gradient-to-br from-primary/5 to-blue-50 border-2 border-primary/20 rounded-xl p-8">
        <div className="grid grid-cols-3 gap-6 items-center">
          {/* Team A */}
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-700 mb-3">TEAM A</div>
            <div className="space-y-2">
              {teamAPlayers.map((player, index) => (
                <div key={player.id} className="flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className={`text-sm ${currentUser?.id === player.id ? 'font-bold text-primary' : 'text-gray-700'}`}>
                    {player.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Winner Display */}
          <div className="text-center">
            {match.winner ? (
              <div className="flex items-center justify-center gap-2 text-green-700">
                <Trophy className="w-8 h-8" />
                <span className="text-2xl font-bold">
                  {match.winner === 'team_a' ? 'Team A Wins!' : match.winner === 'team_b' ? 'Team B Wins!' : 'Draw!'}
                </span>
                <Trophy className="w-8 h-8" />
              </div>
            ) : (
              <div className="text-lg text-gray-500 font-medium">
                {match.status === 'scheduled' && 'Match not started yet'}
                {match.status === 'in_progress' && 'Match in progress...'}
                {match.status === 'cancelled' && 'Match cancelled'}
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-700 mb-3">TEAM B</div>
            <div className="space-y-2">
              {teamBPlayers.map((player, index) => (
                <div key={player.id} className="flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className={`text-sm ${currentUser?.id === player.id ? 'font-bold text-primary' : 'text-gray-700'}`}>
                    {player.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Master Controls */}
      {isQueueMaster && match.status !== 'completed' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Queue Master Controls
          </h3>

          {match.status === 'scheduled' && (
            <button
              onClick={handleStartMatch}
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Match
                </>
              )}
            </button>
          )}

          {match.status === 'in_progress' && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 text-center">Select Match Result</h4>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Team A Wins */}
                <button
                  type="button"
                  onClick={() => setSelectedWinner('team_a')}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    selectedWinner === 'team_a'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-gray-900">Team A Wins</span>
                    {selectedWinner === 'team_a' && <Trophy className="w-6 h-6 text-green-600 ml-auto" />}
                  </div>
                </button>

                {/* Team B Wins */}
                <button
                  type="button"
                  onClick={() => setSelectedWinner('team_b')}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    selectedWinner === 'team_b'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-gray-900">Team B Wins</span>
                    {selectedWinner === 'team_b' && <Trophy className="w-6 h-6 text-green-600 ml-auto" />}
                  </div>
                </button>

                {/* Draw */}
                <button
                  type="button"
                  onClick={() => setSelectedWinner('draw')}
                  className={`p-4 border-2 rounded-lg transition-all text-center ${
                    selectedWinner === 'draw'
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">=</span>
                    </div>
                    <span className="font-semibold text-gray-900">Draw / Tie</span>
                    {selectedWinner === 'draw' && <CheckCircle className="w-6 h-6 text-yellow-600" />}
                  </div>
                </button>
              </div>

              <button
                onClick={handleRecordScore}
                disabled={isSubmitting || !selectedWinner}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Recording Result...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    End Match & Record Result
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Player View - Match Completed */}
      {match.status === 'completed' && isUserPlaying && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Match Completed!</h3>
          <p className="text-gray-700 mb-6">
            Final Score: {match.score_a} - {match.score_b}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/queue/${courtId}`}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Queue
            </Link>
            {/* TODO: Add rating button - will be implemented in post-match rating interface */}
            <button
              disabled
              className="px-6 py-3 bg-primary text-white rounded-lg opacity-50 cursor-not-allowed font-medium flex items-center gap-2"
            >
              <Star className="w-4 h-4" />
              Rate Opponents (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && match && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
