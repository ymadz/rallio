'use client'

import { useQueue } from '@/hooks/use-queue'
import { useQueueNotifications } from '@/hooks/use-queue-notifications'
import { useMatchNotifications } from '@/hooks/use-match-notifications'
import { QueueNotificationBanner } from '@/components/queue/queue-notification-banner'
import { PlayerCard } from '@/components/queue/player-card'
import { QueueStatusBadge } from '@/components/queue/queue-status-badge'
import { QueuePositionTracker } from '@/components/queue/queue-position-tracker'
import { PaymentSummaryWidget } from '@/components/queue/payment-summary-widget'
import { MatchHistoryViewer } from '@/components/queue/match-history-viewer'

import { Users, Clock, Activity, Loader2, AlertCircle, Trophy, Calendar } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { differenceInSeconds, subHours, isBefore, format } from 'date-fns'
import { useServerTime } from '@/hooks/use-server-time'

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

  const [timeUntilOpen, setTimeUntilOpen] = useState<number | null>(null)

  // Timer effect
  useEffect(() => {
    if (!queue?.startTime) return

    const updateTimer = () => {
      const startTime = new Date(queue.startTime)
      const openTime = subHours(startTime, 2)
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

  const [showMatchHistory, setShowMatchHistory] = useState(false)
  const [paymentRequiredInfo, setPaymentRequiredInfo] = useState<{
    show: boolean
    amountOwed: number
    gamesPlayed: number
  } | null>(null)
  const supabase = createClient()

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  // Initialize notification system
  const { notifications, dismissNotification } = useQueueNotifications(queue, currentUserId)

  // Enable match assignment notifications
  const { activeMatch } = useMatchNotifications(currentUserId || undefined)

  // Fetch participant details when queue loads
  useEffect(() => {
    const fetchParticipant = async () => {
      if (!queue?.id || !currentUserId) return

      try {
        const { data, error } = await supabase
          .from('queue_participants')
          .select('*')
          .eq('queue_session_id', queue.id)
          .eq('user_id', currentUserId)
          .is('left_at', null)
          .single()

        if (!error && data) {
          setParticipant(data)
        }
      } catch (err) {
        console.error('Error fetching participant:', err)
      }
    }

    fetchParticipant()
  }, [queue?.id, currentUserId])



  const handleJoinQueue = async () => {
    setIsJoining(true)
    await joinQueue()
    setIsJoining(false)
  }

  const handleLeaveQueue = async () => {
    setIsLeaving(true)
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

  const isUserInQueue = queue.userPosition !== null
  const playersAhead = isUserInQueue ? queue.userPosition! - 1 : 0

  return (
    <>
      {/* Notification Banner */}
      <QueueNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* Active Match Alert */}
      {activeMatch && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-green-900 text-lg">You Have an Active Match!</h3>
                <p className="text-sm text-green-700">Match #{activeMatch.match_number} is ready</p>
              </div>
            </div>
            <Link
              href={`/queue/${courtId}/match/${activeMatch.id}`}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
            >
              View Match
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Court Info Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {queue.courtName}
                </h2>
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  #{queue.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">{queue.venueName}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(queue.startTime), 'EEEE, MMM d')} • {format(new Date(queue.startTime), 'h:mm a')} - {queue.endTime ? format(new Date(queue.endTime), 'h:mm a') : '...'}
                </span>
              </div>
            </div>
            <QueueStatusBadge status={queue.status} size="md" />
          </div>

          {/* Queue Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600">Waiting</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {queue.players.filter(p => p.status === 'waiting').length}/{queue.maxPlayers}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600">Est. Wait</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                ~{queue.estimatedWaitTime}m
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600">Playing</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {queue.players.filter(p => p.status === 'playing').length}
              </p>
            </div>
          </div>
        </div>

        {/* Queue Position Tracker (if in queue) */}
        {isUserInQueue && participant && (
          <QueuePositionTracker
            position={queue.userPosition!}
            totalPlayers={queue.currentPlayers}
            estimatedWaitTime={queue.estimatedWaitTime}
            gamesPlayed={participant.games_played || 0}
            status={participant.status || 'waiting'}
          />
        )}

        {/* Payment Summary Widget (if amount owed) */}
        {isUserInQueue && participant && participant.amount_owed > 0 && queue && (
          <PaymentSummaryWidget
            participantId={participant.id}
            amountOwed={participant.amount_owed}
            gamesPlayed={participant.games_played || 0}
            costPerGame={parseFloat((queue as any).cost_per_game || '0')}
            paymentStatus={participant.payment_status || 'pending'}
            courtId={courtId}
          />
        )}

        {/* Match History Toggle (if in queue) */}
        {isUserInQueue && currentUserId && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowMatchHistory(!showMatchHistory)}
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg hover:border-primary hover:text-primary transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              {showMatchHistory ? 'Hide Match History' : 'View Match History'}
            </button>
          </div>
        )}

        {/* Match History Viewer */}
        {showMatchHistory && isUserInQueue && currentUserId && queue && (
          <MatchHistoryViewer
            sessionId={queue.id}
            userId={currentUserId}
            courtId={courtId}
          />
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

        {/* Join/Leave Queue Form */}


        {/* Join/Leave Queue Form */}
        {!isUserInQueue ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Join Queue</h3>

            {timeUntilOpen !== null && timeUntilOpen > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-blue-900 mb-1">Queue Opens Soon</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Joining opens 2 hours before the session starts.
                  </p>
                  <div className="text-2xl font-bold text-blue-600 font-mono">
                    {formatTime(timeUntilOpen)}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>You can join this queue starting at {format(subHours(new Date(queue.startTime), 2), 'h:mm a')}</span>
                </div>
              </div>
            ) : (
              <>
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
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Estimated wait: ~{queue.estimatedWaitTime} minutes</span>
                  </div>
                </div>
                <button
                  onClick={handleJoinQueue}
                  disabled={isJoining || queue.players.length >= queue.maxPlayers}
                  className="w-full bg-primary text-white py-3.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : queue.players.length >= queue.maxPlayers ? (
                    <span>Queue Full</span>
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
            <p className="text-sm text-gray-600 mb-4">
              You&apos;re currently at position #{queue.userPosition}. You can leave anytime without penalty.
            </p>
            <button
              onClick={handleLeaveQueue}
              disabled={isLeaving}
              className="w-full border-2 border-red-300 text-red-600 py-3.5 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              disabled={isJoining || queue.players.length >= queue.maxPlayers}
              className="w-full bg-primary text-white py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : queue.players.length >= queue.maxPlayers ? (
                <span>Queue Full</span>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  <span>Join Queue</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleLeaveQueue}
              disabled={isLeaving}
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
          )}
        </div>



        {/* Payment Required Modal */}
        {paymentRequiredInfo?.show && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Payment Required</h3>
                  <p className="text-sm text-gray-500">You must settle your balance before leaving</p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-orange-700">Games Played</span>
                  <span className="font-semibold text-orange-900">{paymentRequiredInfo.gamesPlayed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-orange-700">Amount Owed</span>
                  <span className="text-xl font-bold text-orange-900">₱{paymentRequiredInfo.amountOwed.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Please pay your outstanding balance to the Queue Master before leaving the queue.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentRequiredInfo(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Close
                </button>
                {participant && (
                  <Link
                    href="#payment-widget"
                    onClick={() => setPaymentRequiredInfo(null)}
                    className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-center"
                  >
                    Pay Now
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
