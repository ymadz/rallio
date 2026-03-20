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

interface DailyAvailabilitySummary {
  totalSlots: number
  availableSlots: number
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
      opening_hours,
      venue:venues (
        id,
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
  const venueData = (court as any).venue
  const openingHours = (court.opening_hours || venueData?.opening_hours) as Record<string, { open: string; close: string }> | null
  const dayHours = openingHours?.[dayOfWeek]

  if (!dayHours) {
    return [] // Venue closed on this day
  }

  // Parse opening and closing times
  const [openHour] = dayHours.open.split(':').map(Number)
  let [closeHour] = dayHours.close.split(':').map(Number)
  // Handle midnight close ("00:00" = end of day) and data entry errors where
  // close <= open (e.g., "12:00" entered instead of "00:00" for midnight)
  if (closeHour === 0 || closeHour <= openHour) closeHour = 24

  // Get existing reservations AND queue sessions for this court on this date
  // Query for the entire day range to catch any overlapping bookings
  const dateOnlyString = format(date, 'yyyy-MM-dd')
  const activeStatuses = ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

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
  // The venue close hour determines the absolute latest a booking can end.
  // We use <= to include the slot that starts at the close hour if needed,
  // but wait, if it closes at 22:00, the last 1-hour slot starts at 21:00.
  // Actually, some venues might allow booking *up to* closing time.
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
    // We need to compare against the queried day's boundaries in Manila time
    const dayStartTS = new Date(startOfDayLocal).getTime()
    const dayEndTS = new Date(endOfDayLocal).getTime()

    for (const reservation of allBookedSlots) {
      try {
        const resStartTS = new Date(reservation.start_time).getTime()
        const resEndTS = new Date(reservation.end_time).getTime()

        // Iterate through all candidate slots for the current day
        for (const slot of allSlots) {
          // Construct the actual timestamp for this 1-hour slot on the queried date
          // Each slot.time is "HH:00"
          const [h] = slot.time.split(':').map(Number)
          const slotStartTS = new Date(dateOnlyString + `T${h.toString().padStart(2, '0')}:00:00+08:00`).getTime()
          const slotEndTS = slotStartTS + (60 * 60 * 1000) // +1 hour

          // Standard overlap check: (StartA < EndB) AND (EndA > StartB)
          if (resStartTS < slotEndTS && resEndTS > slotStartTS) {
            slot.available = false
            console.log(`[Availability Check] Marking ${slot.time} as unavailable due to overlap with ${reservation.start_time} - ${reservation.end_time}`)
          }
        }
      } catch (error) {
        console.error('[Availability Check] Error parsing reservation time:', error, reservation)
      }
    }
  }

  // Filter out past time slots if date is today (in Asia/Manila timezone)
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
  const manilaNow = new Date(Date.now() + MANILA_OFFSET_MS)
  const todayString = manilaNow.toISOString().split('T')[0]
  const isToday = dateString === todayString

  if (isToday) {
    const currentHour = manilaNow.getUTCHours()
    return allSlots.filter((slot) => {
      const slotHour = parseInt(slot.time.split(':')[0])
      return slotHour > currentHour
    })
  }

  return allSlots
}

/**
 * Server Action: Get daily venue-wide availability summary for a date range.
 * Useful for calendar date-state rendering (fully booked, low availability badges).
 */
export async function getVenueDailyAvailabilitySummaryAction(params: {
  venueId: string
  startDate: string
  endDate: string
}): Promise<Record<string, DailyAvailabilitySummary>> {
  const adminDb = createServiceClient()

  const { venueId, startDate, endDate } = params
  if (!venueId || !startDate || !endDate) return {}

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return {}

  const { data: courts, error: courtsError } = await adminDb
    .from('courts')
    .select(`
      id,
      opening_hours,
      venue:venues(opening_hours)
    `)
    .eq('venue_id', venueId)
    .eq('is_active', true)

  if (courtsError || !courts || courts.length === 0) {
    if (courtsError) {
      console.error('[getVenueDailyAvailabilitySummaryAction] Courts query failed:', courtsError)
    }
    return {}
  }

  const courtIds = courts.map((court: any) => court.id)
  const activeReservationStatuses = [
    'pending_payment',
    'partially_paid',
    'confirmed',
    'ongoing',
    'pending_refund',
    'completed',
    'no_show',
  ]

  const startRangeLocal = `${startDate}T00:00:00+08:00`
  const endRangeLocal = `${endDate}T23:59:59+08:00`

  const [reservationsResult, queueSessionsResult] = await Promise.all([
    adminDb
      .from('reservations')
      .select('court_id, start_time, end_time')
      .in('court_id', courtIds)
      .in('status', activeReservationStatuses)
      .lt('start_time', endRangeLocal)
      .gt('end_time', startRangeLocal),
    adminDb
      .from('queue_sessions')
      .select('court_id, start_time, end_time')
      .in('court_id', courtIds)
      .in('status', ['pending_payment', 'open', 'active'])
      .lt('start_time', endRangeLocal)
      .gt('end_time', startRangeLocal),
  ])

  if (reservationsResult.error) {
    console.error('[getVenueDailyAvailabilitySummaryAction] Reservations query failed:', reservationsResult.error)
  }
  if (queueSessionsResult.error) {
    console.error('[getVenueDailyAvailabilitySummaryAction] Queue sessions query failed:', queueSessionsResult.error)
  }

  const bookedByCourt: Record<string, Array<{ start: string; end: string }>> = {}

  for (const reservation of reservationsResult.data || []) {
    if (!bookedByCourt[reservation.court_id]) bookedByCourt[reservation.court_id] = []
    bookedByCourt[reservation.court_id].push({ start: reservation.start_time, end: reservation.end_time })
  }

  for (const queueSession of queueSessionsResult.data || []) {
    if (!bookedByCourt[queueSession.court_id]) bookedByCourt[queueSession.court_id] = []
    bookedByCourt[queueSession.court_id].push({ start: queueSession.start_time, end: queueSession.end_time })
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const summary: Record<string, DailyAvailabilitySummary> = {}

  const cursor = new Date(start)
  while (cursor <= end) {
    const dateKey = format(cursor, 'yyyy-MM-dd')
    summary[dateKey] = { totalSlots: 0, availableSlots: 0 }

    const dayOfWeek = dayNames[cursor.getDay()]

    for (const court of courts as any[]) {
      const venueData = court.venue
      const openingHours =
        (court.opening_hours || venueData?.opening_hours) as
          | Record<string, { open: string; close: string }>
          | null

      const dayHours = openingHours?.[dayOfWeek]
      if (!dayHours) continue

      const [openHour] = dayHours.open.split(':').map(Number)
      let [closeHour] = dayHours.close.split(':').map(Number)
      if (closeHour === 0 || closeHour <= openHour) closeHour = 24

      const daySlots: Array<{ startTS: number; endTS: number }> = []
      for (let hour = openHour; hour < closeHour; hour++) {
        const hourString = hour.toString().padStart(2, '0')
        const slotStartTS = new Date(`${dateKey}T${hourString}:00:00+08:00`).getTime()
        const slotEndTS = slotStartTS + 60 * 60 * 1000
        daySlots.push({ startTS: slotStartTS, endTS: slotEndTS })
      }

      summary[dateKey].totalSlots += daySlots.length

      const events = bookedByCourt[court.id] || []
      let availableForCourt = 0

      for (const slot of daySlots) {
        const hasConflict = events.some((event) => {
          const eventStartTS = new Date(event.start).getTime()
          const eventEndTS = new Date(event.end).getTime()
          return eventStartTS < slot.endTS && eventEndTS > slot.startTS
        })

        if (!hasConflict) availableForCourt++
      }

      summary[dateKey].availableSlots += availableForCourt
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return summary
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

  // Handle Manila Timezone correctly (+08:00)
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
  const initialManilaTime = new Date(initialStartTime.getTime() + MANILA_OFFSET_MS)
  const startDayIndex = initialManilaTime.getUTCDay() // 0-6

  // 0. FETCH OPERATING HOURS
  const { data: court, error: courtError } = await supabase
    .from('courts')
    .select(`
      id,
      opening_hours,
      venue:venues (
        id,
        opening_hours
      )
    `)
    .eq('id', data.courtId)
    .single()

  if (courtError || !court) {
    return { available: false, error: 'Court not found.' }
  }

  const venueData = (court as any).venue
  const openingHours = (court.opening_hours || venueData?.opening_hours) as Record<string, { open: string; close: string }> | null
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // 1. GENERATE PHASE
  // Deduplicate and sort selected days to prevent duplicate slots
  const uniqueSelectedDays = Array.from(new Set(selectedDays)).sort((a, b) => a - b)
  const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

  for (let i = 0; i < recurrenceWeeks; i++) {
    for (const dayIndex of uniqueSelectedDays) {
      const dayOffset = (dayIndex - startDayIndex + 7) % 7

      const slotStartTime = new Date(initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000) + (dayOffset * 24 * 60 * 60 * 1000))
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
  for (const slot of targetSlots) {
    // A. Check Past Time
    // Strict absolute offset independent of server parsing logic.
    if (slot.start.getTime() < Date.now() - 60000) { // Add 1 minute grace period
      const dateStr = slot.start.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Cannot book a time in the past: ${dateStr}` }
    }

    const currentStartTimeISO = slot.start.toISOString()
    const currentEndTimeISO = slot.end.toISOString()
    const conflictStatuses = ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

    // B. Check Operating Hours using UTC-safe Manila offset
    const manilaSlotStart = new Date(slot.start.getTime() + MANILA_OFFSET_MS)
    const manilaSlotEnd = new Date(slot.end.getTime() + MANILA_OFFSET_MS)

    const dayName = dayNames[manilaSlotStart.getUTCDay()]
    const dayHours = openingHours?.[dayName]

    if (!dayHours) {
      // Venue closed on this day
      const dateStr = slot.start.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' })
      return { available: false, conflictDate: dateStr, error: `Venue is closed on ${dateStr}` }
    }

    // Parse open/close times
    const [openH, openM] = dayHours.open.split(':').map(Number)
    const [closeH, closeM] = dayHours.close.split(':').map(Number)
    // Handle midnight close ("00:00" = end of day) and data entry errors where close <= open
    const effectiveCloseH = (closeH === 0 || closeH <= openH) ? 24 : closeH

    // Parse slot times using explicitly offset UTC methods to bypass Vercel timezones
    const slotStartH = manilaSlotStart.getUTCHours()
    const slotStartM = manilaSlotStart.getUTCMinutes()
    const slotEndH = manilaSlotEnd.getUTCHours()
    const slotEndM = manilaSlotEnd.getUTCMinutes()

    const slotStartMinutes = slotStartH * 60 + slotStartM
    const slotEndMinutes = slotEndH * 60 + slotEndM
    const openMinutes = openH * 60 + (openM || 0)
    const closeMinutes = effectiveCloseH * 60 + (closeM || 0)

    if (slotStartMinutes < openMinutes || slotEndMinutes > closeMinutes) {
      // Slot is outside operating hours
      const dateStr = slot.start.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })
      const timeStr = slot.start.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
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
      const dateStr = slot.start.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
      const dateStr = slot.start.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      return { available: false, conflictDate: dateStr, error: `Already reserved on ${dateStr}` }
    }
  }

  return { available: true }
}

/**
 * Server Action: Check availability for all items in a checkout cart.
 * Identifies conflicts for recurring and multi-court bookings.
 */
export async function checkCartAvailabilityAction(items: Array<{
  courtId: string
  date: string | Date
  startTime: string
  endTime: string
  recurrenceWeeks?: number
  selectedDays?: number[]
}>): Promise<{
  available: boolean
  totalSlots: number
  availableSlots: number
  conflicts: Array<{
    courtId: string
    date: string
    startTime: string
    endTime: string
    reason: string
  }>
}> {
  const adminDb = createServiceClient()

  const sorted = [...items].sort((a, b) => {
    if (a.courtId !== b.courtId) return a.courtId.localeCompare(b.courtId)
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.startTime.localeCompare(b.startTime)
  })

  // Pre-merge phase removed for accurate per-slot grid validation
  const itemsToProcess = sorted

  const allConflicts: Array<{
    courtId: string
    date: string
    startTime: string
    endTime: string
    reason: string
  }> = []
  let totalSlots = 0
  let availableSlots = 0

  for (const item of itemsToProcess) {
    const bookingDate = typeof item.date === 'string' ? new Date(item.date) : item.date
    const [startH, startM] = item.startTime.split(':').map(Number)
    const [endH, endM] = item.endTime.split(':').map(Number)

    const initialStartTime = new Date(bookingDate)
    initialStartTime.setHours(startH, startM || 0, 0, 0)

    const recurrenceWeeks = item.recurrenceWeeks || 1
    const selectedDays = item.selectedDays || []
    const startDayIndex = initialStartTime.getDay()

    const uniqueSelectedDays = selectedDays.length > 0
      ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
      : [startDayIndex]

    for (let i = 0; i < recurrenceWeeks; i++) {
      for (const dayIndex of uniqueSelectedDays) {
        totalSlots++
        const dayOffset = (dayIndex - startDayIndex + 7) % 7
        const slotStart = new Date(initialStartTime.getTime())
        slotStart.setDate(slotStart.getDate() + (i * 7) + dayOffset)

        const slotEnd = new Date(slotStart.getTime())
        slotEnd.setHours(endH, endM || 0, 0, 0)
        
        if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1)

        // Check both reservations and queue sessions for conflicts
        const [reservationsConflicts, queueConflicts] = await Promise.all([
          adminDb
            .from('reservations')
            .select('id')
            .eq('court_id', item.courtId)
            .in('status', ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show'])
            .lt('start_time', slotEnd.toISOString())
            .gt('end_time', slotStart.toISOString())
            .limit(1),
          
          adminDb
            .from('queue_sessions')
            .select('id')
            .eq('court_id', item.courtId)
            .in('status', ['pending_payment', 'open', 'active'])
            .lt('start_time', slotEnd.toISOString())
            .gt('end_time', slotStart.toISOString())
            .limit(1)
        ])

        const hasConflict = 
          (reservationsConflicts.data && reservationsConflicts.data.length > 0) || 
          (queueConflicts.data && queueConflicts.data.length > 0)

        if (hasConflict) {
          allConflicts.push({
            courtId: item.courtId,
            date: slotStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            startTime: item.startTime,
            endTime: item.endTime,
            reason: 'Slot already reserved'
          })
        } else {
          availableSlots++
        }
      }
    }
  }

  return {
    available: allConflicts.length === 0,
    totalSlots,
    availableSlots,
    conflicts: allConflicts
  }
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
  customDownPaymentAmount?: number
  promoCode?: string
  targetDateCount?: number // Number of unique dates in the bulk booking
}): Promise<{ success: boolean; bookingId?: string; reservationId?: string; error?: string; count?: number; downPaymentRequired?: boolean; downPaymentAmount?: number }> {
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
 * Server Action: Create multiple reservations for a single checkout group.
 * This powers multi-court booking with a unified payment flow.
 */
export async function createMultiCourtReservationsAction(data: {
  userId: string
  customDownPaymentAmount?: number
  promoCode?: string
  items: Array<{
    courtId: string
    startTimeISO: string
    endTimeISO: string
    totalAmount: number
    paymentType?: 'full' | 'split'
    paymentMethod?: 'cash' | 'e-wallet'
    notes?: string
    numPlayers?: number
  }>
}): Promise<{
  success: boolean
  reservationId?: string
  reservationIds?: string[]
  bookingId?: string
  downPaymentRequired?: boolean
  error?: string
}> {
  const supabase = await createClient()

  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'No booking items provided' }
  }

  // MERGE PHASE: Detect and merge consecutive items for the same court and day
  const mergedItems: typeof data.items = []
  
  // Sort items by courtId, then start time to make merging easier
  const sortedItems = [...data.items].sort((a, b) => {
    if (a.courtId !== b.courtId) return a.courtId.localeCompare(b.courtId)
    return a.startTimeISO.localeCompare(b.startTimeISO)
  })

  if (sortedItems.length > 0) {
    let current = { ...sortedItems[0] }
    
    for (let i = 1; i < sortedItems.length; i++) {
      const next = sortedItems[i]
      
      const sameCourt = current.courtId === next.courtId
      const sameDay = new Date(current.startTimeISO).toDateString() === new Date(next.startTimeISO).toDateString()
      const consecutive = current.endTimeISO === next.startTimeISO
      const samePayment = current.paymentType === next.paymentType && current.paymentMethod === next.paymentMethod

      if (sameCourt && sameDay && consecutive && samePayment) {
        // Merge
        current.endTimeISO = next.endTimeISO
        current.totalAmount += next.totalAmount
        // Append notes if they exist and are different
        if (next.notes && current.notes !== next.notes) {
          current.notes = `${current.notes}; ${next.notes}`
        }
      } else {
        mergedItems.push(current)
        current = { ...next }
      }
    }
    mergedItems.push(current)
  }

  const itemsToProcess = mergedItems
  const createdReservationIds: string[] = []
  let downPaymentRequired = false
  let currentBookingId: string | undefined = undefined

  // Phase 2A: Count total unique booking dates for multi_day discount aggregation
  const uniqueDates = new Set(itemsToProcess.map(item => new Date(item.startTimeISO).toDateString()))
  const totalBookingDateCount = uniqueDates.size

  // Phase 4B: Proportional downpayment split instead of an even split
  const grandTotal = itemsToProcess.reduce((s, i) => s + i.totalAmount, 0)

  for (const item of itemsToProcess) {
    const itemDownPayment = data.customDownPaymentAmount && grandTotal > 0
      ? data.customDownPaymentAmount * (item.totalAmount / grandTotal)
      : undefined

    const result = await createReservation(supabase, {
      courtId: item.courtId,
      userId: data.userId,
      startTimeISO: item.startTimeISO,
      endTimeISO: item.endTimeISO,
      totalAmount: item.totalAmount,
      paymentType: item.paymentType || 'full',
      paymentMethod: item.paymentMethod || 'e-wallet',
      notes: item.notes,
      numPlayers: item.numPlayers || 1,
      recurrenceWeeks: 1,
      selectedDays: [],
      bookingId: currentBookingId,
      targetDateCount: totalBookingDateCount,
      customDownPaymentAmount: itemDownPayment,
      promoCode: data.promoCode
    })

    if (!result.success || !result.reservationId) {
      if (createdReservationIds.length > 0) {
        await supabase
          .from('reservations')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Rolled back due to failed multi-court booking creation',
          })
          .in('id', createdReservationIds)
      }

      if (currentBookingId) {
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            metadata: { cancellation_reason: 'Multi-court item creation failed' }
          })
          .eq('id', currentBookingId)
      }

      return {
        success: false,
        error: result.error || 'Failed to create multi-court booking item',
      }
    }

    if (!currentBookingId && result.bookingId) {
      currentBookingId = result.bookingId
    }

    createdReservationIds.push(result.reservationId)
    downPaymentRequired = downPaymentRequired || !!result.downPaymentRequired
  }


  revalidatePath('/reservations')
  revalidatePath('/bookings')

  return {
    success: true,
    reservationId: createdReservationIds[0],
    reservationIds: createdReservationIds,
    bookingId: currentBookingId,
    downPaymentRequired,
  }
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
  const cancellableStatuses = ['pending_payment', 'pending', 'confirmed', 'partially_paid']
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
