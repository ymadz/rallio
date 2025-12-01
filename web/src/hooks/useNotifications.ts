'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notification-actions'
import type { Notification } from '@/types/notifications'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Fetch initial notifications
  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)

    try {
      const [notificationsResult, countResult] = await Promise.all([
        getNotifications(50),
        getUnreadCount()
      ])

      if (notificationsResult.success && notificationsResult.notifications) {
        setNotifications(notificationsResult.notifications)
      } else {
        setError(notificationsResult.error || 'Failed to load notifications')
      }

      if (countResult.success) {
        setUnreadCount(countResult.count || 0)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Mark a single notification as read
  const markAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId)

    if (result.success) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    return result
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const result = await markAllNotificationsAsRead()

    if (result.success) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    }

    return result
  }

  // Refresh notifications
  const refresh = () => {
    fetchNotifications()
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification

          // Get current user ID from the payload
          // Only add if it's for the current user
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && newNotification.user_id === user.id) {
              setNotifications(prev => [newNotification, ...prev])
              setUnreadCount(prev => prev + 1)
            }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const updatedNotification = payload.new as Notification

          setNotifications(prev =>
            prev.map(n =>
              n.id === updatedNotification.id ? updatedNotification : n
            )
          )

          // Recalculate unread count
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && updatedNotification.user_id === user.id) {
              getUnreadCount().then(result => {
                if (result.success) {
                  setUnreadCount(result.count || 0)
                }
              })
            }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const deletedId = payload.old.id

          setNotifications(prev => prev.filter(n => n.id !== deletedId))

          // Recalculate unread count
          getUnreadCount().then(result => {
            if (result.success) {
              setUnreadCount(result.count || 0)
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh
  }
}
