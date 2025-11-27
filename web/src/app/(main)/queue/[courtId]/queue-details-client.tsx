'use client'

import { useQueue } from '@/hooks/use-queue'
import { useQueueNotifications } from '@/hooks/use-queue-notifications'
import { QueueNotificationBanner } from '@/components/queue/queue-notification-banner'
import { PlayerCard } from '@/components/queue/player-card'
import { QueueStatusBadge } from '@/components/queue/queue-status-badge'
import { Users, Clock, Activity, Loader2, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QueueDetailsClientProps {
  courtId: string
}

export function QueueDetailsClient({ courtId }: QueueDetailsClientProps) {
  const { queue, isLoading, error, joinQueue, leaveQueue, refreshQueue } = useQueue(courtId)
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
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

  const handleJoinQueue = async () => {
    setIsJoining(true)
    await joinQueue()
    setIsJoining(false)
  }

  const handleLeaveQueue = async () => {
    setIsLeaving(true)
    await leaveQueue()
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
            <p className="text-gray-600 text-sm">{queue.venueName}</p>
          </div>
          <QueueStatusBadge status={queue.status} size="md" />
        </div>

        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-600">In Queue</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {queue.players.length}/{queue.maxPlayers}
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
              <span className="text-xs text-gray-600">Status</span>
            </div>
            <p className="text-lg font-bold text-gray-900 capitalize">
              {queue.status}
            </p>
          </div>
        </div>
      </div>

      {/* Your Position Card (if in queue) */}
      {isUserInQueue && (
        <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm mb-1">Your Position</p>
              <p className="text-5xl font-bold">#{queue.userPosition}</p>
            </div>
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Users className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/80 text-xs mb-1">Players Ahead</p>
              <p className="text-2xl font-bold">{playersAhead}</p>
            </div>
            <div>
              <p className="text-white/80 text-xs mb-1">Est. Wait Time</p>
              <p className="text-2xl font-bold">{queue.estimatedWaitTime}m</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Queue List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-lg">
            Players in Queue ({queue.players.length})
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
          <div className="space-y-3">
            {queue.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCurrentUser={player.userId === currentUserId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Join/Leave Queue Form */}
      {!isUserInQueue ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Join Queue</h3>
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
      </div>
    </>
  )
}
