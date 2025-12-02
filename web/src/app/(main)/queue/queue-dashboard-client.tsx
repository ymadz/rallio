'use client'

import { useMyQueues, useNearbyQueues } from '@/hooks/use-queue'
import { useQueueNotifications } from '@/hooks/use-queue-notifications'
import { QueueNotificationBanner } from '@/components/queue/queue-notification-banner'
import { QueueCard } from '@/components/queue/queue-card'
import { Users, MapPin, Loader2, Activity, Clock } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function QueueDashboardClient() {
  const { queues: myQueues, isLoading: loadingMy } = useMyQueues()
  const { queues: nearbyQueues, isLoading: loadingNearby } = useNearbyQueues()
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

  // Set up notifications for the first active queue
  const activeQueues = myQueues.filter(q => q.status === 'active' || q.status === 'waiting')
  const primaryQueue = activeQueues.length > 0 ? activeQueues[0] : null
  const { notifications, dismissNotification } = useQueueNotifications(primaryQueue, currentUserId)

  if (loadingMy || loadingNearby) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const totalGamesPlayed = activeQueues.reduce((sum, q) => sum + (q.userGamesPlayed || 0), 0)
  const totalAmountOwed = activeQueues.reduce((sum, q) => sum + (q.userAmountOwed || 0), 0)

  return (
    <>
      {/* Notification Banner */}
      <QueueNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      <div className="space-y-6">
      {/* Quick Stats - Only show if user has active queues */}
      {activeQueues.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-gray-600 font-medium">Active Queues</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activeQueues.length}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs text-gray-600 font-medium">Games Played</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {totalGamesPlayed}
            </p>
          </div>

          <div className={`bg-white border rounded-xl p-4 col-span-2 md:col-span-1 ${
            totalAmountOwed > 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                totalAmountOwed > 0 ? 'bg-orange-200' : 'bg-green-50'
              }`}>
                <Clock className={`w-4 h-4 ${
                  totalAmountOwed > 0 ? 'text-orange-700' : 'text-green-600'
                }`} />
              </div>
              <span className="text-xs text-gray-600 font-medium">Outstanding Balance</span>
            </div>
            <p className={`text-2xl font-bold ${
              totalAmountOwed > 0 ? 'text-orange-700' : 'text-gray-900'
            }`}>
              ₱{totalAmountOwed.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Your Active Queues */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Your Active Queues</h2>
            {activeQueues.length > 0 && (
              <span className="px-2 py-0.5 bg-primary text-white text-xs font-bold rounded-full">
                {activeQueues.length}
              </span>
            )}
          </div>
        </div>

        {myQueues.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Active Queues</h3>
            <p className="text-sm text-gray-500 mb-4">
              You&apos;re not currently waiting in any queues. Browse courts below or explore venues to join a queue!
            </p>
            <Link
              href="/courts"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Courts
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {myQueues.map((queue) => (
              <QueueCard key={queue.id} queue={queue} variant="active" />
            ))}
          </div>
        )}
      </section>

      {/* Available Queues Near You */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Available Queues Near You</h2>
        </div>

        {nearbyQueues.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Nearby Queues</h3>
            <p className="text-sm text-gray-500">
              There are no active queues near your location at the moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {nearbyQueues.map((queue) => (
              <QueueCard key={queue.id} queue={queue} variant="available" />
            ))}
          </div>
        )}
      </section>

      {/* Quick Tips */}
      <div className="bg-gradient-to-br from-primary/5 to-blue-50 border border-primary/20 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Queue Tips</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>You&apos;ll be notified when it&apos;s your turn to play</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>You can leave the queue anytime without penalty</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Wait times are estimates based on average game duration</span>
          </li>
        </ul>
      </div>
      </div>
    </>
  )
}
