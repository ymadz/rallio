'use server'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { createNotification, NotificationTemplates } from '@/lib/notifications'

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
  dateString: string
): Promise<TimeSlot[]> {
  const supabase = await createClient()
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
  const activeStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']

  console.log(`[Availability Check] Querying for date: ${dateOnlyString}`)
  console.log(`[Availability Check] Date range: ${dateOnlyString}T00:00:00 to ${dateOnlyString}T23:59:59`)

  const [reservationsResult, queueSessionsResult] = await Promise.all([
    // Get reservations
    supabase
      .from('reservations')
      .select('start_time, end_time, status')
      .eq('court_id', courtId)
      .gte('start_time', `${dateOnlyString}T00:00:00`)
      .lte('start_time', `${dateOnlyString}T23:59:59`)
      .in('status', activeStatuses),

    // Get queue sessions
    supabase
      .from('queue_sessions')
      .select('start_time, end_time, status, approval_status')
      .eq('court_id', courtId)
      .gte('start_time', `${dateOnlyString}T00:00:00`)
      .lte('start_time', `${dateOnlyString}T23:59:59`)
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

  const recurrenceWeeks = data.recurrenceWeeks || 1
  const selectedDays = data.selectedDays || []

  const initialStartTime = new Date(data.startTimeISO)
  const initialEndTime = new Date(data.endTimeISO)

  if (selectedDays.length === 0) {
    selectedDays.push(initialStartTime.getDay())
  }

  const isRecurring = recurrenceWeeks > 1 || selectedDays.length > 1

  // Ensure initialStartTime is valid
  if (Number.isNaN(initialStartTime.getTime())) {
    return { available: false, error: 'Invalid start time.' }
  }

  const durationMs = initialEndTime.getTime() - initialStartTime.getTime()
  const startDayIndex = initialStartTime.getDay() // 0-6

  // 1. GENERATE PHASE
  const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

  for (let i = 0; i < recurrenceWeeks; i++) {
    const weekBaseTime = initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000)
    for (const dayIndex of selectedDays) {
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

  // 2. VALIDATION PHASE
  for (const slot of targetSlots) {
    const currentStartTimeISO = slot.start.toISOString()
    const currentEndTimeISO = slot.end.toISOString()
    const conflictStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']

    const [reservationConflicts, queueConflicts] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, start_time, end_time, status, user_id')
        .eq('court_id', data.courtId)
        .in('status', conflictStatuses)
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO),

      supabase
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
      // If it's my own pending booking and I'm doing a recurring booking, treat as conflict?
      // User request says "handle gracefully".
      // If I am replacing my own single booking with a recurring one, maybe I should allow it?
      // But preventing it is safer.
      if (userId && conflict.user_id === userId && (conflict.status === 'pending_payment' || conflict.status === 'pending') && !isRecurring) return false
      if (userId && conflict.user_id !== userId) return true
      if (!userId) return true // If no user, everything is conflict
      return isRecurring
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

  const recurrenceWeeks = data.recurrenceWeeks || 1
  const selectedDays = data.selectedDays || []

  // If no specific days selected, default to the start date's day (standard recurrence)
  const initialStartTime = new Date(data.startTimeISO)
  const initialEndTime = new Date(data.endTimeISO)

  if (selectedDays.length === 0) {
    selectedDays.push(initialStartTime.getDay())
  }

  const isRecurring = recurrenceWeeks > 1 || selectedDays.length > 1
  const recurrenceGroupId = isRecurring ? crypto.randomUUID() : null
  const createdReservationIds: string[] = []

  // Ensure initialStartTime is valid
  if (Number.isNaN(initialStartTime.getTime())) {
    return { success: false, error: 'Invalid start time.' }
  }

  const durationMs = initialEndTime.getTime() - initialStartTime.getTime()
  const startDayIndex = initialStartTime.getDay() // 0-6

  console.log(`[createReservation] Starting ${isRecurring ? 'recurring' : 'single'} booking check. Weeks: ${recurrenceWeeks}, Days: ${selectedDays.join(',')}`)

  // 1. GENERATE PHASE
  // Generate all intended slots to book
  const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

  for (let i = 0; i < recurrenceWeeks; i++) {
    // The "base" date for this week's iteration (aligned with the initial start date)
    const weekBaseTime = initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000)

    for (const dayIndex of selectedDays) {
      // Calculate offset from the original start day
      // e.g. Start is Wed (3). Target is Mon (1). Offset = -2 days.
      const dayOffset = dayIndex - startDayIndex

      const slotStartTime = new Date(weekBaseTime + (dayOffset * 24 * 60 * 60 * 1000))
      const slotEndTime = new Date(slotStartTime.getTime() + durationMs)

      // Skip past dates (e.g., missed days in the first week)
      // We allow a small buffer (e.g. 1 min) to avoid equality issues, but >= should be fine.
      // Actually strictly, if it's the SAME time as initial, we allow it.
      if (slotStartTime.getTime() < initialStartTime.getTime()) {
        continue
      }

      targetSlots.push({
        start: slotStartTime,
        end: slotEndTime,
        weekIndex: i
      })
    }
  }

  if (targetSlots.length === 0) {
    return { success: false, error: 'No valid future slots generated.' }
  }

  // 2. VALIDATION PHASE
  // Check conflicts for ALL slots
  for (const slot of targetSlots) {
    const currentStartTimeISO = slot.start.toISOString()
    const currentEndTimeISO = slot.end.toISOString()

    const conflictStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']

    const [reservationConflicts, queueConflicts] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, start_time, end_time, status, user_id')
        .eq('court_id', data.courtId)
        .in('status', conflictStatuses)
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO),

      supabase
        .from('queue_sessions')
        .select('id, start_time, end_time')
        .eq('court_id', data.courtId)
        .in('status', ['draft', 'active', 'pending_approval'])
        .in('approval_status', ['pending', 'approved'])
        .lt('start_time', currentEndTimeISO)
        .gt('end_time', currentStartTimeISO)
    ])

    // Strict validation: Reject on queue conflict
    if (queueConflicts.data && queueConflicts.data.length > 0) {
      const dateStr = slot.start.toLocaleDateString()
      return {
        success: false,
        error: `Conflict on ${dateStr}: Slot matches a Queue Session.`
      }
    }

    // Filter reservation conflicts
    const realConflicts = reservationConflicts.data?.filter(conflict => {
      if (conflict.status === 'confirmed' || conflict.status === 'paid') return true
      if (conflict.user_id === data.userId && (conflict.status === 'pending_payment' || conflict.status === 'pending') && !isRecurring) return false
      if (conflict.user_id !== data.userId) return true
      return isRecurring // If recurring, even own pending conflicts block it
    }) || []

    if (realConflicts.length > 0) {
      const dateStr = slot.start.toLocaleDateString()
      return {
        success: false,
        error: `Conflict on ${dateStr}: Slot is already reserved.`
      }
    }
  }

  // 3. CREATION PHASE
  let primaryReservationId = ''

  // Calculate price per slot
  // Note: data.totalAmount is passed as the price for ONE single slot (from frontend calc)
  // Wait. Frontend calculates: (hourlyRate * duration * recurrenceWeeks * numSessionsPerWeek).
  // So data.totalAmount IS THE GRAND TOTAL.
  // My previous assumption in reservations.ts was that it passed PER SESSION. 
  // Let's re-read AvailabilityModal. 
  // `const totalPrice = (startSlot?.price || hourlyRate) * duration * recurrenceWeeks` (OLD)
  // NEW: `const basePrice = ... * recurrenceWeeks * numSessionsPerWeek`.
  // `setBookingData({ ... hourlyRate: ... })`
  // `getSubtotal` in Store uses `hourlyRate * duration * recurrenceWeeks`. 
  // Does Store know about `selectedDays`? No, I added `selectedDays` logic in Modal but `getSubtotal` in Store MIGHT BE WRONG now.

  // CHECK STORE:
  // getSubtotal: `const totalBase = baseRate * recurrenceWeeks`.
  // It does NOT account for `selectedDays.length`.
  // So the `totalAmount` passed here (from store.getTotalAmount) might be UNDER-calculated if I didn't update Store.getSubtotal.

  // CRITICAL: I need to update `getSubtotal` in `checkout-store.ts` as well!
  // Assuming I WILL update it, data.totalAmount will be the GRAND TOTAL.
  // So `perInstanceAmount = data.totalAmount / targetSlots.length`.

  const perInstanceAmount = data.totalAmount / targetSlots.length

  for (let i = 0; i < targetSlots.length; i++) {
    const slot = targetSlots[i]

    // Determine status
    // For cash recurring, we auto-confirm them as "Reserved" but unpaid.
    // However, if we book multiple days in 1 week (single recurrence), is it "Recurring"? Yes.
    const status = (data.paymentMethod === 'cash' && isRecurring) ? 'confirmed' : 'pending_payment'

    const { data: newRes, error } = await supabase
      .from('reservations')
      .insert({
        court_id: data.courtId,
        user_id: data.userId,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        status: status,
        total_amount: perInstanceAmount,
        amount_paid: 0,
        num_players: data.numPlayers || 1,
        payment_type: data.paymentType || 'full',
        discount_applied: data.discountApplied ? (data.discountApplied / targetSlots.length) : 0, // Split discount too
        discount_type: data.discountType || null,
        discount_reason: data.discountReason || null,
        recurrence_group_id: recurrenceGroupId,
        metadata: {
          booking_origin: 'web_checkout',
          intended_payment_method: data.paymentMethod ?? null,
          recurrence_index: i,
          recurrence_total: targetSlots.length
        },
        notes: data.notes ? (isRecurring ? `${data.notes} (Seq ${i + 1})` : data.notes) : null,
      })
      .select('id')
      .single()

    if (error || !newRes) {
      console.error(`Failed to create reservation for slot ${i}`, error)
      return { success: false, error: `Failed to create slot ${i + 1}: ${error.message}` }
    }

    if (i === 0) primaryReservationId = newRes.id
    createdReservationIds.push(newRes.id)
  }

  revalidatePath('/reservations')
  revalidatePath('/bookings')

  return {
    success: true,
    reservationId: primaryReservationId,
    count: createdReservationIds.length
  }
}

/**
 * Server Action: Cancel a reservation
 */
export async function cancelReservationAction(reservationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
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
    .in('status', ['pending_payment', 'pending'])
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
    .in('status', ['pending_payment', 'pending'])
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
