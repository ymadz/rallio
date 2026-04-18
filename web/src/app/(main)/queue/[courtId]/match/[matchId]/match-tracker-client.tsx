'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startMatch as startMatchAction, recordMatchScore } from '@/app/actions/match-actions'
import { useRouter } from 'next/navigation'
import { Clock, Trophy, Users, Play, CheckCircle, Loader2, AlertCircle, Star, MapPin } from 'lucide-react'
import Link from 'next/link'

interface Player {
  id: string
  name: string
  avatar_url?: string
  rating: number | null
  skill_level: number | null
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
      if (matchData.team_a_players && matchData.team_a_players.length > 0) {
        // Fetch profiles
        const { data: profilesA } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', matchData.team_a_players)

        // Fetch player stats (rating, skill_level) from players table
        const { data: statsA } = await supabase
          .from('players')
          .select('user_id, rating, skill_level')
          .in('user_id', matchData.team_a_players)

        if (profilesA) {
          setTeamAPlayers(
            profilesA.map(p => {
              const stats = statsA?.find(s => s.user_id === p.id)
              return {
                id: p.id,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player',
                avatar_url: p.avatar_url,
                rating: stats?.rating ?? 0,
                skill_level: stats?.skill_level ?? 1,
              }
            })
          )
        }
      }

      // Fetch player details for Team B
      if (matchData.team_b_players && matchData.team_b_players.length > 0) {
        // Fetch profiles
        const { data: profilesB } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', matchData.team_b_players)

        // Fetch player stats
        const { data: statsB } = await supabase
          .from('players')
          .select('user_id, rating, skill_level')
          .in('user_id', matchData.team_b_players)

        if (profilesB) {
          setTeamBPlayers(
            profilesB.map(p => {
              const stats = statsB?.find(s => s.user_id === p.id)
              return {
                id: p.id,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player',
                avatar_url: p.avatar_url,
                rating: stats?.rating ?? 0,
                skill_level: stats?.skill_level ?? 1,
              }
            })
          )
        }
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

  const getTierName = (l: number | null) => {
    if (l === null) return 'Unranked'
    if (l <= 3) return 'Beginner'
    if (l <= 6) return 'Intermediate'
    if (l <= 8) return 'Advanced'
    return 'Elite'
  }

  return (
    <div className="space-y-6">
      <style>{matchStyles}</style>
      
      {/* Premium Header */}
      <div className="match-header relative overflow-hidden rounded-2xl p-8 text-white shadow-xl mb-6">
        <div className="match-noise" />
        <div className="match-highlight" />
        
        <div className="relative z-10">
          <Link
            href={`/queue/${courtId}`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 font-medium transition-colors group"
          >
            <div className="p-1.5 rounded-lg bg-white/10 group-hover:bg-white/20 transition-all">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span>Back to Queue</span>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest text-teal-100">
                  {match.game_format}
                </span>
                <span className={`px-3 py-1 backdrop-blur-md border rounded-full text-xs font-bold uppercase tracking-widest ${
                  match.status === 'in_progress' 
                    ? 'bg-red-500/20 border-red-500/30 text-red-200 animate-pulse'
                    : 'bg-white/10 border-white/20 text-white'
                }`}>
                  {match.status === 'in_progress' ? '🔴 Match in Progress' : match.status}
                </span>
              </div>
              <h1 className="text-4xl font-black tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                Match #{match.match_number}
              </h1>
              <p className="text-teal-50/70 mt-2 font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {match.queue_sessions?.courts?.venues?.name} • {match.queue_sessions?.courts?.name}
              </p>
            </div>
            
            {match.status === 'in_progress' && (
              <div className="bg-black/20 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-inner">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Elapsed Time</p>
                  <p className="font-mono text-2xl font-black text-white">{formatTime(elapsedTime)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scoreboard / Teams */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-stretch">
        {/* Team A */}
        <div className="md:col-span-3 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase mb-6 text-center border-b border-gray-50 pb-3">Team A</div>
          <div className="space-y-4">
            {teamAPlayers.map((player) => (
              <div key={player.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-primary/20 transition-all group">
                <div className="relative">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.name} className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary transition-colors" />
                  ) : (
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black group-hover:bg-primary group-hover:text-white transition-all">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                    {player.name}
                    {currentUser?.id === player.id && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded uppercase tracking-wider">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {player.rating || 0} ELO
                    </span>
                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                      Lvl {player.skill_level || 1} - {getTierName(player.skill_level)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Match Control / Status */}
        <div className="md:col-span-1 flex flex-col items-center justify-center py-6 md:py-0">
          <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
            <span className="text-xs font-black text-gray-400">VS</span>
          </div>
          <div className="h-full w-px bg-gradient-to-b from-transparent via-gray-100 to-transparent hidden md:block" />
        </div>

        {/* Team B */}
        <div className="md:col-span-3 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase mb-6 text-center border-b border-gray-50 pb-3">Team B</div>
          <div className="space-y-4">
            {teamBPlayers.map((player) => (
              <div key={player.id} className="flex items-center gap-4 flex-row-reverse p-3 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-red-200 transition-all group">
                <div className="relative">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.name} className="w-12 h-12 rounded-full object-cover border-2 border-red-500/20 group-hover:border-red-500 transition-colors" />
                  ) : (
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 font-black group-hover:bg-red-500 group-hover:text-white transition-all">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-bold text-gray-900 truncate flex items-center gap-2 flex-row-reverse">
                    {player.name}
                    {currentUser?.id === player.id && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded uppercase tracking-wider">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-row-reverse">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {player.rating || 0} ELO
                    </span>
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                      Lvl {player.skill_level || 1} - {getTierName(player.skill_level)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Overlay for Completed Match */}
      {match.status === 'completed' && (
        <div className="bg-emerald-600 rounded-2xl p-8 text-center text-white shadow-xl relative overflow-hidden">
          <div className="match-noise opacity-10" />
          <div className="relative z-10 flex flex-col items-center">
             <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-xl border border-white/30">
                <Trophy className="w-10 h-10 text-white" />
             </div>
             <h2 className="text-3xl font-black mb-2 text-white">Match Completed!</h2>
             <p className="text-emerald-50/80 mb-6 font-medium">Final outcome recorded by Queue Master</p>
             
             {match.winner && (
               <div className="bg-white/10 border border-white/20 backdrop-blur-md px-8 py-4 rounded-xl mb-8">
                 <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-200 mb-2">Winners</p>
                 <p className="text-2xl font-black">
                   {match.winner === 'team_a' ? 'Team A Wins!' : match.winner === 'team_b' ? 'Team B Wins!' : 'It\'s a Draw!'}
                 </p>
               </div>
             )}
             
             <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  href={`/queue/${courtId}`}
                  className="px-8 py-3 bg-white text-emerald-700 rounded-xl hover:bg-emerald-50 transition-all font-bold shadow-lg"
                >
                  Return to Queue
                </Link>
             </div>
          </div>
        </div>
      )}

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

const matchStyles = `
  .match-header {
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%);
  }
  .match-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.12;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='qc'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23qc)' opacity='1'/%3E%3C/svg%3E");
    background-size: 150px 150px;
    mix-blend-mode: overlay;
  }
  .match-highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background: radial-gradient(ellipse at 5% 8%, rgba(255,255,255,0.3) 0%, transparent 60%);
  }
`
