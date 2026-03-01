'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notification-actions'
import type { Notification } from '@/types/notifications'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [offset, setOffset] = useState(0)
  const supabase = createClient()

  const LIMIT = 10

  // Fetch notifications
  const fetchNotifications = async (initial = true) => {
    if (initial) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadMoreLoading(true)
    }

    setError(null)

    try {
      const currentOffset = initial ? 0 : offset + LIMIT
      const [notificationsResult, countResult] = await Promise.all([
        getNotifications(LIMIT, currentOffset, filter),
        initial ? getUnreadCount() : Promise.resolve({ success: true, count: unreadCount })
      ])

      if (notificationsResult.success && notificationsResult.notifications) {
        if (initial) {
          setNotifications(notificationsResult.notifications)
        } else {
          setNotifications(prev => [...prev, ...notificationsResult.notifications!])
          setOffset(currentOffset)
        }
        setHasMore(notificationsResult.notifications.length === LIMIT)
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
      setLoadMoreLoading(false)
    }
  }

  // Load more notifications
  const loadMore = () => {
    if (!hasMore || loadMoreLoading) return
    fetchNotifications(false)
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

      // If we're on unread filter, remove it from the list
      if (filter === 'unread') {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
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

      if (filter === 'unread') {
        setNotifications([])
        setHasMore(false)
      }
    }

    return result
  }

  // Refresh notifications
  const refresh = () => {
    fetchNotifications(true)
  }

  // Change filter
  useEffect(() => {
    fetchNotifications(true)
  }, [filter])

  // Set up real-time subscription
  useEffect(() => {
    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const newNotification = payload.new as Notification

          const { data: { user } } = await supabase.auth.getUser()
          if (user && newNotification.user_id === user.id) {
            setNotifications(prev => [newNotification, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const updatedNotification = payload.new as Notification

          const { data: { user } } = await supabase.auth.getUser()
          if (user && updatedNotification.user_id === user.id) {
            setNotifications(prev =>
              prev.map(n =>
                n.id === updatedNotification.id ? updatedNotification : n
              )
            )

            // Recalculate unread count
            const result = await getUnreadCount()
            if (result.success) {
              setUnreadCount(result.count || 0)
            }
          }
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
    loadMoreLoading,
    hasMore,
    error,
    filter,
    setFilter,
    loadMore,
    markAsRead,
    markAllAsRead,
    refresh
  }
}
