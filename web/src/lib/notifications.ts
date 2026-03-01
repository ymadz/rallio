/**
 * Notification Service
 * Centralized service for creating and sending notifications to users
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

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
  | 'refund_requested'
  | 'refund_approved'
  | 'refund_rejected'
  | 'booking_rejected'
  | 'new_booking_request'
  | 'system_announcement'

interface NotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  metadata?: Record<string, any>
}

/**
 * Create a notification for a user
 * Uses service client to bypass RLS since this is a system operation
 */
export async function createNotification(data: NotificationData) {
  const supabase = createServiceClient()

  try {
    const insertData: any = {
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      action_url: data.actionUrl,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    // Only add metadata if it's provided
    if (data.metadata) {
      insertData.metadata = data.metadata
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Fallback: If metadata column is missing, try without it
      if (error.message?.includes("metadata") && error.message?.includes("column") && data.metadata) {
        console.warn('⚠️ [createNotification] Metadata column missing, retrying without metadata')
        const { metadata, ...dataWithoutMetadata } = insertData
        const { data: retryData, error: retryError } = await supabase
          .from('notifications')
          .insert(dataWithoutMetadata)
          .select()
          .single()

        if (retryError) {
          console.error('❌ [createNotification] Retry failed:', retryError)
          return { success: false, error: retryError.message }
        }
        return { success: true, notification: retryData }
      }

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
 * Create notifications for multiple users (bulk)
 */
export async function createBulkNotifications(notifications: NotificationData[]) {
  const supabase = createServiceClient()

  try {
    const insertData = notifications.map(n => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      action_url: n.actionUrl,
      metadata: n.metadata,
      is_read: false,
      created_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()

    if (error) {
      // Fallback: If metadata column is missing, try without it
      if (error.message?.includes("metadata") && error.message?.includes("column")) {
        console.warn('⚠️ [createBulkNotifications] Metadata column missing, retrying without metadata')
        const dataWithoutMetadata = insertData.map(({ metadata, ...rest }) => rest)
        const { data: retryData, error: retryError } = await supabase
          .from('notifications')
          .insert(dataWithoutMetadata)
          .select()

        if (retryError) {
          console.error('❌ [createBulkNotifications] Retry failed:', retryError)
          return { success: false, error: retryError.message }
        }
        return { success: true, notifications: retryData }
      }

      console.error('❌ [createBulkNotifications] Error:', error)
      return { success: false, error: error.message }
    }

    console.log(`✅ [createBulkNotifications] Created ${data.length} notifications`)
    return { success: true, notifications: data }
  } catch (error: any) {
    console.error('❌ [createBulkNotifications] Exception:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================
// NOTIFICATION TEMPLATES
// Templates for common notification scenarios
// ============================================================

export const NotificationTemplates = {
  /**
   * Booking confirmed notification
   */
  bookingConfirmed: (venueName: string, courtName: string, date: string, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'booking_confirmed',
    title: '🎉 Booking Confirmed!',
    message: `Your booking at ${venueName} (${courtName}) for ${date} is confirmed.`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { booking_id: bookingId, venue_name: venueName, court_name: courtName },
  }),

  /**
   * Payment received notification
   */
  paymentReceived: (amount: number, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'payment_received',
    title: '💳 Payment Received',
    message: `We've received your payment of ₱${amount.toFixed(2)}. Thank you!`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { amount, booking_id: bookingId },
  }),

  /**
   * Match assigned in queue
   */
  queueMatchAssigned: (matchNumber: number, courtName: string, queueSessionId: string, matchId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_match_assigned',
    title: '🏸 Your Match is Ready!',
    message: `You've been assigned to Match #${matchNumber} on ${courtName}. Get ready to play!`,
    actionUrl: `/queue/${queueSessionId}/match/${matchId}`,
    metadata: { match_number: matchNumber, court_name: courtName, queue_session_id: queueSessionId, match_id: matchId },
  }),

  /**
   * Queue session starting soon
   */
  queueSessionStarting: (venueName: string, courtName: string, startTime: string, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_session_starting',
    title: '⏰ Queue Session Starting Soon',
    message: `Your queue session at ${venueName} (${courtName}) starts at ${startTime}. Don't be late!`,
    actionUrl: `/queue/${queueSessionId}`,
    metadata: { venue_name: venueName, court_name: courtName, start_time: startTime, queue_session_id: queueSessionId },
  }),

  /**
   * Queue session ended
   */
  queueSessionEnded: (venueName: string, gamesPlayed: number, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_session_ended',
    title: '🏁 Queue Session Ended',
    message: `The queue session at ${venueName} has ended. You played ${gamesPlayed} ${gamesPlayed === 1 ? 'game' : 'games'}. Great job!`,
    actionUrl: `/queue/${queueSessionId}`,
    metadata: { venue_name: venueName, games_played: gamesPlayed, queue_session_id: queueSessionId },
  }),

  /**
   * Queue payment due
   */
  queuePaymentDue: (amountDue: number, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_payment_due',
    title: '💰 Payment Due',
    message: `You have an outstanding balance of ₱${amountDue.toFixed(2)} from your queue session. Please pay to continue playing.`,
    actionUrl: `/queue/${queueSessionId}`,
    metadata: { amount_due: amountDue, queue_session_id: queueSessionId },
  }),

  /**
   * Queue approval pending (for Court Admin)
   */
  queueApprovalPending: (queueMasterName: string, courtName: string, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_approval_pending',
    title: '📋 New Queue Session Pending Approval',
    message: `${queueMasterName} has requested to create a queue session on ${courtName}. Review and approve or reject.`,
    actionUrl: `/court-admin/queue-approvals`,
    metadata: { queue_master_name: queueMasterName, court_name: courtName, queue_session_id: queueSessionId },
  }),

  /**
   * Queue approval approved (for Queue Master)
   */
  queueApprovalApproved: (courtName: string, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_approval_approved',
    title: '✅ Queue Session Approved!',
    message: `Your queue session on ${courtName} has been approved and is now live. Participants can start joining!`,
    actionUrl: `/queue-master/sessions/${queueSessionId}`,
    metadata: { court_name: courtName, queue_session_id: queueSessionId },
  }),

  /**
   * Queue approval rejected (for Queue Master)
   */
  queueApprovalRejected: (courtName: string, reason: string, queueSessionId: string): Omit<NotificationData, 'userId'> => ({
    type: 'queue_approval_rejected',
    title: '❌ Queue Session Rejected',
    message: `Your queue session on ${courtName} was not approved. Reason: ${reason}`,
    actionUrl: `/queue-master/sessions/${queueSessionId}`,
    metadata: { court_name: courtName, reason, queue_session_id: queueSessionId },
  }),

  /**
   * Review received (for Court Admin)
   */
  reviewReceived: (rating: number, venueName: string, courtName: string): Omit<NotificationData, 'userId'> => ({
    type: 'review_received',
    title: '⭐ New Review Received',
    message: `You received a ${rating}-star review for ${courtName} at ${venueName}.`,
    actionUrl: `/court-admin/reviews`,
    metadata: { rating, venue_name: venueName, court_name: courtName },
  }),

  /**
   * Refund processed
   */
  refundProcessed: (amount: number, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'refund_processed',
    title: '💵 Refund Processed',
    message: `Your refund of ₱${amount.toFixed(2)} has been processed and will be credited to your account within 5-7 business days.`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { amount, booking_id: bookingId },
  }),

  /**
   * New booking request notification (for Court Admin)
   */
  newBookingRequest: (venueName: string, courtName: string, date: string, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'new_booking_request',
    title: '🆕 New Booking Request',
    message: `New booking at ${venueName} (${courtName}) for ${date}. Review and approve.`,
    actionUrl: `/court-admin/reservations`,
    metadata: { booking_id: bookingId, venue_name: venueName, court_name: courtName },
  }),

  /**
   * Booking rejected notification
   */
  bookingRejected: (venueName: string, courtName: string, reason: string, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'booking_rejected',
    title: '❌ Booking Rejected',
    message: `Your booking at ${venueName} (${courtName}) was rejected. Reason: ${reason}`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { booking_id: bookingId, venue_name: venueName, court_name: courtName, reason },
  }),

  /**
   * Refund requested notification (for Court Admin)
   */
  refundRequested: (amount: number, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'refund_requested',
    title: '💵 Refund Request Received',
    message: `A refund of ₱${(amount / 100).toFixed(2)} has been requested for booking #${bookingId.slice(0, 8)}.`,
    actionUrl: `/court-admin/refunds`,
    metadata: { amount, booking_id: bookingId },
  }),

  /**
   * Refund approved notification
   */
  refundApproved: (amount: number, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'refund_approved',
    title: '✅ Refund Approved',
    message: `Your refund of ₱${(amount / 100).toFixed(2)} for booking #${bookingId.slice(0, 8)} has been approved.`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { amount, booking_id: bookingId },
  }),

  /**
   * Refund rejected notification
   */
  refundRejected: (reason: string, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'refund_rejected',
    title: '❌ Refund Rejected',
    message: `Your refund request for booking #${bookingId.slice(0, 8)} was rejected. Reason: ${reason}`,
    actionUrl: `/bookings/${bookingId}`,
    metadata: { reason, booking_id: bookingId },
  }),

  /**
   * User cancelled booking (for Court Admin)
   */
  userCancelledBookingForAdmin: (userName: string, venueName: string, courtName: string, date: string, bookingId: string): Omit<NotificationData, 'userId'> => ({
    type: 'booking_cancelled',
    title: '🗑️ Booking Cancelled by User',
    message: `${userName} has cancelled their booking at ${venueName} (${courtName}) for ${date}.`,
    actionUrl: `/court-admin/reservations`,
    metadata: { booking_id: bookingId, user_name: userName, venue_name: venueName, court_name: courtName },
  }),
}
