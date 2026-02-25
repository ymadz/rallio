
import { createServiceClient } from '@/lib/supabase/service'
import { SupabaseClient } from '@supabase/supabase-js'

export async function createReservation(
    supabase: SupabaseClient,
    data: {
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
    }) {
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
    // Deduplicate and sort selected days to prevent duplicate slots
    const uniqueSelectedDays = Array.from(new Set(selectedDays)).sort((a, b) => a - b)
    const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

    for (let i = 0; i < recurrenceWeeks; i++) {
        for (const dayIndex of uniqueSelectedDays) {
            const dayOffset = (dayIndex - startDayIndex + 7) % 7

            const slotStartTime = new Date(initialStartTime.getTime())
            slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)

            const slotEndTime = new Date(slotStartTime.getTime() + durationMs)

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

    // Check for internal overlaps
    targetSlots.sort((a, b) => a.start.getTime() - b.start.getTime())
    for (let i = 0; i < targetSlots.length - 1; i++) {
        const current = targetSlots[i]
        const next = targetSlots[i + 1]

        if (current.end.getTime() > next.start.getTime()) {
            return { success: false, error: 'Booking Request Invalid: Generated slots overlap with each other.' }
        }
    }

    // 2. VALIDATION PHASE
    // Check conflicts for ALL slots
    // Use adminDb for strict validation to prevent double bookings
    const adminDb = createServiceClient()

    for (const slot of targetSlots) {
        const currentStartTimeISO = slot.start.toISOString()
        const currentEndTimeISO = slot.end.toISOString()

        const conflictStatuses = ['pending_payment', 'confirmed', 'ongoing', 'pending_refund']

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
            if (conflict.status === 'confirmed') return true
            if (conflict.user_id === data.userId && conflict.status === 'pending_payment' && !isRecurring) return false
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
    // Assuming totalAmount is Grand Total
    const perInstanceAmount = data.totalAmount / targetSlots.length

    for (let i = 0; i < targetSlots.length; i++) {
        const slot = targetSlots[i]

        // Determine status
        // All reservations start as pending_payment regardless of payment method.
        // Cash bookings require court admin to mark as paid before they become confirmed.
        // E-wallet bookings get confirmed automatically via PayMongo webhook.
        const status = 'pending_payment'

        // Calculate cash payment deadline: 2 hours before start_time
        // This gives players time to go to the venue and pay in person.
        // If start_time is less than 2 hours from now, deadline = now + 30 min (minimum window).
        let cashPaymentDeadline: string | null = null
        if (data.paymentMethod === 'cash') {
            const twoHoursBefore = new Date(slot.start.getTime() - 2 * 60 * 60 * 1000)
            const minimumDeadline = new Date(Date.now() + 30 * 60 * 1000) // 30 min from now
            const deadline = twoHoursBefore > minimumDeadline ? twoHoursBefore : minimumDeadline
            cashPaymentDeadline = deadline.toISOString()
        }

        // Use USER SCOPED Client for INSERT to respect RLS
        // (Ensure the passed client has an authenticated user)
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
                payment_method: data.paymentMethod || null,
                cash_payment_deadline: cashPaymentDeadline,
                discount_applied: data.discountApplied ? (data.discountApplied / targetSlots.length) : 0, // Split discount too
                discount_type: data.discountType || null,
                discount_reason: data.discountReason || null,
                recurrence_group_id: recurrenceGroupId,
                metadata: {
                    booking_origin: 'web_checkout',
                    intended_payment_method: data.paymentMethod ?? null,
                    recurrence_index: i,
                    recurrence_total: targetSlots.length,
                    // Add week-specific metadata for proper display
                    week_index: slot.weekIndex,
                    weeks_total: recurrenceWeeks,
                    days_per_week: uniqueSelectedDays.length
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

    return {
        success: true,
        reservationId: primaryReservationId,
        recurrenceGroupId: recurrenceGroupId || undefined,
        count: createdReservationIds.length
    }
}
