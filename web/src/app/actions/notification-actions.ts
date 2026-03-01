'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Notification } from '@/types/notifications'

export type NotificationType = 
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'queue_match_assigned'
  | 'queue_session_starting'
  | 'queue_session_ended'
  | 'queue_payment_due'
  | 'review_received'
  | 'queue_approval_pending'
  | 'queue_approval_approved'
  | 'queue_approval_rejected'
  | 'refund_processed'
  | 'system_announcement'

interface CreateNotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  metadata?: Record<string, any>
}

/**
 * Create a notification for a user (server action)
 * Uses service client to bypass RLS since this is a system operation
 */
export async function createNotification(data: CreateNotificationData) {
  const supabase = createServiceClient()

  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        action_url: data.actionUrl,
        metadata: data.metadata,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [createNotification] Error:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ [createNotification] Created:', notification.id, 'for user:', data.userId)
    return { success: true, notification }
  } catch (error: any) {
    console.error('❌ [createNotification] Exception:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all notifications for the current user
 */
export async function getNotifications(limit: number = 50) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, notifications: notifications as Notification[] }
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) throw error

    return { success: true, count: count || 0 }
  } catch (error: any) {
    console.error('Error fetching unread count:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error marking notification as read:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) throw error

    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting notification:', error)
    return { success: false, error: error.message }
  }
}
