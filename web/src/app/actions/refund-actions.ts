'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createRefund, getRefund, getPayment } from '@/lib/paymongo'
import { createNotification, NotificationTemplates } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import type { RefundReason } from '@/lib/paymongo/types'
import { writeAuditLog } from '@/lib/audit'

// =============================================
// TYPES
// =============================================

export interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

export interface RefundRequestParams {
  reservationId: string
  reason: string
  reasonCode?: RefundReason
}

export interface RefundSummary {
  totalPaid: number
  totalRefunded: number
  pendingRefunds: number
  refundableAmount: number
}

// =============================================
// REFUND ACTIONS
// =============================================

/**
 * Request a refund for a paid reservation
 * Users can request refunds for their own reservations
 */
export async function requestRefundAction(params: RefundRequestParams): Promise<RefundResult> {
  console.log('🔄 [requestRefundAction] Starting refund request:', params)

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get reservation with payment details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        courts (
          name,
          venues (
            id,
            name,
            owner_id
          )
        )
      `)
      .eq('id', params.reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('❌ [requestRefundAction] Reservation not found:', reservationError)
      return { success: false, error: 'Reservation not found' }
    }

    // Verify user owns this reservation
    if (reservation.user_id !== user.id) {
      return { success: false, error: 'Not authorized to request refund for this reservation' }
    }

    // Check reservation status allows refunds
    const refundableStatuses = ['confirmed', 'pending_payment', 'partially_paid']
    if (!refundableStatuses.includes(reservation.status)) {
      return {
        success: false,
        error: `Cannot refund reservation with status: ${reservation.status}`
      }
    }

    // DEBUG: Get ALL payments for this reservation to see what's going on
    const { data: allPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', params.reservationId)

    console.log('🔍 [requestRefundAction] DEBUG: All payments for reservation:', {
      reservationId: params.reservationId,
      count: allPayments?.length,
      statuses: allPayments?.map(p => p.status),
      ids: allPayments?.map(p => p.id)
    })

    // Get successful payments for this reservation
    let { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', params.reservationId)
      .in('status', ['paid', 'completed'])

    // FALLBACK: If no direct payments, check for recurring group payments
    if ((!payments || payments.length === 0) && reservation.recurrence_group_id) {
      console.log('🔍 [requestRefundAction] No direct payment found, checking recurrence group:', reservation.recurrence_group_id)

      const { data: groupPayments, error: groupError } = await supabase
        .from('payments')
        .select('*')
        .contains('metadata', { recurrence_group_id: reservation.recurrence_group_id })
        .in('status', ['paid', 'completed'])

      if (groupPayments && groupPayments.length > 0) {
        console.log('✅ [requestRefundAction] Found group payment:', groupPayments[0].id)
        payments = groupPayments
        paymentsError = groupError
      }
    }


    if (paymentsError || !payments || payments.length === 0) {
      console.error('❌ [requestRefundAction] No paid payments found:', paymentsError)
      console.error('❌ [requestRefundAction] Payments found (any status):', allPayments)
      return { success: false, error: 'No payments found to refund' }
    }

    // Check for existing pending refunds
    const { data: existingRefunds } = await supabase
      .from('refunds')
      .select('*')
      .eq('reservation_id', params.reservationId)
      .in('status', ['pending', 'processing'])

    if (existingRefunds && existingRefunds.length > 0) {
      return { success: false, error: 'A refund request is already pending for this reservation' }
    }

    // Calculate refundable amount
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    const { data: completedRefunds } = await supabase
      .from('refunds')
      .select('amount')
      .eq('reservation_id', params.reservationId)
      .eq('status', 'succeeded')

    const totalRefunded = completedRefunds?.reduce((sum, r) => sum + r.amount, 0) || 0
    const refundableAmount = totalPaid - totalRefunded

    if (refundableAmount <= 0) {
      return { success: false, error: 'No refundable amount remaining' }
    }

    // Get the most recent paid payment for refunding
    const paymentToRefund = payments[0]

    // Verify we have the PayMongo payment ID
    if (!paymentToRefund.external_id && !paymentToRefund.metadata?.paymongo_payment?.id) {
      console.error('❌ [requestRefundAction] No PayMongo payment ID found', paymentToRefund)
      return {
        success: false,
        error: 'Payment provider reference not found. Please contact support.'
      }
    }

    const paymongoPaymentId = paymentToRefund.external_id || paymentToRefund.metadata?.paymongo_payment?.id

    // For bulk payments, ensure we don't refund more than the reservation amount
    // reservation.amount_paid is in pesos, refundableAmount is in centavos — convert to same unit
    const amountPaidCentavos = Math.round(reservation.amount_paid * 100)
    const actualRefundAmount = Math.min(refundableAmount, amountPaidCentavos)

    // 5. Create refund record
    const { data: refundRecord, error: insertError } = await supabase
      .from('refunds')
      .insert({
        payment_id: paymentToRefund.id,
        reservation_id: params.reservationId,
        user_id: user.id,
        amount: Math.round(actualRefundAmount), // actualRefundAmount is already in centavos
        currency: 'PHP',
        status: 'pending',
        payment_external_id: paymongoPaymentId,
        reason: params.reason,
        reason_code: params.reasonCode || 'requested_by_customer',
        metadata: {
          requested_at: new Date().toISOString(),
          original_payment_amount: paymentToRefund.amount,
          is_bulk_partial_refund: !!reservation.recurrence_group_id
        }
      })
      .select()
      .single()

    if (insertError || !refundRecord) {
      console.error('❌ [requestRefundAction] Failed to create refund record:', insertError)
      return { success: false, error: 'Failed to create refund request' }
    }

    // Set reservation status to pending_refund
    await supabase
      .from('reservations')
      .update({ status: 'pending_refund' })
      .eq('id', params.reservationId)

    console.log('✅ [requestRefundAction] Refund record created:', refundRecord.id)

    // Do NOT process refund through PayMongo immediately.
    // Refund requests must be approved by an admin.

    revalidatePath('/bookings')
    revalidatePath(`/bookings/${params.reservationId}`)

    // Audit: log refund request by the user
    await writeAuditLog({
      userId: user.id,
      action: 'refund.requested',
      resourceType: 'refund',
      resourceId: refundRecord.id,
      newValues: {
        reservationId: params.reservationId,
        reason: params.reason,
        reasonCode: params.reasonCode,
        amount: Math.round(actualRefundAmount),
      },
    })

    // --- NOTIFICATIONS ---
    try {
      const ownerId = (reservation.courts as any)?.venues?.owner_id
      if (ownerId) {
        await createNotification({
          userId: ownerId,
          ...NotificationTemplates.refundRequested(
            Math.round(actualRefundAmount),
            params.reservationId
          )
        })
      }
    } catch (notifyError) {
      console.error('⚠️ [requestRefundAction] Notification failed:', notifyError)
    }

    return {
      success: true,
      refundId: refundRecord.id
    }

  } catch (error: any) {
    console.error('❌ [requestRefundAction] Unexpected error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred' }
  }
}

/**
 * Get refund status for a reservation
 */
export async function getRefundStatusAction(reservationId: string): Promise<{
  success: boolean
  summary?: RefundSummary
  refunds?: any[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns this reservation
    const { data: reservation } = await supabase
      .from('reservations')
      .select('user_id')
      .eq('id', reservationId)
      .single()

    if (!reservation || reservation.user_id !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    // Get refund summary using database function
    interface RefundSummaryResult {
      total_paid: number
      total_refunded: number
      pending_refunds: number
      refundable_amount: number
    }

    const { data: summary, error: summaryError } = await supabase
      .rpc('get_reservation_refund_summary', { p_reservation_id: reservationId })
      .single<RefundSummaryResult>()

    // Get all refunds for this reservation
    const { data: refunds, error: refundsError } = await supabase
      .from('refunds')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })

    if (summaryError) {
      console.error('❌ [getRefundStatusAction] Error getting summary:', summaryError)
    }

    return {
      success: true,
      summary: summary ? {
        totalPaid: summary.total_paid,
        totalRefunded: summary.total_refunded,
        pendingRefunds: summary.pending_refunds,
        refundableAmount: summary.refundable_amount,
      } : undefined,
      refunds: refunds || [],
    }

  } catch (error: any) {
    console.error('❌ [getRefundStatusAction] Error:', error)
    return { success: false, error: error.message || 'Failed to get refund status' }
  }
}

/**
 * Cancel a pending refund request
 */
export async function cancelRefundRequestAction(refundId: string): Promise<RefundResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get refund and verify ownership
    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .select('*, reservations(user_id, status)')
      .eq('id', refundId)
      .single()

    if (refundError || !refund) {
      return { success: false, error: 'Refund not found' }
    }

    // Verify user owns the reservation
    if (refund.reservations?.user_id !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    // Only pending refunds can be cancelled
    if (refund.status !== 'pending') {
      return { success: false, error: `Cannot cancel refund with status: ${refund.status}` }
    }

    // Update refund status
    const { error: updateError } = await supabase
      .from('refunds')
      .update({
        status: 'cancelled',
        notes: 'Cancelled by user',
      })
      .eq('id', refundId)

    if (updateError) {
      return { success: false, error: 'Failed to cancel refund' }
    }

    // Revert reservation status if it was pending_refund
    if (refund.reservations?.status === 'pending_refund') {
      await supabase
        .from('reservations')
        .update({ status: 'confirmed' }) // Revert to confirmed
        .eq('id', refund.reservation_id)
    }

    revalidatePath('/bookings')

    return { success: true, refundId }

  } catch (error: any) {
    console.error('❌ [cancelRefundRequestAction] Error:', error)
    return { success: false, error: error.message || 'Failed to cancel refund' }
  }
}

// =============================================
// ADMIN REFUND ACTIONS
// =============================================

/**
 * Admin: Approve and process a refund request
 */
export async function adminProcessRefundAction(
  refundId: string,
  action: 'approve' | 'reject',
  adminNotes?: string
): Promise<RefundResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is admin or court admin - use service client to bypass RLS
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceClient = createServiceClient()

    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)
      .in('role.name', ['global_admin', 'court_admin'])

    if (!roles || roles.length === 0) {
      return { success: false, error: 'Not authorized to process refunds' }
    }

    // Get refund details
    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single()

    if (refundError || !refund) {
      return { success: false, error: 'Refund not found' }
    }

    if (refund.status !== 'pending' && refund.status !== 'failed') {
      return { success: false, error: `Cannot process refund with status: ${refund.status}` }
    }

    if (action === 'reject') {
      // Reject the refund
      await supabase
        .from('refunds')
        .update({
          status: 'failed',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          notes: adminNotes || 'Rejected by admin',
        })
        .eq('id', refundId)

      // Revert reservation status
      await supabase
        .from('reservations')
        .update({ status: 'confirmed' }) // Revert to confirmed
        .eq('id', refund.reservation_id)

      // Notify user
      await createNotification({
        userId: refund.user_id,
        ...NotificationTemplates.refundRejected(
          adminNotes || 'Your refund request has been rejected.',
          refund.reservation_id
        )
      })

      // Audit: log admin rejection
      await writeAuditLog({
        userId: user.id,
        action: 'refund.rejected',
        resourceType: 'refund',
        resourceId: refundId,
        newValues: {
          adminNotes: adminNotes || 'Rejected by admin',
          reservationId: refund.reservation_id,
        },
      })

      revalidatePath('/bookings')
      return { success: true, refundId }
    }

    // Approve: Process through PayMongo
    if (!refund.payment_external_id) {
      return { success: false, error: 'Payment provider reference not found' }
    }

    try {
      const paymongoRefund = await createRefund({
        payment_id: refund.payment_external_id,
        amount: refund.amount,
        reason: refund.reason_code || 'requested_by_customer',
        notes: adminNotes,
        metadata: {
          rallio_refund_id: refund.id,
          processed_by: user.id,
        }
      })

      // Update refund record
      await supabase
        .from('refunds')
        .update({
          external_id: paymongoRefund.id,
          status: paymongoRefund.attributes.status === 'succeeded' ? 'succeeded' : 'processing',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          notes: adminNotes,
        })
        .eq('id', refundId)

      // If succeeded, update reservation
      if (paymongoRefund.attributes.status === 'succeeded') {
        await handleSuccessfulRefund(refundId, refund.reservation_id, refund.user_id)
      }

      // Audit: log admin approval
      await writeAuditLog({
        userId: user.id,
        action: 'refund.approved',
        resourceType: 'refund',
        resourceId: refundId,
        newValues: {
          paymongoRefundId: paymongoRefund.id,
          paymongoStatus: paymongoRefund.attributes.status,
          adminNotes: adminNotes,
          reservationId: refund.reservation_id,
        },
      })

      // Notify user of approval
      await createNotification({
        userId: refund.user_id,
        ...NotificationTemplates.refundApproved(
          refund.amount,
          refund.reservation_id
        )
      })


      revalidatePath('/bookings')
      return { success: true, refundId }

    } catch (paymongoError: any) {
      console.error('❌ [adminProcessRefundAction] PayMongo error:', paymongoError)

      await supabase
        .from('refunds')
        .update({
          status: 'failed',
          error_message: paymongoError.message,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refundId)

      return { success: false, error: paymongoError.message }
    }

  } catch (error: any) {
    console.error('❌ [adminProcessRefundAction] Error:', error)
    return { success: false, error: error.message || 'Failed to process refund' }
  }
}

/**
 * Admin: Get all refunds (for dashboard)
 */
export async function adminGetRefundsAction(options?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<{ success: boolean; refunds?: any[]; total?: number; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is admin - use service client to bypass RLS
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceClient = createServiceClient()

    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)
      .eq('role.name', 'global_admin')

    if (!roles || roles.length === 0) {
      return { success: false, error: 'Not authorized' }
    }

    let query = supabase
      .from('refunds')
      .select(`
        *,
        reservations (
          id,
          start_time,
          end_time,
          user_id,
          courts (
            name,
            venues (name)
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data: refunds, error, count } = await query

    if (error) {
      console.error('❌ [adminGetRefundsAction] Error:', error)
      return { success: false, error: error.message }
    }

    // Fetch profiles separately for the user_ids
    const userIds = [...new Set(refunds?.map(r => r.user_id).filter(Boolean) || [])]

    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {} as Record<string, any>)
      }
    }

    // Attach profiles to refunds
    const refundsWithProfiles = refunds?.map(refund => ({
      ...refund,
      profiles: profilesMap[refund.user_id] || null
    })) || []

    return { success: true, refunds: refundsWithProfiles, total: count || 0 }

  } catch (error: any) {
    console.error('❌ [adminGetRefundsAction] Error:', error)
    return { success: false, error: error.message || 'Failed to get refunds' }
  }
}

// =============================================
// WEBHOOK HANDLER HELPER
// =============================================

/**
 * Handle refund webhook from PayMongo
 * Called from the webhook route handler
 */
export async function handleRefundWebhook(event: {
  type: string
  data: {
    id: string
    attributes: {
      payment_id: string
      amount: number
      status: string
      metadata?: Record<string, any>
    }
  }
}): Promise<{ success: boolean; error?: string }> {
  console.log('🔔 [handleRefundWebhook] Processing:', event.type)

  const supabase = createServiceClient()

  const refundData = event.data
  const rallioRefundId = refundData.attributes.metadata?.rallio_refund_id

  if (!rallioRefundId) {
    console.warn('⚠️ [handleRefundWebhook] No Rallio refund ID in metadata')
    // Try to find by external ID
    const { data: refund } = await supabase
      .from('refunds')
      .select('*')
      .eq('external_id', refundData.id)
      .single()

    if (!refund) {
      console.error('❌ [handleRefundWebhook] Refund not found')
      return { success: false, error: 'Refund not found' }
    }

    return processRefundStatus(refund, event.type)
  }

  const { data: refund, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('id', rallioRefundId)
    .single()

  if (error || !refund) {
    console.error('❌ [handleRefundWebhook] Refund not found:', error)
    return { success: false, error: 'Refund not found' }
  }

  return processRefundStatus(refund, event.type)
}

async function processRefundStatus(refund: any, eventType: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  if (eventType === 'refund.succeeded') {
    await supabase
      .from('refunds')
      .update({
        status: 'succeeded',
        processed_at: new Date().toISOString(),
      })
      .eq('id', refund.id)

    await handleSuccessfulRefund(refund.id, refund.reservation_id, refund.user_id)

  } else if (eventType === 'refund.failed') {
    await supabase
      .from('refunds')
      .update({
        status: 'failed',
        error_message: 'Refund failed at payment provider',
      })
      .eq('id', refund.id)

    // Notify user of failure
    await createNotification({
      userId: refund.user_id,
      type: 'refund_processed',
      title: 'Refund Failed',
      message: 'Your refund could not be processed. Please contact support.',
      metadata: { refund_id: refund.id },
    })
  }

  return { success: true }
}

/**
 * Handle successful refund - update reservation and notify user
 */
async function handleSuccessfulRefund(
  refundId: string,
  reservationId: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  // Update reservation status
  const { data: reservation } = await supabase
    .from('reservations')
    .select('metadata')
    .eq('id', reservationId)
    .single()

  const currentMetadata = reservation?.metadata || {}

  await supabase
    .from('reservations')
    .update({
      status: 'refunded',
      metadata: {
        ...currentMetadata,
        refunded_at: new Date().toISOString()
      }
    })
    .eq('id', reservationId)

  // Create notification
  await createNotification({
    userId,
    type: 'refund_processed',
    title: 'Refund Processed',
    message: 'Your refund has been processed successfully. Funds will be returned to your original payment method.',
    metadata: { refund_id: refundId, reservation_id: reservationId },
  })

  console.log('✅ [handleSuccessfulRefund] Refund completed:', { refundId, reservationId })
}
