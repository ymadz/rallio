'use server'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { revalidatePath } from 'next/cache'

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

  const [reservationsResult, queueSessionsResult] = await Promise.all([
    // Get reservations
    supabase
      .from('reservations')
      .select('start_time, end_time, status')
      .eq('court_id', courtId)
      .gte('end_time', `${dateOnlyString}T00:00:00`)
      .lt('start_time', `${dateOnlyString}T23:59:59`)
      .in('status', activeStatuses),

    // Get queue sessions
    supabase
      .from('queue_sessions')
      .select('start_time, end_time, status, approval_status')
      .eq('court_id', courtId)
      .gte('end_time', `${dateOnlyString}T00:00:00`)
      .lt('start_time', `${dateOnlyString}T23:59:59`)
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
  console.log(`[Availability Check] Total booked slots: ${allBookedSlots.length}`)

  // Mark unavailable slots based on existing reservations AND queue sessions
  if (allBookedSlots && allBookedSlots.length > 0) {
    for (const reservation of allBookedSlots) {
      try {
        // Parse ISO timestamps to get local hours
        const startTime = new Date(reservation.start_time)
        const endTime = new Date(reservation.end_time)

        const startHour = startTime.getHours()
        const endHour = endTime.getHours()

        // If end time has minutes (e.g., 14:30), we need to block that hour too
        const endHourCeil = endTime.getMinutes() > 0 ? endHour + 1 : endHour

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
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  const supabase = await createClient()

  const startTime = new Date(data.startTimeISO)
  const endTime = new Date(data.endTimeISO)

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    console.error('Invalid reservation timestamps received', {
      startTimeISO: data.startTimeISO,
      endTimeISO: data.endTimeISO,
    })
    return {
      success: false,
      error: 'Invalid reservation time. Please reselect your schedule.',
    }
  }

  if (endTime <= startTime) {
    console.error('Reservation end time must be after start time', {
      startTimeISO: data.startTimeISO,
      endTimeISO: data.endTimeISO,
    })
    return {
      success: false,
      error: 'Reservation end time must be after the start time.',
    }
  }

  const startTimeISO = startTime.toISOString()
  const endTimeISO = endTime.toISOString()

  // Check for reservation statuses that represent active bookings
  // With migration 006: 'pending_payment', 'pending', 'paid', 'confirmed'
  // Without migration 006: 'pending', 'confirmed'
  const conflictStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']

  console.log('Checking for conflicts:', {
    courtId: data.courtId,
    userId: data.userId,
    startTimeISO,
    endTimeISO,
    statuses: conflictStatuses
  })

  // Check for conflicts in BOTH reservations AND queue_sessions
  // A conflict exists if the time ranges overlap for the same court
  const [reservationConflicts, queueConflicts] = await Promise.all([
    // Check reservation conflicts
    supabase
      .from('reservations')
      .select('id, start_time, end_time, status, user_id, created_at')
      .eq('court_id', data.courtId)
      .in('status', conflictStatuses)
      .lt('start_time', endTimeISO)
      .gt('end_time', startTimeISO),

    // Check queue session conflicts
    supabase
      .from('queue_sessions')
      .select('id, start_time, end_time, status, approval_status')
      .eq('court_id', data.courtId)
      .in('status', ['draft', 'active', 'pending_approval'])
      .in('approval_status', ['pending', 'approved'])
      .lt('start_time', endTimeISO)
      .gt('end_time', startTimeISO)
  ])

  if (reservationConflicts.error) {
    console.error('Error checking for reservation conflicts:', reservationConflicts.error)
    // Continue anyway - better to attempt creation than block user
  }

  if (queueConflicts.error) {
    console.error('Error checking for queue conflicts:', queueConflicts.error)
  }

  console.log('Found potential reservation conflicts:', reservationConflicts.data)
  console.log('Found potential queue session conflicts:', queueConflicts.data)

  // Check for queue session conflicts first (hard block)
  if (queueConflicts.data && queueConflicts.data.length > 0) {
    const queueSession = queueConflicts.data[0]
    const queueStart = new Date(queueSession.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const queueEnd = new Date(queueSession.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    console.warn('⚠️ Queue session conflict detected:', queueSession)
    return {
      success: false,
      error: `This time slot is reserved for a queue session (${queueStart} - ${queueEnd}). Please choose a different time.`,
    }
  }

  const conflicts = reservationConflicts.data

  // Filter out conflicts that are:
  // - Very recent (< 2 minutes old) pending reservations from the same user
  // - This handles the case where a user accidentally triggers multiple reservation attempts
  const now = new Date()
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)

  const realConflicts = conflicts?.filter(conflict => {
    // If it's a confirmed or paid reservation, it's always a real conflict
    // Note: 'paid' is a valid status if migration 006 has been applied
    if (conflict.status === 'confirmed' || conflict.status === 'paid') {
      return true
    }

    // If it's a pending or pending_payment reservation from a different user, it's a real conflict
    if (conflict.user_id !== data.userId) {
      return true
    }

    // If it's a pending reservation from the same user, check how old it is
    const createdAt = new Date(conflict.created_at)
    const isVeryRecent = createdAt > twoMinutesAgo

    if (isVeryRecent) {
      console.log(`Ignoring very recent pending reservation from same user: ${conflict.id} (created ${Math.round((now.getTime() - createdAt.getTime()) / 1000)}s ago)`)
      return false // Not a real conflict, likely a duplicate attempt
    }

    return true // Old pending reservation, could be legitimate
  }) || []

  console.log('Real conflicts after filtering:', realConflicts)

  if (realConflicts.length > 0) {
    console.warn('Time slot conflict detected:', realConflicts[0])
    return {
      success: false,
      error: 'This time slot is already booked. Please choose another time.',
    }
  }

  // Create the reservation
  const initialStatus = 'pending_payment'

  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      court_id: data.courtId,
      user_id: data.userId,
      start_time: startTimeISO,
      end_time: endTimeISO,
      status: initialStatus,
      total_amount: data.totalAmount,
      amount_paid: 0,
      num_players: data.numPlayers || 1,
      payment_type: data.paymentType || 'full',
      discount_applied: data.discountApplied || 0,
      discount_type: data.discountType || null,
      discount_reason: data.discountReason || null,
      metadata: {
        booking_origin: 'web_checkout',
        intended_payment_method: data.paymentMethod ?? null,
      },
      notes: data.notes,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating reservation:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))

    const overlapViolation =
      error?.code === '23P01' ||
      error?.code === '23505' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('no_overlapping_reservations') ||
         error.message.toLowerCase().includes('overlap')))

    if (overlapViolation) {
      return {
        success: false,
        error: 'This time slot has just been reserved. Please choose another time.',
      }
    }

    return {
      success: false,
      error: error.message || error.details || 'Failed to create reservation. Please try again.',
    }
  }

  revalidatePath('/reservations')
  revalidatePath('/bookings')

  return {
    success: true,
    reservationId: reservation.id,
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
