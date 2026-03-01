'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  PhilippinePeso,
  Calendar,
  Star,
  Bell
} from 'lucide-react'
import type { Notification } from '@/types/notifications'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onClose: () => void
}

// Map notification types to icons and colors
const notificationConfig: Record<string, { icon: any; color: string }> = {
  reservation_approved: { icon: CheckCircle, color: 'text-green-600' },
  reservation_rejected: { icon: XCircle, color: 'text-red-600' },
  reservation_cancelled: { icon: AlertCircle, color: 'text-orange-600' },
  queue_approval_request: { icon: Bell, color: 'text-blue-600' },
  queue_approval_approved: { icon: CheckCircle, color: 'text-green-600' },
  queue_approval_rejected: { icon: XCircle, color: 'text-red-600' },
  payment_received: { icon: PhilippinePeso, color: 'text-green-600' },
  match_scheduled: { icon: Calendar, color: 'text-blue-600' },
  rating_received: { icon: Star, color: 'text-yellow-600' },
  general: { icon: Bell, color: 'text-gray-600' },
}

export function NotificationItem({ notification, onMarkAsRead, onClose }: NotificationItemProps) {
  const router = useRouter()
  const config = notificationConfig[notification.type] || notificationConfig.general
  const Icon = config.icon

  const handleClick = () => {
    // Mark as read
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }

    // Navigate to action URL if exists
    if (notification.action_url) {
      router.push(notification.action_url)
      onClose()
    }
  }

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
        !notification.is_read ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-medium text-gray-900 ${!notification.is_read ? 'font-semibold' : ''}`}>
            {notification.title}
          </p>

          {/* Message */}
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {notification.message}
          </p>

          {/* Time */}
          <p className="text-xs text-gray-500 mt-2">
            {timeAgo}
          </p>
        </div>

        {/* Unread Indicator */}
        {!notification.is_read && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          </div>
        )}
      </div>
    </button>
  )
}
