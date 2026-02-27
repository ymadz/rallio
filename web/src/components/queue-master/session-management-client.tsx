'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getQueueDetails } from '@/app/actions/queue-actions'
import {
  closeQueueSession,
  removeParticipant,
  waiveFee
} from '@/app/actions/queue-actions'
import {
  assignMatchFromQueue,
  recordMatchScore,
  getActiveMatch,
  startMatch
} from '@/app/actions/match-actions'
import { initiatePaymentAction } from '@/app/actions/payments'
import {
  Users,
  Clock,
  DollarSign,
  PlayCircle,
  StopCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Trophy,
  Play
} from 'lucide-react'
import Link from 'next/link'
import { ScoreRecordingModal } from './score-recording-modal'
import { PaymentManagementModal } from './payment-management-modal'
import { MatchAssignmentModal } from './match-assignment-modal'
import { MatchTimer } from './match-timer'
import { MatchStatusBadge } from './match-status-badge'
import { useServerTime } from '@/hooks/use-server-time'

interface SessionManagementClientProps {
  sessionId: string
}

interface Participant {
  id: string
  userId: string
  playerName: string
  avatarUrl?: string
  skillLevel: number
  position: number
  joinedAt: Date
  gamesPlayed: number
  gamesWon: number
  status: 'waiting' | 'playing' | 'completed' | 'left'
  amountOwed: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
}

interface QueueSession {
  id: string
  courtName: string
  venueName: string
  status: string
  currentPlayers: number
  maxPlayers: number
  costPerGame: number
  startTime: Date
  endTime: Date
  mode: string
  gameFormat: string
  players: Participant[]
  requiresApproval?: boolean
  approvalStatus?: string
  metadata?: any
}

export function SessionManagementClient({ sessionId }: SessionManagementClientProps) {
  const router = useRouter()
  const { date: serverDate } = useServerTime()
  const supabase = createClient()

  const [session, setSession] = useState<QueueSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal states
  const [showMatchAssignModal, setShowMatchAssignModal] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [activeMatches, setActiveMatches] = useState<any[]>([])

  // Session summary modal state
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<{
    totalGames: number
    totalRevenue: number
    totalParticipants: number
    unpaidBalances: number
  } | null>(null)

  useEffect(() => {
    loadSession()

    // Subscribe to real-time updates
    console.log('🔔 [useEffect] Setting up real-time subscriptions for session:', sessionId)

    const channel = supabase
      .channel(`queue-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Participant change detected:', payload.eventType, payload.new)
          loadSession()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Session change detected:', payload.eventType)
          loadSession()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `queue_session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Match change detected:', payload.eventType)
          loadSession()
        }
      )
      .subscribe((status) => {
        console.log('🔔 [Realtime] Subscription status:', status)
      })

    return () => {
      console.log('🔔 [useEffect] Cleaning up real-time subscriptions')
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const loadSession = async () => {
    console.log('🚨🚨🚨 [loadSession] Starting session load')
    console.log('🔍 [loadSession] Session ID:', sessionId)

    setIsLoading(true)
    setError(null)
    try {
      // Fetch session details directly
      console.log('📡 [loadSession] Fetching session from database...')
      const { data: sessionData, error: sessionError } = await supabase
        .from('queue_sessions')
        .select(`
          *,
          courts (
            name,
            venues (
              id,
              name
            )
          )
        `)
        .eq('id', sessionId)
        .single()

      console.log('📥 [loadSession] Session query result:', { sessionData, sessionError })

      if (sessionError || !sessionData) {
        console.log('❌ [loadSession] Session not found or error occurred')
        console.log('❌ [loadSession] Error details:', sessionError)
        throw new Error('Session not found')
      }

      console.log('✅ [loadSession] Session found:', {
        id: sessionData.id,
        status: sessionData.status,
        courtName: sessionData.courts?.name,
        venueName: sessionData.courts?.venues?.name
      })

      // Fetch participants
      console.log('📡 [loadSession] Fetching participants...')
      const { data: participants, error: participantsError } = await supabase
        .from('queue_participants')
        .select(`
          *,
          user:user_id!inner (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('queue_session_id', sessionId)
        .is('left_at', null)
        .order('joined_at', { ascending: true })

      console.log('📥 [loadSession] Participants query result:', {
        count: participants?.length || 0,
        error: participantsError
      })

      if (participantsError) {
        console.log('❌ [loadSession] Failed to fetch participants:', participantsError)
        throw new Error('Failed to fetch participants')
      }

      // Get player skill levels
      const playerIds = participants?.map((p: any) => p.user_id) || []
      console.log('📡 [loadSession] Fetching skill levels for', playerIds.length, 'players')
      const { data: players } = await supabase
        .from('players')
        .select('user_id, skill_level')
        .in('user_id', playerIds)

      console.log('📥 [loadSession] Players skill data:', players)
      const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || [])

      // Format participants
      const formattedParticipants: Participant[] = (participants || []).map((p: any, index: number) => ({
        id: p.id,
        userId: p.user_id,
        playerName: p.user?.display_name || `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'Unknown Player',
        avatarUrl: p.user?.avatar_url,
        skillLevel: playerSkillMap.get(p.user_id) || 5,
        position: index + 1,
        joinedAt: new Date(p.joined_at),
        gamesPlayed: p.games_played || 0,
        gamesWon: p.games_won || 0,
        status: p.status,
        amountOwed: parseFloat(p.amount_owed || '0'),
        paymentStatus: p.payment_status,
      }))

      // Format session data
      const formattedSession: QueueSession = {
        id: sessionData.id,
        courtName: sessionData.courts?.name || 'Unknown Court',
        venueName: sessionData.courts?.venues?.name || 'Unknown Venue',
        status: sessionData.status,
        currentPlayers: sessionData.current_players || formattedParticipants.length,
        maxPlayers: sessionData.max_players || 12,
        costPerGame: parseFloat(sessionData.cost_per_game || '0'),
        startTime: new Date(sessionData.start_time),
        endTime: new Date(sessionData.end_time),
        mode: sessionData.mode,
        gameFormat: sessionData.game_format,
        players: formattedParticipants,
        metadata: sessionData.metadata
      }

      // AUTO-COMPLETE: If past end_time, complete the session on the spot
      const now = serverDate || new Date()
      if (['open', 'active'].includes(formattedSession.status) && formattedSession.endTime < now) {
        console.log('🕒 [loadSession] Session expired, auto-completing:', sessionData.id)
        const { error: closeErr } = await supabase
          .from('queue_sessions')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', sessionData.id)

        if (!closeErr) {
          formattedSession.status = 'completed'
        }
      }
      // AUTO-ACTIVATE: If 'open' and start_time has passed, flip to 'active'
      else if (formattedSession.status === 'open' && formattedSession.startTime <= now && formattedSession.endTime > now) {
        console.log('▶️ [loadSession] Auto-activating session:', sessionData.id)
        const { error: activateErr } = await supabase
          .from('queue_sessions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', sessionData.id)

        if (!activateErr) {
          formattedSession.status = 'active'
        }
      }

      console.log('✅ [loadSession] Session formatted successfully:', {
        id: formattedSession.id,
        courtName: formattedSession.courtName,
        venueName: formattedSession.venueName,
        status: formattedSession.status,
        participantCount: formattedSession.players.length
      })

      setSession(formattedSession)

      // Load active matches
      console.log('📡 [loadSession] Loading active matches...')
      await loadActiveMatches()

      console.log('✅✅✅ [loadSession] Session load complete!')
    } catch (err: any) {
      console.log('❌❌❌ [loadSession] Error occurred:', err)
      console.log('❌ [loadSession] Error message:', err.message)
      console.log('❌ [loadSession] Error stack:', err.stack)
      setError(err.message || 'Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }

  const loadActiveMatches = async () => {
    console.log('🏸 [loadActiveMatches] Starting to load active matches')
    console.log('🔍 [loadActiveMatches] Session ID:', sessionId)

    try {
      console.log('📡 [loadActiveMatches] Querying matches table...')
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          queue_sessions!inner(court_id, courts(name))
        `)
        .eq('queue_session_id', sessionId)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: false })

      console.log('📥 [loadActiveMatches] Matches query result:', {
        count: matches?.length || 0,
        error: matchError
      })

      if (matches) {
        console.log('🔄 [loadActiveMatches] Formatting matches with player details...')
        // Format matches with player details
        const formattedMatches = await Promise.all(
          matches.map(async (match) => {
            const allPlayerIds = [...(match.team_a_players || []), ...(match.team_b_players || [])]
            console.log('📡 [loadActiveMatches] Fetching players for match:', match.id, 'PlayerIds:', allPlayerIds)
            const { data: players } = await supabase
              .from('profiles')
              .select('id, display_name, first_name, last_name, avatar_url')
              .in('id', allPlayerIds)

            const getPlayerInfo = (id: string) => {
              const player = players?.find(p => p.id === id)
              return {
                id,
                name: player?.display_name || `${player?.first_name} ${player?.last_name}` || 'Unknown',
                avatarUrl: player?.avatar_url,
              }
            }

            return {
              ...match,
              teamAPlayers: (match.team_a_players || []).map(getPlayerInfo),
              teamBPlayers: (match.team_b_players || []).map(getPlayerInfo),
            }
          })
        )
        console.log('✅ [loadActiveMatches] Matches formatted:', formattedMatches.length)
        setActiveMatches(formattedMatches)
      } else {
        console.log('📭 [loadActiveMatches] No active matches found')
      }
    } catch (err) {
      console.error('❌ [loadActiveMatches] Error:', err)
    }
  }

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this session? This action cannot be undone.')) {
      return
    }

    setActionLoading('close')
    try {
      const result = await closeQueueSession(sessionId)
      if (!result.success) throw new Error(result.error)

      // Show summary modal instead of redirecting immediately
      if (result.summary) {
        setSessionSummary(result.summary)
        setShowSummaryModal(true)
      } else {
        router.push('/bookings')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to close session')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemovePlayer = async (userId: string, playerName: string) => {
    const reason = prompt(`Why are you removing ${playerName}?`)
    if (!reason) return

    setActionLoading(`remove-${userId}`)
    try {
      const result = await removeParticipant(sessionId, userId, reason)
      if (!result.success) throw new Error(result.error)
      await loadSession()
    } catch (err: any) {
      alert(err.message || 'Failed to remove player')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignMatch = () => {
    setShowMatchAssignModal(true)
  }

  const handleOpenScoreModal = (match: any) => {
    setSelectedMatch(match)
    setShowScoreModal(true)
  }

  const handleOpenPaymentModal = (participant: Participant) => {
    setSelectedParticipant(participant)
    setShowPaymentModal(true)
  }

  const handleModalSuccess = async () => {
    await loadSession()
  }

  const handleStartMatch = async (matchId: string) => {
    setActionLoading(`start-${matchId}`)
    try {
      const result = await startMatch(matchId)
      if (!result.success) throw new Error(result.error)
      await loadSession()
    } catch (err: any) {
      alert(err.message || 'Failed to start match')
    } finally {
      setActionLoading(null)
    }
  }


  const handlePayNow = async () => {
    if (!session?.metadata?.reservation_id) {
      alert('Payment information not found. Please contact support.')
      return
    }

    setActionLoading('pay')
    try {
      const paymentMethod = session.metadata?.payment_method === 'paymaya' ? 'paymaya' : 'gcash'
      const result = await initiatePaymentAction(session.metadata.reservation_id, paymentMethod)
      if (!result.success || !result.checkoutUrl) {
        throw new Error(result.error || 'Failed to initiate payment')
      }
      window.location.href = result.checkoutUrl
    } catch (err: any) {
      alert(err.message || 'Payment initiation failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Session</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Bookings
          </Link>
        </div>
      </div>
    )
  }

  const waitingPlayers = session.players.filter(p => p.status === 'waiting')
  const playingPlayers = session.players.filter(p => p.status === 'playing')
  const totalRevenue = session.players.reduce((sum, p) => sum + p.amountOwed, 0)
  const totalGamesPlayed = session.players.reduce((sum, p) => sum + p.gamesPlayed, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-700 border-green-200'
      case 'active': return 'bg-green-100 text-green-700 border-green-200'
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'pending_payment': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getDisplayStatus = () => {
    const now = serverDate || new Date()
    const status = session.status
    if (status === 'open' || status === 'active') {
      const isLive = new Date(session.startTime) <= now && new Date(session.endTime) > now
      return isLive ? 'Live Now' : 'Open'
    }
    if (status === 'pending_payment') return 'Pending Payment'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getDisplayStatusKey = () => {
    const now = serverDate || new Date()
    const status = session.status
    if (status === 'open' || status === 'active') {
      return new Date(session.startTime) <= now && new Date(session.endTime) > now ? 'live' : 'upcoming'
    }
    return status
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Bookings</span>
        </Link>

        {/* Payment Required Alert */}
        {session.status === 'pending_payment' && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 rounded-r-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <DollarSign className="h-5 w-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-orange-800">
                    Payment Required
                  </h3>
                  <p className="mt-1 text-sm text-orange-700">
                    Complete payment to activate your session and allow players to join.
                    {session.metadata?.payment_required && ` Amount due: ₱${parseFloat(session.metadata.payment_required).toFixed(2)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handlePayNow}
                disabled={actionLoading === 'pay'}
                className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === 'pay' && <Loader2 className="w-4 h-4 animate-spin" />}
                Pay Now
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900">{session.courtName}</h1>
              <span className="text-sm font-mono text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">
                #{session.id.slice(0, 8)}
              </span>
            </div>
            <p className="text-gray-600">{session.venueName}</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${getStatusColor(getDisplayStatusKey())}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span>{getDisplayStatus()}</span>
          </div>
        </div>
      </div>

      {/* Session Info Card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-xl p-6 mb-6 shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-white/80 text-sm mb-1">Total Players</div>
            <div className="text-2xl font-bold">{session.currentPlayers}/{session.maxPlayers}</div>
          </div>
          <div>
            <div className="text-white/80 text-sm mb-1">Waiting</div>
            <div className="text-2xl font-bold text-yellow-300">{session.players.filter(p => p.status === 'waiting').length}</div>
          </div>
          <div>
            <div className="text-white/80 text-sm mb-1">Playing</div>
            <div className="text-2xl font-bold text-green-300">{session.players.filter(p => p.status === 'playing').length}</div>
          </div>
          <div>
            <div className="text-white/80 text-sm mb-1">Total Games</div>
            <div className="text-2xl font-bold">{totalGamesPlayed}</div>
          </div>
          <div>
            <div className="text-white/80 text-sm mb-1">Revenue</div>
            <div className="text-2xl font-bold">₱{totalRevenue.toFixed(0)}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/20">
          {(session.status === 'completed' || session.status === 'cancelled') ? (
            <Link
              href={`/bookings`}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg hover:bg-white/90 transition-colors font-medium"
            >
              <Trophy className="w-4 h-4" />
              <span>View Session Summary</span>
            </Link>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={actionLoading === 'close'}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                <span>Close Session</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Participants List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Matches */}
          {activeMatches.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Active Matches ({activeMatches.length})
              </h2>
              <div className="space-y-3">
                {activeMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`border-2 rounded-lg p-4 ${match.status === 'scheduled'
                      ? 'border-gray-200 bg-gray-50'
                      : match.status === 'in_progress'
                        ? 'border-green-200 bg-green-50'
                        : 'border-blue-200 bg-blue-50'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${match.status === 'scheduled'
                          ? 'bg-gray-600'
                          : match.status === 'in_progress'
                            ? 'bg-green-600'
                            : 'bg-blue-600'
                          }`}>
                          <Trophy className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Match #{match.match_number}</div>
                          <MatchStatusBadge status={match.status} size="sm" />
                        </div>
                        {(match.status === 'in_progress' || match.status === 'completed') && (
                          <MatchTimer
                            startedAt={match.started_at}
                            completedAt={match.completed_at}
                            className="text-gray-600"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {match.status === 'scheduled' && (
                          <button
                            onClick={() => handleStartMatch(match.id)}
                            disabled={actionLoading === `start-${match.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `start-${match.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span>Start Match</span>
                          </button>
                        )}
                        {match.status === 'in_progress' && (
                          <button
                            onClick={() => handleOpenScoreModal(match)}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Record Score
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Team A</div>
                        <div className="space-y-1">
                          {match.teamAPlayers?.map((p: any) => (
                            <div key={p.id} className="text-sm text-gray-900">{p.name}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Team B</div>
                        <div className="space-y-1">
                          {match.teamBPlayers?.map((p: any) => (
                            <div key={p.id} className="text-sm text-gray-900">{p.name}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Participants ({session.players.length})
              </h2>
              {(() => {
                const now = serverDate || new Date()
                const isStarted = new Date(session.startTime) <= now
                return (
                  <button
                    onClick={handleAssignMatch}
                    disabled={!isStarted || waitingPlayers.length < (session.gameFormat === 'singles' ? 2 : 4)}
                    title={!isStarted ? 'Session has not started yet' : undefined}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Assign Match</span>
                  </button>
                )
              })()}
            </div>

            {/* Pre-start reminder */}
            {(() => {
              const now = serverDate || new Date()
              const sessionStart = new Date(session.startTime)
              if (sessionStart > now) {
                return (
                  <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    <Clock className="w-5 h-5 flex-shrink-0" />
                    <p>
                      Match assignments will be available once the session starts at{' '}
                      <span className="font-semibold">
                        {sessionStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>. Players can join the queue in the meantime.
                    </p>
                  </div>
                )
              }
              return null
            })()}

            {/* Waiting Players */}
            {waitingPlayers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                  Waiting ({waitingPlayers.length})
                </h3>
                <div className="space-y-2">
                  {waitingPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                          #{player.position}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{player.playerName}</div>
                          <div className="text-sm text-gray-600">
                            {player.gamesPlayed} played • ₱{player.amountOwed.toFixed(0)} owed
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenPaymentModal(player)}
                          className={`px-3 py-1 text-xs font-medium rounded-full border ${player.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : player.paymentStatus === 'partial'
                              ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                              : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                            }`}
                          title="Manage payment"
                        >
                          <DollarSign className="w-3 h-3 inline mr-0.5" />
                          {player.paymentStatus}
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemovePlayer(player.userId, player.playerName)}
                        disabled={actionLoading === `remove-${player.userId}`}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 ml-2"
                        title="Remove player"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playing Players */}
            {playingPlayers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                  Playing ({playingPlayers.length})
                </h3>
                <div className="space-y-2">
                  {playingPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                          <PlayCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{player.playerName}</div>
                          <div className="text-sm text-gray-600">
                            Currently playing
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {session.players.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Participants Yet</h3>
                <p className="text-sm text-gray-500">
                  Waiting for players to join this session
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Session Details */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Session Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Mode</span>
                <span className="font-medium text-gray-900 capitalize">{session.mode}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Format</span>
                <span className="font-medium text-gray-900 capitalize">{session.gameFormat}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Cost/Game</span>
                <span className="font-medium text-gray-900">₱{session.costPerGame}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Start Time</span>
                <span className="font-medium text-gray-900">
                  {new Date(session.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">End Time</span>
                <span className="font-medium text-gray-900">
                  {new Date(session.endTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {session && (
        <>
          <MatchAssignmentModal
            isOpen={showMatchAssignModal}
            onClose={() => setShowMatchAssignModal(false)}
            sessionId={sessionId}
            waitingPlayers={waitingPlayers.map(p => ({
              id: p.id,
              userId: p.userId,
              playerName: p.playerName,
              avatarUrl: p.avatarUrl,
              skillLevel: p.skillLevel,
              gamesPlayed: p.gamesPlayed,
            }))}
            gameFormat={session.gameFormat as 'singles' | 'doubles' | 'mixed'}
            onSuccess={handleModalSuccess}
          />

          {selectedMatch && (
            <ScoreRecordingModal
              isOpen={showScoreModal}
              onClose={() => {
                setShowScoreModal(false)
                setSelectedMatch(null)
              }}
              match={{
                id: selectedMatch.id,
                matchNumber: selectedMatch.match_number,
                gameFormat: selectedMatch.game_format,
                teamAPlayers: selectedMatch.teamAPlayers || [],
                teamBPlayers: selectedMatch.teamBPlayers || [],
              }}
              sessionId={sessionId}
              onSuccess={handleModalSuccess}
            />
          )}

          {selectedParticipant && (
            <PaymentManagementModal
              isOpen={showPaymentModal}
              onClose={() => {
                setShowPaymentModal(false)
                setSelectedParticipant(null)
              }}
              participant={selectedParticipant}
              sessionId={sessionId}
              costPerGame={session.costPerGame}
              onSuccess={handleModalSuccess}
            />
          )}

          {/* Session Summary Modal */}
          {showSummaryModal && sessionSummary && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Session Closed</h2>
                      <p className="text-white/80 text-sm">Summary of your queue session</p>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-900">{sessionSummary.totalParticipants}</div>
                      <div className="text-sm text-gray-600 flex items-center justify-center gap-1 mt-1">
                        <Users className="w-4 h-4" />
                        Total Players
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-900">{sessionSummary.totalGames}</div>
                      <div className="text-sm text-gray-600 flex items-center justify-center gap-1 mt-1">
                        <Trophy className="w-4 h-4" />
                        Games Played
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">₱{sessionSummary.totalRevenue.toFixed(2)}</div>
                      <div className="text-sm text-gray-600 flex items-center justify-center gap-1 mt-1">
                        <DollarSign className="w-4 h-4" />
                        Total Revenue
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 text-center ${sessionSummary.unpaidBalances > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                      <div className={`text-3xl font-bold ${sessionSummary.unpaidBalances > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {sessionSummary.unpaidBalances}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center justify-center gap-1 mt-1">
                        <AlertCircle className="w-4 h-4" />
                        Unpaid Balances
                      </div>
                    </div>
                  </div>

                  {sessionSummary.unpaidBalances > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      ⚠️ Some players have unpaid balances. Make sure to collect payments.
                    </div>
                  )}

                  <button
                    onClick={() => router.push('/bookings')}
                    className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Back to Bookings
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
