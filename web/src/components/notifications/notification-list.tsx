'use client'

import { CheckCheck, Loader2 } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from './notification-item'

interface NotificationListProps {
  onClose: () => void
}

export function NotificationList({ onClose }: NotificationListProps) {
  const {
    notifications,
    unreadCount,
    loading,
    loadMoreLoading,
    hasMore,
    error,
    loadMore,
    markAsRead,
    markAllAsRead
  } = useNotifications()

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  return (
    <div className="flex flex-col max-h-[600px] w-96">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>

        {/* Mark All as Read Button */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List Container */}
      <div className="overflow-y-auto flex-1 min-h-[300px]">
        {loading && !loadMoreLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
            <p>No notifications yet</p>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onClose={onClose}
              />
            ))}
          </div>
        )}

        {/* Load More Button - "See previous notifications" */}
        {hasMore && (
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={loadMore}
              disabled={loadMoreLoading}
              className="w-full py-2 px-4 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loadMoreLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'See previous notifications'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onClose}
          className="w-full text-center text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}
