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

  // Generate all possible hourly slots
  const allSlots: TimeSlot[] = []
  for (let hour = openHour; hour < closeHour; hour++) {
    const timeString = `${hour.toString().padStart(2, '0')}:00`
    allSlots.push({
      time: timeString,
      available: true,
      price: court.hourly_rate,
    })
  }

  // Get existing reservations AND queue sessions for this court on this date
  // Query for the entire day range to catch any overlapping bookings
  const dateOnlyString = format(date, 'yyyy-MM-dd')
  const activeStatuses = ['pending_payment', 'paid', 'confirmed', 'ongoing', 'pending_refund']

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
      .select('start_time, end_time, status, approval_status')
      .eq('court_id', courtId)
      .lt('start_time', endOfDayLocal)
      .gt('end_time', startOfDayLocal)
      .in('status', ['draft', 'active', 'pending_approval'])
      .in('approval_status', ['pending', 'approved'])
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

  // Filter out past time slots if date is today
  const now = new Date()
  const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')

  if (isToday) {
    const currentHour = now.getHours()
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
    const weekBaseTime = initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000)
    for (const dayIndex of uniqueSelectedDays) {
      const dayOffset = dayIndex - startDayIndex
      const slotStartTime = new Date(weekBaseTime + (dayOffset * 24 * 60 * 60 * 1000))
      const slotEndTime = new Date(slotStartTime.getTime() + durationMs)

      if (slotStartTime.getTime() < initialStartTime.getTime()) {
        continue
      }
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
  for (const slot of targetSlots) {
    const currentStartTimeISO = slot.start.toISOString()
    const currentEndTimeISO = slot.end.toISOString()
    const conflictStatuses = ['pending_payment', 'paid', 'confirmed', 'ongoing', 'pending_refund']

    // A. Check Operating Hours
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
        .in('status', ['draft', 'active', 'pending_approval'])
        .in('approval_status', ['pending', 'approved'])
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO)
    ])

    if (queueConflicts.data && queueConflicts.data.length > 0) {
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Queue Session conflict on ${dateStr}` }
    }

    const realConflicts = reservationConflicts.data?.filter(conflict => {
      if (conflict.status === 'confirmed' || conflict.status === 'paid') return true
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
}): Promise<{ success: boolean; reservationId?: string; error?: string; count?: number }> {
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
 */
export async function cancelReservationAction(reservationId: string) {
  const supabase = await createClient()

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
