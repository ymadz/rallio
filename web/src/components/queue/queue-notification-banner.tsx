'use client'

import { Bell, X, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { QueueNotification } from '@/hooks/use-queue-notifications'

interface QueueNotificationBannerProps {
  notifications: QueueNotification[]
  onDismiss: (notificationId: string) => void
}

/**
 * Queue notification banner that appears at the top of pages
 * Shows when user's turn is coming up or position changes
 *
 * Connected to useQueueNotifications hook for real-time updates
 */
export function QueueNotificationBanner({ notifications, onDismiss }: QueueNotificationBannerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 pt-4 md:top-20 pointer-events-none">
      <div className="container mx-auto max-w-4xl space-y-2 pointer-events-auto">
        {notifications.map((notification) => {
          // Determine styling based on notification type
          const isUrgent = notification.type === 'turn-now'
          const bgClass = isUrgent
            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
            : 'bg-gradient-to-r from-primary to-primary/80'

          const icon = isUrgent ? (
            <AlertCircle className="w-5 h-5" />
          ) : notification.type === 'turn-soon' ? (
            <Clock className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )

          return (
            <div
              key={notification.id}
              className={`${bgClass} text-white rounded-xl p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-top duration-300`}
              role="alert"
              aria-live="assertive"
            >
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-white">
                    {notification.title}
                  </h4>
                  <button
                    onClick={() => onDismiss(notification.id)}
                    className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-white/90 mb-2">
                  {notification.message}
                </p>

                <div className="flex items-center gap-4 text-xs text-white/80">
                  <span>{notification.courtName}</span>
                  <span>•</span>
                  <span>{notification.venueName}</span>
                </div>
              </div>

              <Link
                href={`/queue/${notification.courtId}`}
                className="px-4 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-white/90 transition-colors text-sm whitespace-nowrap flex-shrink-0 self-center"
              >
                {isUrgent ? 'Go to Court' : 'View Queue'}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
