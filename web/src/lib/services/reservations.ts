
import { createServiceClient } from '@/lib/supabase/service'
import { SupabaseClient } from '@supabase/supabase-js'
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions'
import { calculatePlatformFeeAmount } from '@/lib/platform-settings'

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
    // Handle Manila Timezone correctly (+08:00)
    // Add 8 hours to UTC time to query Manila days correctly
    const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
    const initialManilaTime = new Date(initialStartTime.getTime() + MANILA_OFFSET_MS)

    // Check if the current booking crosses into the next day relative to start time? No, getUTCDay acts as if it's in Manila.
    const startDayIndex = initialManilaTime.getUTCDay() // 0-6

    console.log(`[createReservation] Starting ${isRecurring ? 'recurring' : 'single'} booking check. Weeks: ${recurrenceWeeks}, Days: ${selectedDays.join(',')}`)

    // 1. GENERATE PHASE
    // Generate all intended slots to book
    // Deduplicate and sort selected days to prevent duplicate slots
    const uniqueSelectedDays = Array.from(new Set(selectedDays)).sort((a, b) => a - b)
    const targetSlots: { start: Date; end: Date; weekIndex: number }[] = []

    for (let i = 0; i < recurrenceWeeks; i++) {
        for (const dayIndex of uniqueSelectedDays) {
            const dayOffset = (dayIndex - startDayIndex + 7) % 7

            const slotStartTime = new Date(initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000) + (dayOffset * 24 * 60 * 60 * 1000))
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
        // A. Check Past Time using absolute UNIX timestamps completely isolated from Vercel timezones
        if (slot.start.getTime() < Date.now() - 60000) {
            return {
                success: false,
                error: `Booking Request Invalid: Cannot book a time in the past.`
            }
        }

        const currentStartTimeISO = slot.start.toISOString()
        const currentEndTimeISO = slot.end.toISOString()

        const conflictStatuses = ['pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

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

        // Filter reservation conflicts — ALL active reservations are real conflicts
        // (including the user's own pending reservations, since those hold the slot)
        const realConflicts = reservationConflicts.data?.filter(conflict => {
            return ['pending_payment', 'partially_paid', 'confirmed', 'ongoing'].includes(conflict.status)
        }) || []

        if (realConflicts.length > 0) {
            const dateStr = slot.start.toLocaleDateString()
            return {
                success: false,
                error: `Conflict on ${dateStr}: Slot is already reserved.`
            }
        }
    }

    // 2.5 PRICE CALCULATION AND DISCOUNT VALIDATION PHASE
    // Fetch Court to get hourly rate and venue details
    const { data: court, error: courtError } = await adminDb
        .from('courts')
        .select(`
            hourly_rate, 
            venue_id,
            venues (metadata)
        `)
        .eq('id', data.courtId)
        .single()

    if (courtError || !court) {
        console.error('[createReservation] ❌ Court not found:', courtError)
        return { success: false, error: 'Court not found.' }
    }

    // Calculate base price across ALL slots (assuming durationMs is same for all)
    const durationHours = durationMs / (1000 * 60 * 60)
    const basePricePerSlot = court.hourly_rate * durationHours
    const totalBasePrice = basePricePerSlot * targetSlots.length

    // Calculate actual discounts on the backend
    const discountResult = await calculateApplicableDiscounts({
        venueId: court.venue_id,
        courtId: data.courtId,
        startDate: targetSlots[0].start.toISOString(),
        endDate: targetSlots[targetSlots.length - 1].end.toISOString(),
        recurrenceWeeks: recurrenceWeeks,
        basePrice: totalBasePrice
    })

    const finalTotalAmount = discountResult.finalPrice
    const calculatedDiscountAmount = discountResult.totalDiscount

    // We only log the primary discount name if one exists (for legacy discountType field)
    let primaryDiscountName = ''
    if (discountResult.discounts.length > 0) {
        primaryDiscountName = discountResult.discounts[0].name
    }

    // 2.6 PLATFORM FEE CALCULATION (server-side to match what PayMongo charges)
    let platformFeePercentage = 5 // default
    let platformFeeEnabled = true
    try {
        const { data: feeSetting } = await adminDb
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'platform_fee')
            .single()
        if (feeSetting?.setting_value) {
            const feeConfig = feeSetting.setting_value as { percentage?: number; enabled?: boolean }
            platformFeePercentage = feeConfig.percentage ?? 5
            platformFeeEnabled = feeConfig.enabled ?? true
        }
    } catch (err) {
        console.warn('[createReservation] Failed to fetch platform fee, using default 5%', err)
    }

    // 3. CREATION PHASE
    let primaryReservationId = ''

    // Calculate price per slot securely from the backend result
    const courtAmountPerSlot = finalTotalAmount / targetSlots.length
    const perInstanceDiscount = calculatedDiscountAmount / targetSlots.length

    // Add platform fee to each slot's total
    const platformFeePerSlot = platformFeeEnabled
        ? calculatePlatformFeeAmount(courtAmountPerSlot, platformFeePercentage)
        : 0
    const perInstanceAmount = Math.round((courtAmountPerSlot + platformFeePerSlot) * 100) / 100

    console.log('[createReservation] 💰 Price breakdown per slot:', {
        courtAmount: courtAmountPerSlot,
        platformFee: platformFeePerSlot,
        platformFeePercentage,
        totalPerSlot: perInstanceAmount,
        slots: targetSlots.length
    })

    // Calculate down payment if applicable (based on total including platform fee)
    const venueData = court.venues as any;
    const venueMetadata = venueData ? (Array.isArray(venueData) ? venueData[0]?.metadata : venueData.metadata) : null;
    const downPaymentPercentage = parseFloat(venueMetadata?.down_payment_percentage || '20')
    const downPaymentAmount = data.paymentMethod === 'cash' ? Math.round((perInstanceAmount * downPaymentPercentage / 100) * 100) / 100 : undefined;

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
                discount_applied: perInstanceDiscount,
                discount_type: primaryDiscountName || null,
                discount_reason: discountResult.discounts.map(d => d.description).join(', ') || null,
                recurrence_group_id: recurrenceGroupId,
                metadata: {
                    booking_origin: 'web_checkout',
                    intended_payment_method: data.paymentMethod ?? null,
                    court_amount: courtAmountPerSlot,
                    platform_fee: platformFeePerSlot,
                    platform_fee_percentage: platformFeeEnabled ? platformFeePercentage : 0,
                    down_payment_percentage: data.paymentMethod === 'cash' ? downPaymentPercentage : undefined,
                    down_payment_amount: data.paymentMethod === 'cash' ? downPaymentAmount : undefined,
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

            // Rollback: cancel any previously created reservations in this batch
            if (createdReservationIds.length > 0) {
                console.log(`🔄 Rolling back ${createdReservationIds.length} previously created reservations...`)
                const { error: rollbackError } = await supabase
                    .from('reservations')
                    .update({
                        status: 'cancelled',
                        cancelled_at: new Date().toISOString(),
                        cancellation_reason: 'Rolled back due to failed slot creation in recurring booking'
                    })
                    .in('id', createdReservationIds)

                if (rollbackError) {
                    console.error('❌ Rollback failed:', rollbackError)
                } else {
                    console.log('✅ Rollback successful')
                }
            }

            return { success: false, error: `Failed to create slot ${i + 1}: ${error.message}` }
        }

        if (i === 0) primaryReservationId = newRes.id
        createdReservationIds.push(newRes.id)
    }

    return {
        success: true,
        reservationId: primaryReservationId,
        recurrenceGroupId: recurrenceGroupId || undefined,
        count: createdReservationIds.length,
        downPaymentRequired: downPaymentAmount !== undefined && downPaymentAmount > 0,
        downPaymentAmount: downPaymentAmount
    }
}
