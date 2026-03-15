'use client'

import { useMyQueues, useNearbyQueues, useMyQueueHistory, useQueueMasterHistory } from '@/hooks/use-queue'
import { useQueueNotifications } from '@/hooks/use-queue-notifications'
import { QueueNotificationBanner } from '@/components/queue/queue-notification-banner'
import { QueueCard } from '@/components/queue/queue-card'
import { QueueHistoryList } from '@/components/queue/queue-history-list'
import { Users, MapPin, Loader2, Activity, Clock, History, FolderOpen, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { formatCurrency } from '@rallio/shared/utils'

export function QueueDashboardClient() {
  const { queues: myQueues, isLoading: loadingMy } = useMyQueues()
  const { queues: nearbyQueues, isLoading: loadingNearby } = useNearbyQueues()
  const { history: myHistory, isLoading: loadingHistory } = useMyQueueHistory()
  const [isQueueMaster, setIsQueueMaster] = useState(false)
  const [isRoleLoading, setIsRoleLoading] = useState(true)
  const { history: sessionHistory, isLoading: loadingSessionHistory } = useQueueMasterHistory(isQueueMaster)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'session'>('active')
  const supabase = createClient()

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      if (!user) {
        setIsQueueMaster(false)
        setIsRoleLoading(false)
        return
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner (
            name
          )
        `)
        .eq('user_id', user.id)

      const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master') || false
      setIsQueueMaster(hasQueueMasterRole)
      setIsRoleLoading(false)
    }
    getCurrentUser()
  }, [])

  // Set up notifications for the first active queue
  const activeQueues = myQueues.filter(q => q.status === 'active' || q.status === 'waiting')
  const primaryQueue = activeQueues.length > 0 ? activeQueues[0] : null
  const { notifications, dismissNotification } = useQueueNotifications(primaryQueue, currentUserId)

  useEffect(() => {
    if (!isQueueMaster && activeTab === 'session') {
      setActiveTab('active')
    }
  }, [isQueueMaster, activeTab])

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

            <div className={`bg-white border rounded-xl p-4 col-span-2 md:col-span-1 ${totalAmountOwed > 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalAmountOwed > 0 ? 'bg-orange-200' : 'bg-green-50'
                  }`}>
                  <Clock className={`w-4 h-4 ${totalAmountOwed > 0 ? 'text-orange-700' : 'text-green-600'
                    }`} />
                </div>
                <span className="text-xs text-gray-600 font-medium">Outstanding Balance</span>
              </div>
              <p className={`text-2xl font-bold ${totalAmountOwed > 0 ? 'text-orange-700' : 'text-gray-900'
                }`}>
                ₱{totalAmountOwed.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Active Queues
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          {!isRoleLoading && isQueueMaster && (
            <button
              onClick={() => setActiveTab('session')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'session'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <FolderOpen className="w-4 h-4" />
              Session
            </button>
          )}
        </div>

        {activeTab === 'active' ? (
          <>
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
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {myQueues.map((queue) => (
                    <div key={queue.id} className="max-w-[380px]">
                      <QueueCard queue={queue} variant="active" />
                    </div>
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
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {nearbyQueues.map((queue) => (
                    <div key={queue.id} className="max-w-[380px]">
                      <QueueCard queue={queue} variant="available" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'history' ? (
          /* History Tab */
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Queue History</h2>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <QueueHistoryList history={myHistory} />
            )}
          </section>
        ) : (
          /* Queue Master Session Tab */
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-teal-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Past Queue Sessions</h2>
            </div>

            {loadingSessionHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : sessionHistory.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Past Sessions</h3>
                <p className="text-sm text-gray-500">Your completed queue sessions will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {sessionHistory.map((session: any) => (
                  <Link
                    key={session.id}
                    href={`/queue/${session.id}`}
                    className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{session.courtName}</h3>
                        <p className="text-sm text-gray-500">{session.venueName}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 capitalize">
                        {session.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">{format(new Date(session.startTime), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="font-medium text-gray-900">{formatCurrency(Number(session.totalRevenue || 0))}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-teal-600" />
                        {session.totalGames || 0} games
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        Max {session.maxPlayers || 0} players
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

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
            </li>
          </ul>
        </div>
      </div>
    </>
  )
}
