'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requestRefundAction } from './refund-actions'

export async function cancelEntireBookingAction(bookingId: string, reason?: string) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. Fetch booking and reservations
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, reservations(id, start_time, status, user_id)')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, error: 'Booking not found' }
  }

  // 3. Ownership check
  if (booking.user_id !== user.id) {
    return { success: false, error: 'Not authorized to cancel this booking' }
  }

  const activeReservations = booking.reservations.filter((r: any) => r.status !== 'cancelled')

  if (activeReservations.length === 0) {
    return { success: false, error: 'No active reservations found in this booking' }
  }

  // 4. Check 24-hour policy on the earliest uncancelled reservation
  const now = Date.now()
  const earliestStartTime = Math.min(...activeReservations.map((r: any) => new Date(r.start_time).getTime()))
  const hoursUntilStart = (earliestStartTime - now) / (1000 * 60 * 60)

  if (hoursUntilStart >= 0 && hoursUntilStart < 24) {
    return {
      success: false,
      error: 'Cannot cancel entire booking within 24 hours of the first start time. Please contact support.'
    }
  }

  // 5. Cancel all active reservations
  const activeIds = activeReservations.map((r: any) => r.id)
  
  const actualReason = reason || 'User cancelled entire booking'
  
  const { error: cancelError } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: actualReason
    })
    .in('id', activeIds)

  if (cancelError) {
    console.error('❌ [cancelEntireBookingAction] Failed to cancel reservations:', cancelError)
    return { success: false, error: 'Failed to cancel reservations' }
  }

  // 6. Update parent booking
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      metadata: { ...booking.metadata, cancelled_at: new Date().toISOString() }
    })
    .eq('id', bookingId)

  // 7. Request refunds for paid/partially_paid reservations
  const refundableStatuses = ['confirmed', 'partially_paid', 'pending_payment']
  
  for (const res of activeReservations) {
    if (refundableStatuses.includes(res.status)) {
      await requestRefundAction({
        reservationId: res.id,
        reason: actualReason,
        reasonCode: 'requested_by_customer'
      })
    }
  }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)

  return { success: true }
}
