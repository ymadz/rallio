'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Notification } from '@/types/notifications'

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
