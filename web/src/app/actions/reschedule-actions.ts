'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service' // Use service client for admin updates
import { revalidatePath } from 'next/cache'
import { differenceInMinutes, addMinutes } from 'date-fns'

interface RescheduleResult {
    success: boolean
    error?: string
}

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

    // 2. Fetch the existing reservation to verify ownership and get details
    const { data: booking, error: fetchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', bookingId)
        .single()

    if (fetchError || !booking) {
        return { success: false, error: 'Booking not found' }
    }

    // Verify ownership (or admin)
    // For now, assume user must be owner.
    // TODO: Add admin check if needed.
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

    // 4. Calculate new time range
    const oldStart = new Date(booking.start_time)
    const oldEnd = new Date(booking.end_time)
    const durationInMinutes = differenceInMinutes(oldEnd, oldStart)

    // Construct new start timestamp with explicit Asia/Manila timezone offset.
    // The client sends a Date representing the selected calendar day, but its
    // internal UTC value may correspond to the previous day (e.g. Mar 24 00:00
    // PHT = Mar 23 16:00 UTC). Using setHours() on the server (UTC) would apply
    // hours in UTC, causing date/time drift. Instead, extract the intended
    // calendar date in Asia/Manila and build the ISO string with +08:00 offset.
    const [hours, minutes] = newStartTime.split(':').map(Number)

    const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(newDate)) // 'yyyy-MM-dd' in Manila timezone

    const hoursStr = hours.toString().padStart(2, '0')
    const minutesStr = minutes.toString().padStart(2, '0')
    const newStartISO = `${dateStr}T${hoursStr}:${minutesStr}:00+08:00`

    const newStartDateTime = new Date(newStartISO)
    const newEndDateTime = addMinutes(newStartDateTime, durationInMinutes)
    const newEndISO = newEndDateTime.toISOString()

    // 5. Check Availability (excluding current booking)
    // We use the service client to check all bookings
    const adminDb = createServiceClient()

    // We can reuse the logic from getAvailableTimeSlots OR just query directly for conflicts
    // Query for conflicts excluding this ID
    const conflictStatuses = ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

    const { data: conflicts, error: conflictError } = await adminDb
        .from('reservations')
        .select('id')
        .eq('court_id', booking.court_id)
        .neq('id', bookingId) // Exclude self
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

    // 6. Check Operating Hours (Basic check if needed, or rely on UI restriction)
    // Ideally we should check if new time is within court opening hours. 
    // For robustness, let's assume UI handled it, but DB constraint or logic should ideally catch it.
    // Since we don't have easy access to operating hours here without fetching venue, we'll skip strict op-hours check 
    // relying on the fact that `getAvailableTimeSlots` in UI only showed valid slots. 
    // However, direct API calls could bypass.
    // MVP: Skip.

    // 7. Update Reservation using SERVICE CLIENT to bypass RLS
    const { error: updateError } = await adminDb
        .from('reservations')
        .update({
            start_time: newStartISO,
            end_time: newEndISO,
            updated_at: new Date().toISOString(),
            metadata: {
                ...booking.metadata,
                rescheduled: true,
                rescheduled_from: {
                    start_time: booking.start_time,
                    end_time: booking.end_time,
                    rescheduled_at: new Date().toISOString()
                }
            }
        })
        .eq('id', bookingId)

    if (updateError) {
        console.error('Error updating reservation:', updateError)
        return { success: false, error: 'Failed to update booking' }
    }

    // 8. Revalidate paths
    revalidatePath('/bookings')
    revalidatePath(`/bookings/${bookingId}`)

    return { success: true }
}
