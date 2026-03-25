
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
        cashPaymentOption?: 'downpayment' | 'full_cash'
        notes?: string
        discountApplied?: number
        discountType?: string
        discountReason?: string
        recurrenceWeeks?: number
        selectedDays?: number[] // Array of day indices (0-6)
        customDownPaymentAmount?: number
        promoCode?: string
        bookingId?: string // Optional existing booking ID
        targetDateCount?: number
    }
): Promise<{ 
    success: boolean; 
    bookingId?: string;
    reservationId?: string; 
    recurrenceGroupId?: string; 
    error?: string; 
    count?: number; 
    downPaymentRequired?: boolean; 
    downPaymentAmount?: number 
}> {
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
    const toBook: { start: Date; end: Date; weekIndex: number }[] = []
    const skipped: { date: string; reason: string }[] = []

    for (const slot of targetSlots) {
        const currentStartTimeISO = slot.start.toISOString()
        const currentEndTimeISO = slot.end.toISOString()

        const conflictStatuses = ['pending_payment', 'confirmed', 'ongoing', 'pending_refund', 'completed', 'no_show']

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

        const dateStr = slot.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        // Check for queue conflicts
        if (queueConflicts.data && queueConflicts.data.length > 0) {
            console.log(`[createReservation] ⚠️ Queue conflict on ${dateStr}, skipping slot.`)
            skipped.push({ date: dateStr, reason: 'Slot matches a Queue Session' })
            continue
        }

        // Check for reservation conflicts
        const realConflicts = reservationConflicts.data?.filter(conflict => {
            return ['pending_payment', 'partially_paid', 'confirmed', 'ongoing'].includes(conflict.status)
        }) || []

        if (realConflicts.length > 0) {
            console.log(`[createReservation] ⚠️ Reservation conflict on ${dateStr}, skipping slot.`)
            skipped.push({ date: dateStr, reason: 'Slot is already reserved' })
            continue
        }

        toBook.push(slot)
    }

    if (toBook.length === 0) {
        return { 
            success: false, 
            error: skipped.length > 0 
                ? `All selected slots are unavailable: ${skipped.map(s => s.date).join(', ')}`
                : 'No valid future slots available to book.' 
        }
    }

    // Replace targetSlots with only available ones
    const finalSlots = toBook

    // 2.5 PRICE CALCULATION AND DISCOUNT VALIDATION PHASE
    // Fetch Court to get hourly rate and venue details
    const { data: court, error: courtError } = await adminDb
        .from('courts')
        .select(`
            hourly_rate, 
            metadata,
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
    const totalBasePrice = basePricePerSlot * finalSlots.length

    const discountResult = await calculateApplicableDiscounts({
        venueId: court.venue_id,
        courtId: data.courtId,
        startDate: finalSlots[0].start.toISOString(),
        endDate: finalSlots[finalSlots.length - 1].end.toISOString(),
        recurrenceWeeks: recurrenceWeeks,
        targetDateCount: data.targetDateCount ?? finalSlots.length,
        basePrice: totalBasePrice,
        promoCode: data.promoCode,
    })

    const finalTotalAmount = discountResult.finalPrice
    const calculatedDiscountAmount = discountResult.totalDiscount

    // Store the primary discount name for the legacy discountType field
    // and build a full list for metadata
    let primaryDiscountName = ''
    if (discountResult.discounts.length > 0) {
        primaryDiscountName = discountResult.discounts.map(d => d.name).join(', ')
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
    const courtAmountPerSlot = finalTotalAmount / finalSlots.length
    const perInstanceDiscount = calculatedDiscountAmount / finalSlots.length

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
        slots: finalSlots.length
    })

    // Calculate total booking amount
    const bookingTotalAmount = Math.round((perInstanceAmount * finalSlots.length) * 100) / 100

    let bookingId = data.bookingId

    if (!bookingId) {
        // Create the parent Booking record first
        const { data: newBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                user_id: data.userId,
                total_amount: bookingTotalAmount,
                amount_paid: 0,
                remaining_balance: bookingTotalAmount,
                payment_status: 'unpaid',
                status: 'pending',
                metadata: {
                    booking_origin: 'web_checkout',
                    is_recurring: isRecurring,
                    recurrence_weeks: recurrenceWeeks,
                    days_per_week: uniqueSelectedDays.length,
                    promo_code: data.promoCode || undefined,
                    recurrence_group_id: recurrenceGroupId || undefined
                }
            })
            .select('id')
            .single()

        if (bookingError || !newBooking) {
            console.error('[createReservation] ❌ Failed to create parent booking:', bookingError)
            return { success: false, error: `Failed to initialize booking: ${bookingError?.message || 'Unknown error'}` }
        }

        bookingId = newBooking.id
    } else {
        // Update existing booking to add new items total
        const { data: existingBooking } = await supabase
            .from('bookings')
            .select('total_amount, remaining_balance')
            .eq('id', bookingId)
            .single()
        
        if (existingBooking) {
            const newTotal = Number(existingBooking.total_amount) + bookingTotalAmount
            const newRemaining = Number(existingBooking.remaining_balance) + bookingTotalAmount
            
            await supabase
                .from('bookings')
                .update({
                    total_amount: newTotal,
                    remaining_balance: newRemaining
                })
                .eq('id', bookingId)
        }
    }

    // Calculate down payment if applicable (based on total including platform fee)
    const venueData = court.venues as any
    const venueMetadata = venueData ? (Array.isArray(venueData) ? venueData[0]?.metadata : venueData.metadata) : null
    const courtMetadata = (court as any).metadata
    const rawDownPaymentPercentage = courtMetadata?.down_payment_percentage ?? venueMetadata?.down_payment_percentage ?? 20
    const parsedDownPaymentPercentage = Number(rawDownPaymentPercentage)
    const downPaymentPercentage = Number.isFinite(parsedDownPaymentPercentage)
        ? Math.min(Math.max(parsedDownPaymentPercentage, 0), 100)
        : 20
    const minimumDownPaymentPerSlot = Math.round((perInstanceAmount * downPaymentPercentage / 100) * 100) / 100
    const hasCustomDownPayment = data.customDownPaymentAmount !== undefined && data.customDownPaymentAmount > 0
    const customDownPaymentPerSlot = hasCustomDownPayment
        ? data.customDownPaymentAmount! / finalSlots.length
        : undefined

    const shouldRequireDownPayment =
        data.paymentMethod === 'cash' &&
        data.cashPaymentOption !== 'full_cash' &&
        downPaymentPercentage > 0

    const downPaymentAmount = shouldRequireDownPayment
        ? Math.round((hasCustomDownPayment
            ? Math.min(Math.max(customDownPaymentPerSlot!, minimumDownPaymentPerSlot), perInstanceAmount)
            : minimumDownPaymentPerSlot) * 100) / 100
        : undefined

    const isCustomDownPayment = shouldRequireDownPayment && hasCustomDownPayment && downPaymentAmount !== minimumDownPaymentPerSlot

    for (let i = 0; i < finalSlots.length; i++) {
        const slot = finalSlots[i]

        // Determine status
        // All reservations start as pending_payment regardless of payment method.
        // Cash bookings require court admin to mark as paid before they become confirmed.
        // E-wallet bookings get confirmed automatically via PayMongo webhook.
        const status = 'pending_payment'

        // Full-cash bookings get a strict 24-hour payment window from booking creation.
        // If unpaid after the deadline, background jobs cancel the reservation.
        let cashPaymentDeadline: string | null = null
        if (data.paymentMethod === 'cash') {
            if (data.cashPaymentOption === 'full_cash' || !shouldRequireDownPayment) {
                // For same-day / within-24h bookings, do not enforce the 24-hour cash deadline.
                // These stay as pay-at-venue with no auto-cancel deadline timer.
                const isWithin24Hours = (slot.start.getTime() - Date.now()) <= (24 * 60 * 60 * 1000)
                if (!isWithin24Hours) {
                    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000)
                    cashPaymentDeadline = deadline.toISOString()
                }
            } else {
                const twoHoursBefore = new Date(slot.start.getTime() - 2 * 60 * 60 * 1000)
                const minimumDeadline = new Date(Date.now() + 30 * 60 * 1000)
                const deadline = twoHoursBefore > minimumDeadline ? twoHoursBefore : minimumDeadline
                cashPaymentDeadline = deadline.toISOString()
            }
        }

        // Use USER SCOPED Client for INSERT to respect RLS
        // (Ensure the passed client has an authenticated user)
        const { data: newRes, error } = await supabase
            .from('reservations')
            .insert({
                booking_id: bookingId,
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
                    cash_payment_option: data.paymentMethod === 'cash' ? (data.cashPaymentOption ?? 'downpayment') : undefined,
                    court_amount: courtAmountPerSlot,
                    platform_fee: platformFeePerSlot,
                    platform_fee_percentage: platformFeeEnabled ? platformFeePercentage : 0,
                    down_payment_percentage: shouldRequireDownPayment ? downPaymentPercentage : undefined,
                    down_payment_amount: shouldRequireDownPayment ? downPaymentAmount : undefined,
                    is_custom_down_payment: isCustomDownPayment,
                    promo_code: data.promoCode || undefined,
                    applied_discounts: discountResult.discounts.map(d => ({
                        name: d.name,
                        type: d.type,
                        amount: d.amount / finalSlots.length,
                        isIncrease: d.isIncrease
                    })),
                    recurrence_index: i,
                    recurrence_total: finalSlots.length,
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

            // Also cancel the booking record
            await supabase
                .from('bookings')
                .update({ status: 'cancelled', metadata: { cancellation_reason: 'Failed to create all reservation slots' } })
                .eq('id', bookingId)

            return { success: false, error: `Failed to create slot ${i + 1}: ${error.message}` }
        }

        if (i === 0) primaryReservationId = newRes.id
        createdReservationIds.push(newRes.id)
    }

    return {
        success: true,
        bookingId: bookingId,
        reservationId: primaryReservationId,
        recurrenceGroupId: recurrenceGroupId || undefined,
        count: createdReservationIds.length,
        downPaymentRequired: shouldRequireDownPayment && downPaymentAmount !== undefined && downPaymentAmount > 0,
        downPaymentAmount: downPaymentAmount
    }
}
