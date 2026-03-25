'use client'

import { useQueue } from '@/hooks/use-queue'
import { PlayerCard } from '@/components/queue/player-card'
import { QueuePositionTracker } from '@/components/queue/queue-position-tracker'
import { MatchHistoryViewer } from '@/components/queue/match-history-viewer'
import { SessionManagementClient } from '@/components/queue-master/session-management-client'
import { QueueEventCard } from '@/components/queue/queue-event-card'

import { Users, Clock, Activity, Loader2, AlertCircle, Trophy, Calendar, X, CreditCard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { initiateQueuePaymentAction } from '@/app/actions/payments'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { differenceInSeconds, subHours, isBefore, format } from 'date-fns'
import { useServerTime } from '@/hooks/use-server-time'
import { formatCurrency } from '@rallio/shared/utils'

interface QueueDetailsClientProps {
  courtId: string
}

export function QueueDetailsClient({ courtId }: QueueDetailsClientProps) {
  const router = useRouter()
  const { queue, isLoading, error, joinQueue, leaveQueue, refreshQueue } = useQueue(courtId)
  const { date: serverDate } = useServerTime()
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [participant, setParticipant] = useState<any>(null)
  const [userSkillLevel, setUserSkillLevel] = useState<number | null>(null)
  const [isProfileCompleted, setIsProfileCompleted] = useState<boolean>(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [rejoinCooldownSeconds, setRejoinCooldownSeconds] = useState<number | null>(null)

  const [timeUntilOpen, setTimeUntilOpen] = useState<number | null>(null)

  // Timer effect
  useEffect(() => {
    if (!queue?.startTime) return

    const updateTimer = () => {
      const startTime = new Date(queue.startTime)
      const openTime = queue.joinWindowHours != null ? subHours(startTime, queue.joinWindowHours) : new Date(0)
      const now = serverDate || new Date()

      if (isBefore(now, openTime)) {
        const diff = differenceInSeconds(openTime, now)
        setTimeUntilOpen(diff)
      } else {
        setTimeUntilOpen(0)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [queue?.startTime, serverDate])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  const formatCooldown = (seconds: number) => {
    const s = Math.max(0, seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60

    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }

    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const parseRejoinCooldownSeconds = (message: string): number | null => {
    // Handles messages like "Please wait 00:02:29.187105 before rejoining".
    const match = message.match(/Please wait\s+([0-9:.]+)\s+before rejoining/i)
    if (!match) return null

    const timePart = match[1].split('.')[0]
    const parts = timePart.split(':').map((p) => Number(p))
    if (parts.some((n) => Number.isNaN(n))) return null

    if (parts.length === 3) {
      const [h, m, s] = parts
      return h * 3600 + m * 60 + s
    }

    if (parts.length === 2) {
      const [m, s] = parts
      return m * 60 + s
    }

    return null
  }

  useEffect(() => {
    if (rejoinCooldownSeconds == null || rejoinCooldownSeconds <= 0) return

    const timer = setInterval(() => {
      setRejoinCooldownSeconds((prev) => {
        if (prev == null) return null
        if (prev <= 1) return null
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [rejoinCooldownSeconds])

  const [showMatchHistory, setShowMatchHistory] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [paymentRequiredInfo, setPaymentRequiredInfo] = useState<{
    show: boolean
    amountOwed: number
    gamesPlayed: number
  } | null>(null)
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'gcash' | 'paymaya' | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [isQueueMaster, setIsQueueMaster] = useState(false)
  const [showPlayerView, setShowPlayerView] = useState(false)
  const supabase = createClient()

  // Get current user ID and check if queue master
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      if (user?.id) {
        try {
          // Fetch profile status
          const { data: profile } = await supabase
            .from('profiles')
            .select('profile_completed')
            .eq('id', user.id)
            .single()

          setIsProfileCompleted(profile?.profile_completed ?? false)

          const { data: roles } = await supabase
            .from('user_roles')
            .select('roles(name)')
            .eq('user_id', user.id)

          const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master') || false
          setIsQueueMaster(hasQueueMasterRole)
        } catch (err) {
          console.error('Error fetching user roles/profile:', err)
          setIsQueueMaster(false)
        }
      }
    }
    getCurrentUser()
  }, [])

  // Fetch user skill level
  useEffect(() => {
    if (!currentUserId) return
    async function fetchUserSkill() {
      const { data } = await supabase
        .from('players')
        .select('skill_level')
        .eq('user_id', currentUserId)
        .single()
      setUserSkillLevel(data?.skill_level || null)
    }
    fetchUserSkill()
  }, [currentUserId])

  // Fetch participant details and keep in sync with realtime updates
  useEffect(() => {
    if (!queue?.id || !currentUserId) return

    const fetchParticipant = async () => {
      try {
        const { data, error } = await supabase
          .from('queue_participants')
          .select('*')
          .eq('queue_session_id', queue.id)
          .eq('user_id', currentUserId)
          .is('left_at', null)
          .maybeSingle()

        if (error) {
          console.error('Error fetching participant:', error)
          return
        }

        setParticipant(data || null)
      } catch (err) {
        console.error('Error fetching participant:', err)
      }
    }

    fetchParticipant()

    const participantChannel = supabase
      .channel(`queue-participant-${queue.id}-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${queue.id}`,
        },
        () => {
          fetchParticipant()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantChannel)
    }
  }, [queue?.id, currentUserId])



  const handleJoinQueue = async () => {
    setJoinError(null)
    setIsJoining(true)
    const result = await joinQueue()
    if (!result.success) {
      const message = result.error || 'Failed to join queue'
      setJoinError(message)

      const cooldown = parseRejoinCooldownSeconds(message)
      setRejoinCooldownSeconds(cooldown)
    } else {
      setRejoinCooldownSeconds(null)
    }
    setIsJoining(false)
  }

  const handleQueuePayment = async (method: 'gcash' | 'paymaya') => {
    if (!participant || !queue) return
    setIsInitiatingPayment(true)
    setSelectedPaymentMethod(method)
    setPaymentError(null)

    try {
      const result = await initiateQueuePaymentAction(queue.id, method)
      if (!result.success) {
        setPaymentError(result.error || 'Failed to initiate payment')
        return
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment failed')
    } finally {
      setIsInitiatingPayment(false)
      setSelectedPaymentMethod(null)
    }
  }

  const handleLeaveQueue = async () => {
    if (!showLeaveConfirm) {
      setShowLeaveConfirm(true)
      return
    }
    setIsLeaving(true)
    setShowLeaveConfirm(false)
    const result = await leaveQueue()

    if (result?.requiresPayment) {
      // Show payment required modal
      setPaymentRequiredInfo({
        show: true,
        amountOwed: result.amountOwed || 0,
        gamesPlayed: result.gamesPlayed || 0,
      })
    }

    setIsLeaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !queue) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Queue</h3>
        <p className="text-sm text-gray-500 mb-4">{error || 'Queue not found'}</p>
        <button
          onClick={refreshQueue}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Wait for both queue data AND user ID before deciding which view to show
  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Closed/cancelled sessions should show summary view instead of join/leave UI.
  if (queue.status === 'completed') {
    const summary = queue.sessionSummary || {
      totalGames: 0,
      totalRevenue: 0,
      totalParticipants: queue.currentPlayers || 0,
      unpaidBalances: 0,
    }
    const sortedOutcomes = [...(queue.matchOutcomes || [])].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))

    return (
      <div className="space-y-6">
        <QueueEventCard queue={queue} onBack={() => router.back()} />

        <div className="rounded-2xl border border-teal-100 bg-white overflow-hidden shadow-[0_8px_28px_rgba(13,148,136,0.10)]">
          <div className="px-6 py-5 border-b border-white/20 bg-[radial-gradient(ellipse_95%_120%_at_8%_0%,rgba(153,246,228,0.35)_0%,transparent_45%),linear-gradient(135deg,#14b8a6_0%,#0d9488_45%,#0f766e_100%)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-white">Session Summary</h3>
                <p className="text-sm text-teal-50/90">Final session stats and match outcomes</p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-white/18 text-white text-xs font-semibold px-3 py-1 border border-white/25 backdrop-blur-sm">
                Completed
              </span>
            </div>
            {summary.completedAt && (
              <p className="text-sm text-teal-50/80 mt-3">
                Closed at {format(new Date(summary.completedAt), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>

          <div className="p-6">
            {isQueueMaster ? (
              // Queue Master View: 4 metrics
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Total Games</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.totalGames}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Total Revenue</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Participants</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <Users className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.totalParticipants}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Unpaid Balances</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.unpaidBalances}</p>
                </div>
              </div>
            ) : (
              // Player View: 3 metrics
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Total Games</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.totalGames}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Avg Per Game</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.totalGames > 0 ? formatCurrency(summary.totalRevenue / summary.totalGames) : '-'}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50 to-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Participants</p>
                    <div className="w-7 h-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
                      <Users className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-900 mt-1">{summary.totalParticipants}</p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-gray-900">Match Results</h4>
                <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1">
                  {sortedOutcomes.length} game{sortedOutcomes.length === 1 ? '' : 's'}
                </span>
              </div>

              {sortedOutcomes.length > 0 ? (
                <div className="space-y-3">
                  {sortedOutcomes.map((match) => (
                    <div key={`${match.matchNumber}-${match.completedAt || 'na'}`} className="rounded-xl border border-teal-100 p-4 bg-gradient-to-b from-white to-teal-50/40">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <p className="text-sm font-semibold text-gray-900">Game {match.matchNumber || '-'}</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-white border border-teal-200 text-xs font-semibold text-teal-700 px-2.5 py-1">
                            Score {match.score}
                          </span>
                          {match.result === 'draw' && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 px-2.5 py-1">
                              Draw
                            </span>
                          )}
                        </div>
                      </div>

                      {match.result === 'draw' ? (
                        <div className="text-sm text-gray-600 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          Teams ended in a draw.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                            <p className="text-xs font-semibold text-teal-700 mb-1">Winners</p>
                            <p className="text-sm text-teal-900 font-medium">{match.winnerNames.join(', ') || 'Unknown'}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Losers</p>
                            <p className="text-sm text-gray-900 font-medium">{match.loserNames.join(', ') || 'Unknown'}</p>
                          </div>
                        </div>
                      )}

                      {match.completedAt && (
                        <p className="text-xs text-gray-500 mt-3">
                          Finished {format(new Date(match.completedAt), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/30 px-4 py-6 text-center">
                  <p className="text-sm text-gray-500">No match results available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isRejoinCooldownActive = rejoinCooldownSeconds != null && rejoinCooldownSeconds > 0

  // If the current user is the organizer, show the full session management UI by default
  if (queue.organizerId === currentUserId && !showPlayerView) {
    return (
      <div className="space-y-6">
        <div className="bg-teal-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">Manager Mode</p>
              <p className="text-xs text-teal-100">You are managing this session as an organizer.</p>
            </div>
          </div>
          <button
            onClick={() => setShowPlayerView(true)}
            className="px-4 py-2 bg-white text-teal-600 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors shadow-sm"
          >
            Switch to Player View
          </button>
        </div>
        <SessionManagementClient
          sessionId={queue.id}
          onSwitchToPlayerView={() => setShowPlayerView(true)}
        />
      </div>
    )
  }

  const isUserInQueue = queue.userPosition !== null
  const playersAhead = isUserInQueue ? queue.userPosition! - 1 : 0

  const isSkillMismatch = queue && userSkillLevel !== null && (
    (queue.minSkillLevel != null && userSkillLevel < queue.minSkillLevel) ||
    (queue.maxSkillLevel != null && userSkillLevel > queue.maxSkillLevel)
  )


  return (
    <>
      <div className="space-y-6">
        {/* Organizer View Toggle - only shown when in player view as an organizer */}
        {queue.organizerId === currentUserId && showPlayerView && (
          <div className="bg-teal-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Organizer Mode</p>
                <p className="text-xs text-teal-100">You are viewing this session as a player.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPlayerView(false)}
              className="px-4 py-2 bg-white text-teal-600 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors shadow-sm"
            >
              Switch to Manager View
            </button>
          </div>
        )}

        {/* Event Details Card */}
        <QueueEventCard queue={queue} onBack={() => router.back()} />

        {/* Skill restriction warning should appear directly below event header */}
        {!isUserInQueue && isSkillMismatch && (
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-[0_4px_16px_rgba(239,68,68,0.10)]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">Bracket Mismatch</p>
                <p className="text-sm text-red-700 mt-1">
                  Your current level does not match this queue&apos;s bracket.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-white text-red-700 text-xs font-semibold px-2.5 py-1">
                    Your Level: {userSkillLevel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-white text-red-700 text-xs font-semibold px-2.5 py-1">
                    Required Bracket: {queue.minSkillLevel || 1}-{queue.maxSkillLevel || 10}
                  </span>
                </div>

              </div>
            </div>
          </div>
        )}


        {/* Queue Position Tracker (if in queue) */}
        {isUserInQueue && participant && (
          <QueuePositionTracker
            position={queue.userPosition!}
            totalPlayers={queue.currentPlayers}
            gamesPlayed={participant.games_played || 0}
            status={participant.status || 'waiting'}
          />
        )}

        {/* Match History Button (if in queue) */}
        {isUserInQueue && currentUserId && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowMatchHistory(true)}
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg hover:border-primary hover:text-primary transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              View Match History
            </button>
          </div>
        )}

        {/* Current Queue List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-lg">
              Players ({queue.players.length})
            </h3>
            <button
              onClick={refreshQueue}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {queue.players.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">No Players Yet</h4>
              <p className="text-sm text-gray-500">
                Be the first to join this queue!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Playing Section */}
              {queue.players.filter(p => p.status === 'playing').length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Currently Playing ({queue.players.filter(p => p.status === 'playing').length})
                  </h4>
                  <div className="space-y-2">
                    {queue.players.filter(p => p.status === 'playing').map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isCurrentUser={player.userId === currentUserId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting Section */}
              {queue.players.filter(p => p.status === 'waiting').length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Waiting ({queue.players.filter(p => p.status === 'waiting').length})
                  </h4>
                  <div className="space-y-2">
                    {queue.players.filter(p => p.status === 'waiting').map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isCurrentUser={player.userId === currentUserId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Join/Leave Queue Form - hidden from organizer */}
        {!isUserInQueue ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Join Queue</h3>

            {!isProfileCompleted || userSkillLevel === null ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <h4 className="font-semibold text-amber-900 mb-2">Complete Your Profile</h4>
                <p className="text-sm text-amber-700 mb-5">
                  You need to set up your player profile before you can join any queue sessions.
                </p>
                <Link
                  href="/setup-profile?from=queue&step=welcome"
                  className="inline-flex items-center justify-center w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                >
                  Set Up Profile Now
                </Link>
              </div>
            ) : timeUntilOpen !== null && timeUntilOpen > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-blue-900 mb-1">Queue Opens Soon</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Joining opens {queue.joinWindowHours ?? 2} hour{(queue.joinWindowHours ?? 2) === 1 ? '' : 's'} before the session starts.
                  </p>
                  <div className="text-2xl font-bold text-blue-600 font-mono">
                    {formatTime(timeUntilOpen)}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>You can join this queue starting at {format(subHours(new Date(queue.startTime), queue.joinWindowHours ?? 2), 'h:mm a')}</span>
                </div>
              </div>
            ) : (
              <>
                {joinError && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p>{joinError}</p>
                      {isRejoinCooldownActive && (
                        <p className="mt-1 font-semibold">You can rejoin in {formatCooldown(rejoinCooldownSeconds!)}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>You will be notified when it&apos;s your turn</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cancel anytime without penalty</span>
                  </div>
                </div>
                <button
                  onClick={handleJoinQueue}
                  disabled={isJoining || queue.players.length >= queue.maxPlayers || isSkillMismatch || isRejoinCooldownActive}
                  title={isSkillMismatch ? 'Skill level mismatch' : queue.players.length >= queue.maxPlayers ? 'Queue is full' : undefined}
                  className="hidden md:flex w-full bg-primary text-white py-3.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : queue.players.length >= queue.maxPlayers ? (
                    <span>Queue Full</span>
                  ) : isRejoinCooldownActive ? (
                    <span>Rejoin in {formatCooldown(rejoinCooldownSeconds!)}</span>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      <span>Join Queue</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Leave Queue</h3>

            {/* Outstanding balance warning */}
            {participant && participant.amount_owed > 0 && participant.payment_status !== 'paid' && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700">
                  You have an outstanding balance of <span className="font-bold">₱{participant.amount_owed.toFixed(2)}</span>. You must pay before leaving.
                </p>
              </div>
            )}

            {!(participant && participant.amount_owed > 0 && participant.payment_status !== 'paid') && (
              <p className="text-sm text-gray-600 mb-4">
                You&apos;re currently at position #{queue.userPosition}. You can leave anytime without penalty.
              </p>
            )}

            {showLeaveConfirm ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">You&apos;ll lose your position in the queue. Are you sure?</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveQueue}
                    disabled={isLeaving}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLeaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Yes, Leave
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleLeaveQueue}
                disabled={isLeaving || (participant && participant.amount_owed > 0 && participant.payment_status !== 'paid')}
                title={participant && participant.amount_owed > 0 && participant.payment_status !== 'paid' ? "Settle your balance before leaving" : "Leave this queue and lose your position"}
                className="hidden md:flex w-full border-2 border-red-300 text-red-600 py-3.5 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-2"
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Leaving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Leave Queue</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Game Assignment Placeholder */}
        {queue.currentMatch && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-green-900">Match Assigned!</h3>
                <p className="text-sm text-green-700">Your turn to play</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Court</span>
                <span className="font-semibold text-gray-900">{queue.currentMatch.courtName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Duration</span>
                <span className="font-semibold text-gray-900">{queue.currentMatch.duration} minutes</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Players</span>
                <span className="font-semibold text-gray-900">{queue.currentMatch.players.join(', ')}</span>
              </div>
            </div>

            <button className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
              Start Game
            </button>
          </div>
        )}

        {/* Mobile Bottom Bar - Fixed position for join/leave button */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
          {!isUserInQueue ? (
            <button
              onClick={handleJoinQueue}
              disabled={isJoining || queue.players.length >= queue.maxPlayers || isSkillMismatch || isRejoinCooldownActive}
              className="w-full bg-primary text-white py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : queue.players.length >= queue.maxPlayers ? (
                <span>Queue Full</span>
              ) : isRejoinCooldownActive ? (
                <span>Rejoin in {formatCooldown(rejoinCooldownSeconds!)}</span>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  <span>Join Queue</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              {participant && participant.amount_owed > 0 && participant.payment_status !== 'paid' && (
                <div className="flex items-center gap-2 text-orange-600 text-xs font-medium justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Outstanding balance: ₱{participant.amount_owed.toFixed(2)}</span>
                </div>
              )}
              <button
                onClick={handleLeaveQueue}
                disabled={isLeaving || (participant && participant.amount_owed > 0 && participant.payment_status !== 'paid')}
                title={participant && participant.amount_owed > 0 && participant.payment_status !== 'paid' ? "Settle your balance before leaving" : "Leave this queue and lose your position"}
                className="w-full border-2 border-red-300 text-red-600 py-4 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Leaving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Leave Queue</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>



        {/* Payment Required Modal */}
        {paymentRequiredInfo?.show && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Payment Required</h3>
                    <p className="text-sm text-gray-500">Settle your balance to leave the queue</p>
                  </div>
                </div>
                <button
                  onClick={() => { setPaymentRequiredInfo(null); setPaymentError(null) }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-orange-700">Amount Owed</span>
                  <span className="text-2xl font-bold text-orange-900">₱{paymentRequiredInfo.amountOwed.toFixed(2)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {paymentError}
                </div>
              )}

              <p className="text-sm text-gray-600 mb-4">Choose a payment method to settle your balance:</p>

              <div className="space-y-3">
                <button
                  onClick={() => handleQueuePayment('gcash')}
                  disabled={isInitiatingPayment}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#007DED' }}
                >
                  {isInitiatingPayment && selectedPaymentMethod === 'gcash' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      <span>Pay with GCash</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleQueuePayment('paymaya')}
                  disabled={isInitiatingPayment}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#34A853' }}
                >
                  {isInitiatingPayment && selectedPaymentMethod === 'paymaya' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      <span>Pay with Maya</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => { setPaymentRequiredInfo(null); setPaymentError(null) }}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
                >
                  Pay Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Match History Modal */}
        {showMatchHistory && isUserInQueue && currentUserId && queue && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:rounded-xl sm:max-w-lg max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Match History</h3>
                </div>
                <button
                  onClick={() => setShowMatchHistory(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-5">
                <MatchHistoryViewer
                  sessionId={queue.id}
                  userId={currentUserId}
                  courtId={courtId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
