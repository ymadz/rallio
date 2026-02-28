'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { format } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { createReservation } from '@/lib/services/reservations'

export interface TimeSlot {
  time: string
  available: boolean
  price?: number
}

/**
 * Server Action: Get venue metadata (like down payment percentage)
 */
export async function getVenueMetadataAction(venueId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('venues')
    .select('metadata')
    .eq('id', venueId)
    .single()

  if (error) {
    console.error('Error fetching venue metadata:', error)
    return { success: false, error: error.message }
  }

  return { success: true, metadata: data.metadata }
}

/**
 * Server Action: Get available time slots for a specific court on a given date
 */
export async function getAvailableTimeSlotsAction(
  courtId: string,
  dateString: string,
  excludeReservationId?: string
): Promise<TimeSlot[]> {
  // Use Service Client to bypass RLS and ensure we see ALL bookings
  const supabase = await createClient() // Keep for court fetching (unlikely RLS protected for read) but better to use service for ALL availability checks
  const adminDb = createServiceClient()
  const date = new Date(dateString)

  // Get the court details to know hourly rate and venue operating hours
  const { data: court, error: courtError } = await supabase
    .from('courts')
    .select(`
      id,
      hourly_rate,
      venues (
        opening_hours
      )
    `)
    .eq('id', courtId)
    .single()

  if (courtError || !court) {
    console.error('Error fetching court:', courtError)
    return []
  }

  // Get day of week from date (0 = Sunday, 6 = Saturday)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayOfWeek = dayNames[date.getDay()]

  // Get operating hours for this day
  const venueData = Array.isArray(court.venues) ? court.venues[0] : court.venues
  const openingHours = venueData?.opening_hours as Record<string, { open: string; close: string }> | null
  const dayHours = openingHours?.[dayOfWeek]

  if (!dayHours) {
    return [] // Venue closed on this day
  }

  // Parse opening and closing times
  const [openHour] = dayHours.open.split(':').map(Number)
  const [closeHour] = dayHours.close.split(':').map(Number)

  // Get existing reservations AND queue sessions for this court on this date
  // Query for the entire day range to catch any overlapping bookings
  const dateOnlyString = format(date, 'yyyy-MM-dd')
  const activeStatuses = ['pending_payment', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

  // Use timezone-aware date range (Asia/Manila = +08:00)
  // Query from midnight to end of day in the venue's timezone
  const startOfDayLocal = `${dateOnlyString}T00:00:00+08:00`
  const endOfDayLocal = `${dateOnlyString}T23:59:59+08:00`

  console.log(`[Availability Check] Querying for date: ${dateOnlyString}`)
  console.log(`[Availability Check] Date range: ${startOfDayLocal} to ${endOfDayLocal}`)

  // Build reservations query
  let reservationsQuery = adminDb
    .from('reservations')
    .select('start_time, end_time, status')
    .eq('court_id', courtId)
    .lt('start_time', endOfDayLocal) // Starts before the end of the query window
    .gt('end_time', startOfDayLocal) // Ends after the start of the query window
    .in('status', activeStatuses)

  // Exclude specific reservation if provided (for rescheduling)
  if (excludeReservationId) {
    reservationsQuery = reservationsQuery.neq('id', excludeReservationId)
  }

  const [reservationsResult, queueSessionsResult] = await Promise.all([
    // Execute reservations query
    reservationsQuery,

    // Get queue sessions
    adminDb
      .from('queue_sessions')
      .select('start_time, end_time, status')
      .eq('court_id', courtId)
      .lt('start_time', endOfDayLocal)
      .gt('end_time', startOfDayLocal)
      .in('status', ['pending_payment', 'open', 'active'])
  ])


  if (reservationsResult.error) {
    console.error('Error fetching reservations:', reservationsResult.error)
  }

  if (queueSessionsResult.error) {
    console.error('Error fetching queue sessions:', queueSessionsResult.error)
  }

  // Combine both reservations and queue sessions into a single list
  const reservations = reservationsResult.data || []
  const queueSessions = queueSessionsResult.data || []
  const allBookedSlots = [...reservations, ...queueSessions]

  console.log(`[Availability Check] Court: ${courtId}, Date: ${dateOnlyString}`)
  console.log(`[Availability Check] Found ${reservations.length} reservations and ${queueSessions.length} queue sessions`)

  if (reservations.length > 0) {
    console.log('[Availability Check] Reservations:', reservations.map(r => ({
      start: r.start_time,
      end: r.end_time,
      status: r.status
    })))
  }

  console.log(`[Availability Check] Total booked slots: ${allBookedSlots.length}`)

  // Determine the effective slot range by extending operating hours to include
  // any hours that have existing reservations. This ensures booked slots are
  // always visible even if the venue's operating hours for this day don't cover them.
  let effectiveOpenHour = openHour
  let effectiveCloseHour = closeHour

  if (allBookedSlots && allBookedSlots.length > 0) {
    for (const reservation of allBookedSlots) {
      try {
        const startTime = new Date(reservation.start_time)
        const endTime = new Date(reservation.end_time)

        const startHourStr = startTime.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })
        const endHourStr = endTime.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })

        const resStartHour = parseInt(startHourStr) % 24
        let resEndHour = parseInt(endHourStr) % 24
        if (resEndHour === 0 && resStartHour > 0) resEndHour = 24

        const endMinutes = endTime.getMinutes()
        const resEndHourCeil = endMinutes > 0 ? resEndHour + 1 : resEndHour

        // Extend the effective range to include this reservation's hours
        effectiveOpenHour = Math.min(effectiveOpenHour, resStartHour)
        effectiveCloseHour = Math.max(effectiveCloseHour, resEndHourCeil)
      } catch (error) {
        // Ignore parse errors for range extension; they'll be caught below
      }
    }
  }

  // Generate all possible hourly slots using the effective range
  const allSlots: TimeSlot[] = []
  for (let hour = effectiveOpenHour; hour < effectiveCloseHour; hour++) {
    const timeString = `${hour.toString().padStart(2, '0')}:00`
    allSlots.push({
      time: timeString,
      available: true,
      price: court.hourly_rate,
    })
  }

  // Mark unavailable slots based on existing reservations AND queue sessions
  if (allBookedSlots && allBookedSlots.length > 0) {
    for (const reservation of allBookedSlots) {
      try {
        // Parse ISO timestamps to get local hours in venue's timezone (Asia/Manila)
        // We need to use toLocaleString to get the hour in the specific timezone
        const startTime = new Date(reservation.start_time)
        const endTime = new Date(reservation.end_time)

        const startHourStr = startTime.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })
        const endHourStr = endTime.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })

        // Handle "24" as 0 if needed, but usually 0-23
        const startHour = parseInt(startHourStr) % 24
        let endHour = parseInt(endHourStr) % 24

        // Special case: if end time is 00:00 (midnight) of the next day, it might show as 24 or 0
        // If endHour is 0 and startHour is > 0, it means it crosses midnight or ends at midnight
        if (endHour === 0 && startHour > 0) {
          endHour = 24
        }

        // If end time has minutes (e.g., 14:30), we need to block that hour too
        const endMinutes = endTime.getMinutes()
        const endHourCeil = endMinutes > 0 ? endHour + 1 : endHour

        console.log(`[Availability Check] Blocking slots from ${startHour}:00 to ${endHourCeil}:00 (status: ${reservation.status})`)

        // Mark all hours in this reservation as unavailable
        for (let hour = startHour; hour < endHourCeil; hour++) {
          const timeString = `${hour.toString().padStart(2, '0')}:00`
          const slot = allSlots.find((s) => s.time === timeString)
          if (slot) {
            console.log(`[Availability Check] Marking ${timeString} as unavailable`)
            slot.available = false
          }
        }
      } catch (error) {
        console.error('[Availability Check] Error parsing reservation time:', error, reservation)
      }
    }
  }

  // Filter out past time slots if date is today (in Asia/Manila timezone)
  const manilaNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  const manilaNow = new Date(manilaNowStr)
  const isToday = dateString === format(manilaNow, 'yyyy-MM-dd')

  if (isToday) {
    const currentHour = manilaNow.getHours()
    return allSlots.filter((slot) => {
      const slotHour = parseInt(slot.time.split(':')[0])
      return slotHour > currentHour
    })
  }

  return allSlots
}
/**
 * Server Action: Validate if a booking series is available without creating it
 */
export async function validateBookingAvailabilityAction(data: {
  courtId: string
  startTimeISO: string
  endTimeISO: string
  recurrenceWeeks?: number
  selectedDays?: number[]
}): Promise<{ available: boolean; conflictDate?: string; error?: string }> {
  const supabase = await createClient()

  // Grab the current user for checking own conflicts if needed, but for availability check
  // usually any active booking blocks it, UNLESS it's the user's OWN pending one they are replacing?
  // But searching for own conflicts requires auth.
  // Let's get getUser.
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id

  // Use Service Client for availability checks
  const adminDb = createServiceClient()

  const recurrenceWeeks = data.recurrenceWeeks || 1
  const selectedDays = data.selectedDays || []

  const initialStartTime = new Date(data.startTimeISO)
  const initialEndTime = new Date(data.endTimeISO)

  if (selectedDays.length === 0) {
    selectedDays.push(initialStartTime.getDay())
  }

  // Ensure initialStartTime is valid
  if (Number.isNaN(initialStartTime.getTime())) {
    return { available: false, error: 'Invalid start time.' }
  }

  const durationMs = initialEndTime.getTime() - initialStartTime.getTime()
  const startDayIndex = initialStartTime.getDay() // 0-6

  // 0. FETCH OPERATING HOURS
  const { data: court, error: courtError } = await supabase
    .from('courts')
    .select(`
      id,
      venues (
        opening_hours
      )
    `)
    .eq('id', data.courtId)
    .single()

  if (courtError || !court) {
    return { available: false, error: 'Court not found.' }
  }

  const venueData = Array.isArray(court.venues) ? court.venues[0] : court.venues
  const openingHours = venueData?.opening_hours as Record<string, { open: string; close: string }> | null
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // 1. GENERATE PHASE
  // Deduplicate and sort selected days to prevent duplicate slots
  const uniqueSelectedDays = Array.from(new Set(selectedDays)).sort((a, b) => a - b)
  const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

  for (let i = 0; i < recurrenceWeeks; i++) {
    for (const dayIndex of uniqueSelectedDays) {
      const dayOffset = (dayIndex - startDayIndex + 7) % 7

      const slotStartTime = new Date(initialStartTime.getTime())
      slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)

      const slotEndTime = new Date(slotStartTime.getTime() + durationMs)

      targetSlots.push({ start: slotStartTime, end: slotEndTime, weekIndex: i })
    }
  }

  if (targetSlots.length === 0) return { available: false, error: 'No slots generated.' }

  // Check for internal overlaps within the generated slots
  targetSlots.sort((a, b) => a.start.getTime() - b.start.getTime())

  for (let i = 0; i < targetSlots.length - 1; i++) {
    const current = targetSlots[i]
    const next = targetSlots[i + 1]

    if (current.end.getTime() > next.start.getTime()) {
      return { available: false, error: 'Internal conflict: Generated slots overlap with each other.' }
    }
  }

  // 2. VALIDATION PHASE
  const manilaNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  const manilaNow = new Date(manilaNowStr)

  for (const slot of targetSlots) {
    // A. Check Past Time
    // slot.start acts as a floating time (UTC implicitly on server). manilaNow acts as current Manila time in same floating offset.
    if (slot.start.getTime() < manilaNow.getTime() - 60000) { // Add 1 minute grace period
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Cannot book a time in the past: ${dateStr}` }
    }

    const currentStartTimeISO = slot.start.toISOString()
    const currentEndTimeISO = slot.end.toISOString()
    const conflictStatuses = ['pending_payment', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

    // B. Check Operating Hours
    const dayName = dayNames[slot.start.getDay()]
    const dayHours = openingHours?.[dayName]

    if (!dayHours) {
      // Venue closed on this day
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
      return { available: false, conflictDate: dateStr, error: `Venue is closed on ${dateStr}` }
    }

    // Parse open/close times
    const [openH, openM] = dayHours.open.split(':').map(Number)
    const [closeH, closeM] = dayHours.close.split(':').map(Number)

    // Parse slot times (in local venue time - assuming generic logical comparison or keeping consistent timezone)
    // Ideally we'd use timezone-aware comparison, but for now using getHours() matches existing logic if local
    // To be safer, we compare HH:MM values directly
    const slotStartH = slot.start.getHours()
    const slotStartM = slot.start.getMinutes()
    const slotEndH = slot.end.getHours()
    const slotEndM = slot.end.getMinutes()

    const slotStartMinutes = slotStartH * 60 + slotStartM
    const slotEndMinutes = slotEndH * 60 + slotEndM
    const openMinutes = openH * 60 + (openM || 0)
    const closeMinutes = closeH * 60 + (closeM || 0)

    if (slotStartMinutes < openMinutes || slotEndMinutes > closeMinutes) {
      // Slot is outside operating hours
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      const timeStr = slot.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Venue is closed at ${timeStr} on ${dayName}s (Open: ${dayHours.open} - ${dayHours.close})` }
    }

    // B. Check Conflicts
    const [reservationConflicts, queueConflicts] = await Promise.all([
      adminDb
        .from('reservations')
        .select('id, start_time, end_time, status, user_id')
        .eq('court_id', data.courtId)
        .in('status', conflictStatuses)
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO),

      adminDb
        .from('queue_sessions')
        .select('id, start_time, end_time')
        .eq('court_id', data.courtId)
        .in('status', ['pending_payment', 'open', 'active'])
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO)
    ])

    if (queueConflicts.data && queueConflicts.data.length > 0) {
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Queue Session conflict on ${dateStr}` }
    }

    const realConflicts = reservationConflicts.data?.filter(conflict => {
      if (conflict.status === 'confirmed') return true
      const isRecurring = recurrenceWeeks > 1 || selectedDays.length > 1 // Define if not defined in context, but wait, this variable was used in original code?
      // Ah, I see `isRecurring` used in original code line 302, but I don't see it defined in my replacement chunk yet.
      // It must be defined.
      // Let's rely on recurrenceWeeks > 1 || uniqueSelectedDays.length > 1
      const isRecurringCheck = recurrenceWeeks > 1 || uniqueSelectedDays.length > 1;

      if (userId && conflict.user_id === userId && conflict.status === 'pending_payment' && !isRecurringCheck) return false
      if (userId && conflict.user_id !== userId) return true
      if (!userId) return true
      return isRecurringCheck
    }) || []

    if (realConflicts.length > 0) {
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Already reserved on ${dateStr}` }
    }
  }

  return { available: true }
}

/**
 * Server Action: Create a new reservation
 */
export async function createReservationAction(data: {
  courtId: string
  userId: string
  startTimeISO: string
  endTimeISO: string
  totalAmount: number
  numPlayers?: number
  paymentType?: 'full' | 'split'
  paymentMethod?: 'cash' | 'e-wallet'
  notes?: string
  discountApplied?: number
  discountType?: string
  discountReason?: string
  recurrenceWeeks?: number
  selectedDays?: number[] // Array of day indices (0-6)
}): Promise<{ success: boolean; reservationId?: string; error?: string; count?: number; downPaymentRequired?: boolean; downPaymentAmount?: number }> {
  const supabase = await createClient()

  // Use the shared service
  const result = await createReservation(supabase, data)

  if (result.success) {
    revalidatePath('/reservations')
    revalidatePath('/bookings')
  }

  return result
}

/**
 * Server Action: Cancel a reservation
 * Validates auth, ownership, status, and 24-hour policy
 */
export async function cancelReservationAction(reservationId: string) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. Fetch reservation and verify ownership
  const { data: booking, error: fetchError } = await supabase
    .from('reservations')
    .select('id, user_id, status, start_time')
    .eq('id', reservationId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found' }
  }

  if (booking.user_id !== user.id) {
    return { success: false, error: 'You do not have permission to cancel this booking' }
  }

  // 3. Status check — only active bookings can be cancelled
  const cancellableStatuses = ['pending_payment', 'pending', 'confirmed']
  if (!cancellableStatuses.includes(booking.status)) {
    return { success: false, error: `Cannot cancel a booking with status: ${booking.status}` }
  }

  // 4. 24-hour policy — cannot cancel within 24 hours of start time
  const hoursUntilStart = (new Date(booking.start_time).getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntilStart < 24) {
    return { success: false, error: 'Cannot cancel within 24 hours of booking start time' }
  }

  // 5. Perform cancellation
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', reservationId)

  if (error) {
    console.error('Error cancelling reservation:', error)
    return { success: false, error: 'Failed to cancel reservation' }
  }

  revalidatePath('/reservations')
  revalidatePath('/bookings')

  return { success: true }
}

/**
 * Server Action: Clean up old pending reservations (development/testing only)
 * Cancels pending reservations older than the specified minutes
 */
export async function cleanupOldPendingReservationsAction(olderThanMinutes: number = 5) {
  const supabase = await createClient()

  // Calculate cutoff time
  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000)
  const cutoffTimeISO = cutoffTime.toISOString()

  console.log(`Cleaning up pending reservations older than ${cutoffTimeISO}`)

  // Find old pending reservations
  const { data: oldReservations, error: fetchError } = await supabase
    .from('reservations')
    .select('id, created_at, start_time, end_time, user_id')
    .in('status', ['pending_payment'])
    .lt('created_at', cutoffTimeISO)

  if (fetchError) {
    console.error('Error fetching old reservations:', fetchError)
    return { success: false, error: 'Failed to fetch old reservations', count: 0 }
  }

  if (!oldReservations || oldReservations.length === 0) {
    console.log('No old pending reservations found')
    return { success: true, count: 0 }
  }

  console.log(`Found ${oldReservations.length} old pending reservations to clean up:`, oldReservations)

  // Cancel them
  const { error: updateError } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .in('status', ['pending_payment'])
    .lt('created_at', cutoffTimeISO)

  if (updateError) {
    console.error('Error cancelling old reservations:', updateError)
    return { success: false, error: 'Failed to cancel old reservations', count: 0 }
  }

  revalidatePath('/reservations')

  return {
    success: true,
    count: oldReservations.length,
    message: `Cancelled ${oldReservations.length} old pending reservations`
  }
}
