'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { differenceInMinutes, addMinutes } from 'date-fns'
import { createNotification, NotificationTemplates } from '@/lib/notifications'

interface RescheduleResult {
    success: boolean
    error?: string
}

/**
 * Request a reschedule for a reservation.
 * Instead of directly updating the booking times, this stores the proposed
 * new times in metadata and requires court admin approval.
 */
export async function rescheduleReservationAction(
    bookingId: string,
    newDate: Date,
    newStartTime: string // HH:MM
): Promise<RescheduleResult> {
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Unauthorized' }
    }

    // 2. Fetch the existing reservation with court + venue info for notification
    const adminDb = createServiceClient()
    const { data: booking, error: fetchError } = await adminDb
        .from('reservations')
        .select(`
            *,
            court:courts!inner(
                id,
                name,
                venue:venues!inner(
                    id,
                    name,
                    owner_id
                )
            )
        `)
        .eq('id', bookingId)
        .single()

    if (fetchError || !booking) {
        return { success: false, error: 'Booking not found' }
    }

    // Verify ownership
    if (booking.user_id !== user.id) {
        return { success: false, error: 'You do not have permission to reschedule this booking' }
    }

    // 3. Verify status
    const allowedStatuses = ['pending_payment', 'partially_paid', 'confirmed']
    if (!allowedStatuses.includes(booking.status)) {
        return { success: false, error: `Cannot reschedule a booking with status: ${booking.status}` }
    }

    // 3b. 24-hour policy — cannot reschedule within 24 hours of start time
    const hoursUntilStart = (new Date(booking.start_time).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilStart < 24) {
        return { success: false, error: 'Cannot reschedule within 24 hours of booking start time' }
    }

    // 3c. Check if already rescheduled
    if (booking.metadata?.rescheduled === true) {
        return { success: false, error: 'This booking has already been rescheduled once.' }
    }

    // 3d. Check if there's already a pending reschedule request
    if (booking.metadata?.reschedule_request?.status === 'pending') {
        return { success: false, error: 'There is already a pending reschedule request for this booking.' }
    }

    // 4. Calculate new time range
    const oldStart = new Date(booking.start_time)
    const oldEnd = new Date(booking.end_time)
    const durationInMinutes = differenceInMinutes(oldEnd, oldStart)

    // Construct new start timestamp with explicit Asia/Manila timezone offset.
    const [hours, minutes] = newStartTime.split(':').map(Number)

    const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(newDate))

    const hoursStr = hours.toString().padStart(2, '0')
    const minutesStr = minutes.toString().padStart(2, '0')
    const newStartISO = `${dateStr}T${hoursStr}:${minutesStr}:00+08:00`

    const newStartDateTime = new Date(newStartISO)
    const newEndDateTime = addMinutes(newStartDateTime, durationInMinutes)
    const newEndISO = newEndDateTime.toISOString()

    // 5. Check Availability (excluding current booking)
    const conflictStatuses = ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

    const { data: conflicts, error: conflictError } = await adminDb
        .from('reservations')
        .select('id')
        .eq('court_id', booking.court_id)
        .neq('id', bookingId)
        .in('status', conflictStatuses)
        .lt('start_time', newEndISO)
        .gt('end_time', newStartISO)

    if (conflictError) {
        console.error('Error checking conflicts:', conflictError)
        return { success: false, error: 'Failed to verify availability' }
    }

    if (conflicts && conflicts.length > 0) {
        return { success: false, error: 'The selected time slot is no longer available' }
    }

    // Also check queue sessions
    const { data: queueConflicts, error: queueError } = await adminDb
        .from('queue_sessions')
        .select('id')
        .eq('court_id', booking.court_id)
        .in('status', ['pending_payment', 'open', 'active'])
        .lt('start_time', newEndISO)
        .gt('end_time', newStartISO)

    if (queueError) {
        console.error('Error checking queue conflicts:', queueError)
        return { success: false, error: 'Failed to verify availability' }
    }

    if (queueConflicts && queueConflicts.length > 0) {
        return { success: false, error: 'The selected time slot conflicts with a queue session' }
    }

    // 6. Store reschedule request in metadata (NOT directly updating times)
    const { error: updateError } = await adminDb
        .from('reservations')
        .update({
            updated_at: new Date().toISOString(),
            metadata: {
                ...booking.metadata,
                reschedule_request: {
                    status: 'pending',
                    proposed_start_time: newStartISO,
                    proposed_end_time: newEndISO,
                    original_start_time: booking.start_time,
                    original_end_time: booking.end_time,
                    requested_at: new Date().toISOString(),
                    requested_by: user.id,
                }
            }
        })
        .eq('id', bookingId)

    if (updateError) {
        console.error('Error storing reschedule request:', updateError)
        return { success: false, error: 'Failed to submit reschedule request' }
    }

    // 7. Notify the court admin about pending reschedule
    const courtData = booking.court as any
    const venueOwnerId = courtData?.venue?.owner_id
    const courtName = courtData?.name || 'Court'

    // Get user name for notification
    const { data: profile } = await adminDb
        .from('profiles')
        .select('first_name, last_name, display_name')
        .eq('id', user.id)
        .single()

    const customerName = profile?.display_name ||
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
        'A customer'

    const proposedDateStr = new Date(newStartISO).toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

    if (venueOwnerId) {
        await createNotification({
            userId: venueOwnerId,
            ...NotificationTemplates.reschedulePending(
                customerName,
                courtName,
                proposedDateStr,
                bookingId
            )
        })
    }

    // 8. Revalidate paths
    revalidatePath('/bookings')
    revalidatePath(`/bookings/${bookingId}`)
    revalidatePath('/court-admin/reservations')

    return { success: true }
}

/**
 * Mark the reschedule result (approved/rejected) as seen by the user.
 * This clears the unseen flag so the tag disappears from the preview card.
 */
export async function markRescheduleResultSeenAction(
    bookingId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Unauthorized' }
    }

    const adminDb = createServiceClient()
    const { data: booking, error: fetchError } = await adminDb
        .from('reservations')
        .select('id, user_id, metadata')
        .eq('id', bookingId)
        .single()

    if (fetchError || !booking) {
        return { success: false, error: 'Booking not found' }
    }

    if (booking.user_id !== user.id) {
        return { success: false, error: 'Unauthorized' }
    }

    const metadata = { ...booking.metadata }
    let changed = false

    if (metadata.rescheduled_from && !metadata.reschedule_approved_seen) {
        metadata.reschedule_approved_seen = true
        changed = true
    }

    if (metadata.last_reschedule_rejection && !metadata.reschedule_rejected_seen) {
        metadata.reschedule_rejected_seen = true
        changed = true
    }

    if (!changed) {
        return { success: true }
    }

    const { error: updateError } = await adminDb
        .from('reservations')
        .update({ metadata })
        .eq('id', bookingId)

    if (updateError) {
        return { success: false, error: 'Failed to update' }
    }

    revalidatePath('/bookings')
    return { success: true }
}
