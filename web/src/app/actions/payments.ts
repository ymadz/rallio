'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createGCashCheckout, createMayaCheckout, getSource, createPayment } from '@/lib/paymongo'
import { revalidatePath } from 'next/cache'
import { getServerNow } from '@/lib/time-server'

export type PaymentMethod = 'gcash' | 'paymaya' | 'cash'

// Type for reservation with nested relations from Supabase query
type ReservationWithRelations = {
  id: string
  user_id: string
  total_amount: number
  amount_paid: number
  status: string
  payment_type?: string
  num_players?: number
  recurrence_group_id?: string | null
  metadata?: Record<string, any> | null
  payment_method?: string
  courts: {
    name: string
    venues: {
      name: string
    }
  } | null
}

export interface InitiatePaymentResult {
  success: boolean
  checkoutUrl?: string
  paymentId?: string
  sourceId?: string
  error?: string
}

/**
 * Server Action: Initiate payment for a reservation
 * Creates a payment record and generates checkout URL
 */
export async function initiatePaymentAction(
  reservationId: string,
  paymentMethod: PaymentMethod
): Promise<InitiatePaymentResult> {
  console.log('[initiatePaymentAction] 🚀 Starting payment initiation')
  console.log('[initiatePaymentAction] Input:', {
    reservationId,
    paymentMethod
  })

  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log('[initiatePaymentAction] User auth:', {
      authenticated: !!user,
      userId: user?.id
    })

    if (!user) {
      console.error('[initiatePaymentAction] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Get reservation details with court and venue information
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(
        `
        *,
        courts (
          name,
          venues (
            name
          )
        )
      `
      )
      .eq('id', reservationId)
      .single<ReservationWithRelations>()

    if (reservationError || !reservation) {
      return { success: false, error: 'Reservation not found' }
    }

    // Verify user owns this reservation
    if (reservation.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if fully paid
    if (reservation.status === 'completed' || reservation.status === 'confirmed' || reservation.amount_paid >= reservation.total_amount) {
      // Allow partially_paid to be processed for the remaining balance
      if (reservation.status !== 'partially_paid') {
        return { success: false, error: 'Reservation already fully paid' }
      }
    }

    // Generate unique payment reference
    const paymentReference = `RES-${reservationId.slice(0, 8)}-${Date.now()}`

    // Get user profile for billing info
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', user.id)
      .single()

    // Build billing name with fallback to email
    const billingName = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user.email || 'Customer'
      : user.email || 'Customer'

    // Build description with optional chaining for safety
    const venueName = reservation.courts?.venues?.name ?? 'Court Reservation'
    const courtName = reservation.courts?.name ?? 'Court'
    let description = `${venueName} - ${courtName}`

    // Check for recurrence group to handle bulk payment
    let amountToCharge = reservation.total_amount
    let recurrenceGroupId = reservation.recurrence_group_id
    let isDownPayment = false

    // If reservation is already partially paid, we are charging the remaining balance
    if (reservation.status === 'partially_paid' && reservation.amount_paid > 0) {
      amountToCharge = reservation.total_amount - reservation.amount_paid
      description += ' (Remaining Balance)'
    } else {
      // Check intent: is this meant to be a cash booking (with a down payment)?
      const isIntendedCash = reservation.metadata?.intended_payment_method === 'cash' ||
        reservation.payment_type === 'cash' ||
        reservation.payment_method === 'cash' ||
        paymentMethod === 'cash'

      // If it's a cash booking but requires a down payment, charge the down payment amount online.
      if (isIntendedCash && reservation.metadata?.down_payment_amount && reservation.status === 'pending_payment') {
        amountToCharge = Number(reservation.metadata.down_payment_amount)
        isDownPayment = true
        description += ' (Down Payment)'
      }
    }

    if (recurrenceGroupId) {
      // Fetch all reservations in this group
      const { data: groupReservations } = await supabase
        .from('reservations')
        .select('total_amount, status, metadata')
        .eq('recurrence_group_id', recurrenceGroupId)
        .in('status', ['pending_payment'])

      if (groupReservations && groupReservations.length > 0) {
        if (isDownPayment) {
          // For down payments, sum the down_payment_amount from each reservation's metadata
          amountToCharge = groupReservations.reduce((sum, res) => {
            const meta = res.metadata as any
            return sum + (meta?.down_payment_amount || 0)
          }, 0)
          description += ` (Down Payment - ${groupReservations.length} sessions)`
        } else {
          // For full payments, sum up the total amount
          amountToCharge = groupReservations.reduce((sum, res) => sum + (res.total_amount || 0), 0)
          description += ` (Recurring: ${groupReservations.length} sessions)`
        }
        console.log('[initiatePaymentAction] 🔄 Detected recurring group:', {
          groupId: recurrenceGroupId,
          count: groupReservations.length,
          totalBulkAmount: amountToCharge,
          isDownPayment
        })
      }
    }

    console.log('[initiatePaymentAction] 💰 Payment calculation:', {
      paymentType: reservation.payment_type,
      singleAmount: reservation.total_amount,
      numPlayers: reservation.num_players,
      amountToCharge,
      isBulk: !!recurrenceGroupId
    })

    // Generate success/failed URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/checkout/success?reservation=${reservationId}`
    const failedUrl = `${baseUrl}/checkout/failed?reservation=${reservationId}`

    let checkoutUrl: string
    let sourceId: string

    // Create payment source based on method
    try {
      // Determine the actual method to use for PayMongo
      // If it's a cash booking requiring down payment, default to GCash for the online portion.
      const paymongoMethod = (paymentMethod === 'cash' && isDownPayment) ? 'gcash' : paymentMethod

      if (paymongoMethod === 'gcash') {
        const result = await createGCashCheckout({
          amount: amountToCharge,
          description,
          successUrl,
          failedUrl,
          billing: {
            name: billingName,
            email: user.email,
            phone: profile?.phone,
          },
          metadata: {
            reservation_id: reservationId,
            user_id: user.id,
            payment_reference: paymentReference,
            payment_type: reservation.payment_type || 'full',
            player_count: reservation.num_players?.toString() || '1',
            is_down_payment: isDownPayment ? 'true' : 'false'
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else if (paymongoMethod === 'paymaya') {
        const result = await createMayaCheckout({
          amount: amountToCharge,
          description,
          successUrl,
          failedUrl,
          billing: {
            name: billingName,
            email: user.email,
            phone: profile?.phone,
          },
          metadata: {
            reservation_id: reservationId,
            user_id: user.id,
            payment_reference: paymentReference,
            payment_type: reservation.payment_type || 'full',
            player_count: reservation.num_players?.toString() || '1',
            is_down_payment: isDownPayment ? 'true' : 'false'
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else {
        return { success: false, error: 'Cash payment without down payment not supported here' }
      }
    } catch (paymentError) {
      console.error('PayMongo API error:', paymentError)

      // Check if it's a PayMongo configuration error
      const errorMessage = paymentError instanceof Error ? paymentError.message : String(paymentError)

      if (errorMessage.includes('not allowed to process') || errorMessage.includes('gcash payments')) {
        return {
          success: false,
          error: 'GCash payments are currently unavailable. Please use the "Pay with Cash" option at the venue instead.',
        }
      }

      if (errorMessage.includes('paymaya') || errorMessage.includes('maya')) {
        return {
          success: false,
          error: 'Maya payments are currently unavailable. Please use the "Pay with Cash" option at the venue instead.',
        }
      }

      // Generic PayMongo error
      return {
        success: false,
        error: 'Payment provider is temporarily unavailable. Please try paying with cash at the venue.',
      }
    }

    // Create payment record in database with 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    console.log('[initiatePaymentAction] 💾 Creating payment record in database')
    const paymentData = {
      reference: paymentReference,
      user_id: user.id,
      reservation_id: reservationId,
      amount: amountToCharge, // Use the calculated per-player amount for split payments
      currency: 'PHP',
      payment_method: paymentMethod,
      payment_provider: 'paymongo',
      external_id: sourceId,
      status: 'pending' as const,
      expires_at: expiresAt.toISOString(),
      metadata: {
        description,
        checkout_url: checkoutUrl,
        source_id: sourceId,
        reservation_id: reservationId,
        payment_reference: paymentReference,
        payment_type: reservation.payment_type || 'full',
        player_count: reservation.num_players || 1,
        is_split_payment: reservation.payment_type === 'split',
        recurrence_group_id: recurrenceGroupId,
        is_down_payment: isDownPayment,
      },
    }
    console.log('[initiatePaymentAction] Payment data:', paymentData)

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select('id')
      .single()

    console.log('[initiatePaymentAction] Payment insert result:', {
      success: !!payment,
      paymentId: payment?.id,
      error: paymentError ? {
        message: paymentError.message,
        code: paymentError.code,
        details: paymentError.details
      } : null
    })

    if (paymentError) {
      console.error('[initiatePaymentAction] ❌ Error creating payment record:', paymentError)
      console.error('[initiatePaymentAction] Payment error details:', JSON.stringify(paymentError, null, 2))
      return {
        success: false,
        error: paymentError.message || paymentError.details || 'Failed to create payment record'
      }
    }

    // Update reservation to indicate payment initiated
    console.log('[initiatePaymentAction] 📝 Updating reservation status to pending_payment')
    const { error: reservationUpdateError } = await supabase
      .from('reservations')
      .update({
        status: 'pending_payment',
        payment_method: 'e-wallet',
        metadata: {
          ...(reservation.metadata || {}),
          payment_initiated_at: new Date().toISOString(),
          payment_method: paymentMethod,
          payment_reference: paymentReference,
        },
      })
      .eq('id', reservationId)

    if (reservationUpdateError) {
      console.error('[initiatePaymentAction] ⚠️ Failed to update reservation status:', {
        error: reservationUpdateError,
        code: reservationUpdateError.code
      })
      // Don't fail the payment creation if this fails
    } else {
      console.log('[initiatePaymentAction] ✅ Reservation status updated')
    }

    revalidatePath('/reservations')

    console.log('[initiatePaymentAction] ✅ Payment initiation complete:', {
      paymentId: payment.id,
      sourceId,
      checkoutUrl
    })

    return {
      success: true,
      checkoutUrl,
      paymentId: payment.id,
      sourceId,
    }
  } catch (error) {
    console.error('Payment initiation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment initiation failed',
    }
  }
}

/**
 * Server Action: Check payment status
 * Polls PayMongo to check if payment has been completed
 */
export async function checkPaymentStatusAction(sourceId: string): Promise<{
  success: boolean
  status?: 'pending' | 'chargeable' | 'cancelled' | 'expired' | 'paid'
  error?: string
}> {
  try {
    const source = await getSource(sourceId)

    return {
      success: true,
      status: source.attributes.status,
    }
  } catch (error) {
    console.error('Payment status check error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    }
  }
}

/**
 * Server Action: Process chargeable source
 * Called when source becomes chargeable (webhook or polling detected it)
 */
export async function processChargeableSourceAction(sourceId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Use service client to bypass RLS for payment fulfillment
    // This ensures status updates always succeed regardless of policies
    const supabase = createServiceClient()

    // Get the payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('external_id', sourceId)
      .single()

    if (paymentError || !payment) {
      return { success: false, error: 'Payment record not found' }
    }

    const isDownPayment = payment.metadata?.is_down_payment === true || payment.metadata?.is_down_payment === 'true'
    const newReservationStatus = isDownPayment ? 'partially_paid' : 'confirmed'

    // Idempotency check: If payment is already completed
    if (payment.status === 'completed') {
      console.log('Payment already completed, verifying reservation status:', sourceId)

      // CRITICAL FIX: Ensure reservation is confirmed even if payment was already processed
      // This handles race conditions where payment completes but reservation update fails
      const { data: reservation } = await supabase
        .from('reservations')
        .select('status, id, amount_paid')
        .eq('id', payment.reservation_id)
        .single()

      if (reservation?.status !== newReservationStatus && reservation?.status !== 'confirmed') {
        console.warn(`⚠️ Payment completed but reservation not ${newReservationStatus} - fixing now`)
        console.log('Reservation ID:', payment.reservation_id)
        console.log('Current status:', reservation?.status)

        // Update the reservation to the correct status
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            status: newReservationStatus,
            amount_paid: newReservationStatus === 'confirmed' && !isDownPayment
              ? (reservation?.amount_paid || 0) + payment.amount
              : payment.amount,
          })
          .eq('id', payment.reservation_id)

        if (updateError) {
          console.error('CRITICAL: Failed to confirm reservation:', updateError)
          console.error('Payment ID:', payment.id)
          console.error('Reservation ID:', payment.reservation_id)
          return {
            success: false,
            error: 'Payment completed but reservation confirmation failed. Please contact support with reference: ' + payment.reference
          }
        }

        console.log('✅ Reservation confirmed successfully:', payment.reservation_id)
        revalidatePath('/reservations')
        revalidatePath('/bookings')
      } else {
        console.log('✅ Reservation already confirmed, no action needed')
      }

      // Check if linked to Queue Session and update
      await updateQueueSessionStatus(payment.reservation_id, supabase)

      return { success: true }
    }

    // Check if currently being processed by webhook
    if (payment.metadata?.processing) {
      const processingStartedAt = payment.metadata?.processing_started_at
      const processingDuration = processingStartedAt
        ? Date.now() - new Date(processingStartedAt).getTime()
        : 0

      // If processing for less than 2 minutes, wait for it to complete
      if (processingDuration < 2 * 60 * 1000) {
        console.log('Payment is being processed by webhook, waiting...', sourceId)
        // Wait 3 seconds and check again
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Re-fetch payment status
        const { data: updatedPayment } = await supabase
          .from('payments')
          .select('status')
          .eq('external_id', sourceId)
          .single()

        if (updatedPayment?.status === 'completed') {
          console.log('Payment completed by webhook during wait')
          return { success: true }
        }
      }
    }

    // Mark as processing to prevent concurrent charging
    await supabase
      .from('payments')
      .update({
        metadata: {
          ...payment.metadata,
          processing: true,
          processing_started_at: new Date().toISOString(),
          processed_by: 'success_page'
        }
      })
      .eq('id', payment.id)

    // Create charge in PayMongo
    // IMPORTANT: source.type must always be 'source' (not payment method type)
    const paymentResult = await createPayment({
      amount: Math.round(payment.amount * 100), // Convert to centavos
      description: payment.metadata?.description || 'Court reservation',
      source: {
        id: sourceId,
        type: 'source', // Always 'source' per PayMongo API spec
      },
      metadata: {
        payment_id: payment.id,
        reservation_id: payment.reservation_id,
      },
    })

    // Update payment record
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        external_id: paymentResult.id, // Update with payment ID (not source ID)
        metadata: {
          ...payment.metadata,
          paymongo_payment: paymentResult,
        },
      })
      .eq('id', payment.id)

    if (paymentUpdateError) {
      console.error('Error updating payment record:', paymentUpdateError)
      // Continue anyway - payment was created in PayMongo
    }

    // Update reservation with comprehensive error handling
    console.log(`Updating reservation to ${newReservationStatus}:`, payment.reservation_id)
    // Fetch latest reservation first to get current amount_paid
    const { data: currentRes } = await supabase
      .from('reservations')
      .select('amount_paid')
      .eq('id', payment.reservation_id)
      .single()

    const newAmountPaid = newReservationStatus === 'confirmed' && !isDownPayment
      ? (currentRes?.amount_paid || 0) + payment.amount
      : payment.amount

    const { data: updatedReservation, error: reservationError } = await supabase
      .from('reservations')
      .update({
        status: newReservationStatus,
        amount_paid: newAmountPaid,
      })
      .eq('id', payment.reservation_id)
      .select('id, status')

    if (reservationError) {
      console.error('CRITICAL: Failed to confirm reservation:', reservationError)
      console.error('Payment ID:', payment.id)
      console.error('Reservation ID:', payment.reservation_id)
      console.error('Error details:', JSON.stringify(reservationError, null, 2))

      // Mark payment with error flag for manual review
      await supabase
        .from('payments')
        .update({
          metadata: {
            ...payment.metadata,
            paymongo_payment: paymentResult,
            reservation_update_failed: true,
            reservation_error: reservationError.message,
            error_timestamp: new Date().toISOString()
          }
        })
        .eq('id', payment.id)

      return {
        success: false,
        error: 'Payment completed but reservation confirmation failed. Please contact support with reference: ' + payment.reference
      }
    }

    // Verify update actually happened
    if (!updatedReservation || updatedReservation.length === 0) {
      console.error('WARNING: Reservation update returned no data - verifying...')

      // Double-check the reservation status
      const { data: verification } = await supabase
        .from('reservations')
        .select('status')
        .eq('id', payment.reservation_id)
        .single()

      if (verification?.status !== newReservationStatus && verification?.status !== 'confirmed') {
        console.error(`CRITICAL: Reservation not ${newReservationStatus} after update!`)
        console.error(`Expected: ${newReservationStatus}, Got:`, verification?.status)

        // Retry once
        console.log('Retrying reservation update...')
        await supabase
          .from('reservations')
          .update({ status: newReservationStatus, amount_paid: payment.amount })
          .eq('id', payment.reservation_id)
      }
    }

    // BULK/RECURRING PAYMENT HANDLING
    // Check if this is part of a recurrence group and confirm the rest
    const recurrenceGroupId = payment.metadata?.recurrence_group_id
    if (recurrenceGroupId) {
      console.log('🔄 Bulk Payment detected in processChargeableSourceAction:', recurrenceGroupId)

      // Fetch all other pending reservations in this group
      const { data: groupReservations, error: groupFetchError } = await supabase
        .from('reservations')
        .select('id, total_amount')
        .eq('recurrence_group_id', recurrenceGroupId)
        .neq('id', payment.reservation_id) // Exclude the one we just updated
        .in('status', ['pending_payment'])

      if (groupFetchError) {
        console.error('❌ Failed to fetch recurrence group for bulk update:', groupFetchError)
      } else if (groupReservations && groupReservations.length > 0) {
        console.log(`🔄 Confirming ${groupReservations.length} additional recurring reservations...`)

        for (const res of groupReservations) {
          // If original payment was a down payment, set each reservation to partially_paid
          // with amount_paid = each reservation's down_payment_amount.
          // Otherwise, mark as fully confirmed.
          let resStatus = 'confirmed'
          let resAmountPaid = res.total_amount

          if (isDownPayment) {
            const resMeta = (res as any).metadata as any
            resStatus = 'partially_paid'
            resAmountPaid = resMeta?.down_payment_amount || 0
          }

          const { error: bulkUpdateError } = await supabase
            .from('reservations')
            .update({
              status: resStatus,
              amount_paid: resAmountPaid,
            })
            .eq('id', res.id)

          if (bulkUpdateError) {
            console.error(`❌ Failed to confirm recurring reservation ${res.id}:`, bulkUpdateError)
          }
        }
        console.log('✅ Bulk confirmation complete')
      }
    }

    console.log('✅ Payment and reservation updated successfully')
    console.log('Payment ID:', payment.id)
    console.log('Reservation ID:', payment.reservation_id)
    console.log('Reservation status:', updatedReservation?.[0]?.status || 'unknown')

    revalidatePath('/reservations')
    revalidatePath('/bookings')

    // Check if linked to Queue Session and update
    await updateQueueSessionStatus(payment.reservation_id, supabase)

    return { success: true }
  } catch (error) {
    console.error('Charge processing error:', error)

    // Clear processing flag on error
    const supabase = createServiceClient()
    const { data: payment } = await supabase
      .from('payments')
      .select('metadata')
      .eq('external_id', sourceId)
      .single()

    if (payment) {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          metadata: {
            ...payment.metadata,
            processing: false,
            error: error instanceof Error ? error.message : 'Charge failed',
            failed_at: new Date().toISOString()
          }
        })
        .eq('external_id', sourceId)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Charge processing failed',
    }
  }
}

/**
 * Helper to update associated Queue Session if it exists
 */
async function updateQueueSessionStatus(reservationId: string, supabaseParam: any) {
  try {
    console.log('[updateQueueSessionStatus] 🔄 Checking for Queue Session linked to reservation:', reservationId)

    // Use service client for fulfillment to bypass RLS and ensure success
    const supabase = createServiceClient()

    // Check if this reservation is for a queue session
    // Using a more robust JSON search
    const { data: queueSession, error: fetchError } = await supabase
      .from('queue_sessions')
      .select('id, status, metadata, start_time, court_id')
      .filter('metadata->>reservation_id', 'eq', reservationId)
      .maybeSingle()

    if (fetchError) {
      console.error('[updateQueueSessionStatus] ❌ Error fetching queue session:', fetchError)
      return
    }

    if (queueSession) {
      console.log('[updateQueueSessionStatus] 🔄 Found linked Queue Session:', queueSession.id, 'Current status:', queueSession.status)

      // Activate and approve when payment is confirmed
      if (['pending_payment', 'pending_approval'].includes(queueSession.status)) {
        // Only set 'active' if the session has already started;
        // otherwise set 'open' (paid & ready, but scheduled for later)
        const now = await getServerNow()
        const startTime = new Date(queueSession.start_time)
        const newStatus = startTime <= now ? 'active' : 'open'

        console.log(`[updateQueueSessionStatus] 🕒 start_time=${startTime.toISOString()}, now=${now.toISOString()} → status='${newStatus}'`)

        const { error: updateError } = await supabase
          .from('queue_sessions')
          .update({
            status: newStatus,
            metadata: {
              ...queueSession.metadata,
              payment_status: 'paid',
              payment_confirmed_at: now.toISOString()
            }
          })
          .eq('id', queueSession.id)

        if (updateError) {
          console.error('[updateQueueSessionStatus] ❌ Failed to activate Queue Session:', updateError)
        } else {
          console.log(`[updateQueueSessionStatus] ✅ Queue Session set to '${newStatus}' successfully`)
          revalidatePath('/queue')
          revalidatePath('/bookings')
          revalidatePath(`/queue/${queueSession.court_id}`)
        }
      } else {
        console.log('[updateQueueSessionStatus] ℹ️ Queue Session status is not pending_payment, just updating payment flags')
        // Just update payment status if already active (or other status)
        const { error: updateError } = await supabase
          .from('queue_sessions')
          .update({
            metadata: {
              ...queueSession.metadata,
              payment_status: 'paid',
              payment_confirmed_at: new Date().toISOString()
            }
          })
          .eq('id', queueSession.id)

        if (!updateError) {
          console.log('[updateQueueSessionStatus] ✅ Queue Session payment status updated')
          revalidatePath('/bookings')
        } else {
          console.error('[updateQueueSessionStatus] ❌ Failed to update payment status:', updateError)
        }
      }
    } else {
      console.log('[updateQueueSessionStatus] ℹ️ No linked Queue Session found for reservation:', reservationId)
    }
  } catch (err) {
    console.error('[updateQueueSessionStatus] 🧨 Exception checking queue session:', err)
  }
}

/**
 * Server Action: Process payment by reservation ID
 * Fallback when PayMongo doesn't pass source_id in redirect URL
 * Looks up the payment record by reservation ID and processes it
 */
export async function processPaymentByReservationAction(reservationId: string): Promise<{
  success: boolean
  error?: string
  status?: string
}> {
  console.log('[processPaymentByReservationAction] Starting for reservation:', reservationId)

  try {
    // Use service client to bypass RLS for payment fulfillment
    const supabase = createServiceClient()

    // Get the most recent payment record for this reservation
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (paymentError || !payment) {
      console.log('[processPaymentByReservationAction] No payment found:', paymentError)
      return { success: false, error: 'No payment record found for this reservation' }
    }

    console.log('[processPaymentByReservationAction] Found payment:', {
      id: payment.id,
      status: payment.status,
      external_id: payment.external_id,
      payment_method: payment.payment_method
    })

    // If payment is already completed, check reservation status
    if (payment.status === 'completed') {
      console.log('[processPaymentByReservationAction] Payment already completed, checking reservation...')

      const { data: reservation } = await supabase
        .from('reservations')
        .select('status, id, amount_paid, recurrence_group_id, metadata')
        .eq('id', reservationId)
        .single()

      const isDownPaymentAction = payment.metadata?.is_down_payment === true || payment.metadata?.is_down_payment === 'true'
      const targetStatus = isDownPaymentAction ? 'partially_paid' : 'confirmed'

      if (reservation?.status === 'confirmed' || (reservation?.status === 'partially_paid' && targetStatus === 'partially_paid')) {
        console.log(`[processPaymentByReservationAction] Reservation already ${reservation.status}`)
        return { success: true, status: reservation.status }
      }

      // Payment completed but reservation not in target state - fix it
      console.warn(`[processPaymentByReservationAction] Payment completed but reservation not ${targetStatus} - fixing`)

      if (reservation?.recurrence_group_id) {
        console.log(`[processPaymentByReservationAction] Bulk Confirmation: Found recurrence group ${reservation.recurrence_group_id}`)

        const { data: groupReservations, error: groupFetchError } = await supabase
          .from('reservations')
          .select('id, status, metadata, amount_paid')
          .eq('recurrence_group_id', reservation.recurrence_group_id)
          .in('status', ['pending_payment', 'paid', 'partially_paid'])

        if (!groupFetchError && groupReservations && groupReservations.length > 0) {
          const updates = groupReservations.map(res => {
            const resMeta = (res.metadata || {}) as any
            let resAmountPaid: number;

            if (isDownPaymentAction) {
              resAmountPaid = resMeta?.down_payment_amount ? parseFloat(resMeta.down_payment_amount) : payment.amount / groupReservations.length
            } else {
              const newPaymentShare = payment.amount / groupReservations.length
              resAmountPaid = (res.amount_paid || 0) + newPaymentShare
            }

            return {
              id: res.id,
              status: targetStatus,
              amount_paid: resAmountPaid,
            }
          })

          for (const update of updates) {
            const { error: updateError } = await supabase
              .from('reservations')
              .update({
                status: update.status,
                amount_paid: update.amount_paid,
              })
              .eq('id', update.id)

            if (updateError) console.error(`Failed to update bulk instance ${update.id}:`, updateError)
          }
        }
      } else {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            status: targetStatus,
            amount_paid: targetStatus === 'confirmed' && !isDownPaymentAction
              ? (reservation?.amount_paid || 0) + payment.amount
              : payment.amount,
          })
          .eq('id', reservationId)

        if (updateError) {
          console.error('[processPaymentByReservationAction] Failed to confirm reservation:', updateError)
          return { success: false, error: 'Failed to confirm reservation' }
        }
      }

      revalidatePath('/reservations')
      revalidatePath('/bookings')

      // Check if linked to Queue Session and update
      await updateQueueSessionStatus(reservationId, supabase)

      return { success: true, status: targetStatus }
    }

    // For pure cash payments (no down payment), no processing needed
    const isDownPaymentAction = payment.metadata?.is_down_payment === true || payment.metadata?.is_down_payment === 'true'
    if (payment.payment_method === 'cash' && !isDownPaymentAction) {
      console.log('[processPaymentByReservationAction] Pure cash payment - no processing needed')
      return { success: true, status: 'pending' }
    }

    // For e-wallet payments, process the source
    const sourceId = payment.external_id
    if (!sourceId) {
      console.error('[processPaymentByReservationAction] No source ID found in payment record')
      return { success: false, error: 'Payment source not found' }
    }

    console.log('[processPaymentByReservationAction] Processing source:', sourceId)

    // Use the existing function to process the chargeable source
    const result = await processChargeableSourceAction(sourceId)

    if (result.success) {
      // Logic handled inside processChargeableSourceAction now
      return { success: true, status: 'confirmed' }
    } else {
      return { success: false, error: result.error, status: 'pending_payment' }
    }

  } catch (error) {
    console.error('[processPaymentByReservationAction] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed',
    }
  }
}

/**
 * Server Action: Initiate payment for queue session participation
 * Creates a payment record for games played in a queue
 */
export async function initiateQueuePaymentAction(
  sessionId: string,
  paymentMethod: PaymentMethod,
  userId?: string // Optional: for Queue Masters generating payment for others
): Promise<InitiatePaymentResult> {
  console.log('[initiateQueuePaymentAction] 🚀 Starting queue payment initiation')
  console.log('[initiateQueuePaymentAction] Input:', {
    sessionId,
    paymentMethod,
    userId,
  })

  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[initiateQueuePaymentAction] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Use provided userId if given (for Queue Masters), otherwise use authenticated user
    const targetUserId = userId || user.id

    console.log('[initiateQueuePaymentAction] 🔍 Looking for participant:', {
      sessionId,
      targetUserId,
      isQueueMaster: userId !== undefined,
    })

    // Get participant details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('queue_session_id', sessionId)
      .eq('user_id', targetUserId)
      .single()

    if (participantError || !participant) {
      console.error('[initiateQueuePaymentAction] ❌ Participant not found:', participantError)
      return { success: false, error: 'Participant not found in this session' }
    }

    // Get queue session details with court and venue info
    const { data: queueSession, error: sessionError } = await supabase
      .from('queue_sessions')
      .select(`
        cost_per_game,
        organizer_id,
        courts (
          name,
          venues (
            name
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !queueSession) {
      console.error('[initiateQueuePaymentAction] ❌ Queue session not found:', sessionError)
      return { success: false, error: 'Queue session not found' }
    }

    // If userId was provided, verify the requester is the queue organizer
    if (userId && queueSession.organizer_id !== user.id) {
      console.error('[initiateQueuePaymentAction] ❌ Unauthorized: Not the queue organizer')
      return { success: false, error: 'Only the queue organizer can generate payments for others' }
    }

    const costPerGame = parseFloat(queueSession.cost_per_game || '0')
    const gamesPlayed = participant.games_played || 0
    const totalAmount = costPerGame * gamesPlayed

    if (totalAmount <= 0) {
      return { success: false, error: 'No payment required' }
    }

    // Generate unique payment reference
    const paymentReference = `QUEUE-${sessionId.slice(0, 8)}-${Date.now()}`

    // Get user profile for billing info (for the participant, not the requester)
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, email')
      .eq('id', targetUserId)
      .single()

    const billingName = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email || 'Customer'
      : 'Customer'

    const venueName = (queueSession.courts as any)?.venues?.name ?? 'Queue Session'
    const courtName = (queueSession.courts as any)?.name ?? 'Court'
    const description = `${venueName} - ${courtName} (${gamesPlayed} games)`

    // Generate success/failed URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/queue/payment/success?session=${sessionId}`
    const failedUrl = `${baseUrl}/queue/payment/failed?session=${sessionId}`

    let checkoutUrl: string
    let sourceId: string

    // Create payment source based on method
    try {
      if (paymentMethod === 'gcash') {
        const result = await createGCashCheckout({
          amount: totalAmount,
          description,
          successUrl,
          failedUrl,
          billing: {
            name: billingName,
            email: user.email,
            phone: profile?.phone,
          },
          metadata: {
            queue_session_id: sessionId,
            participant_id: participant.id,
            user_id: user.id,
            games_played: gamesPlayed.toString(),
            payment_reference: paymentReference,
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else if (paymentMethod === 'paymaya') {
        const result = await createMayaCheckout({
          amount: totalAmount,
          description,
          successUrl,
          failedUrl,
          billing: {
            name: billingName,
            email: user.email,
            phone: profile?.phone,
          },
          metadata: {
            queue_session_id: sessionId,
            participant_id: participant.id,
            user_id: user.id,
            games_played: gamesPlayed.toString(),
            payment_reference: paymentReference,
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else {
        return { success: false, error: 'Cash payment not yet supported for queues' }
      }
    } catch (paymentError) {
      console.error('[initiateQueuePaymentAction] PayMongo API error:', paymentError)
      const errorMessage = paymentError instanceof Error ? paymentError.message : String(paymentError)

      if (errorMessage.includes('not allowed to process') || errorMessage.includes('gcash payments')) {
        return {
          success: false,
          error: 'GCash payments are currently unavailable. Please pay with cash.',
        }
      }

      return {
        success: false,
        error: 'Payment provider is temporarily unavailable. Please try again later.',
      }
    }

    // Create payment record in database
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    const paymentData = {
      reference: paymentReference,
      user_id: user.id,
      amount: totalAmount,
      currency: 'PHP',
      payment_method: paymentMethod,
      payment_provider: 'paymongo',
      external_id: sourceId,
      status: 'pending' as const,
      expires_at: expiresAt.toISOString(),
      metadata: {
        description,
        checkout_url: checkoutUrl,
        source_id: sourceId,
        queue_session_id: sessionId,
        participant_id: participant.id,
        games_played: gamesPlayed,
        payment_reference: paymentReference,
        payment_type: 'queue_session',
      },
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select('id')
      .single()

    if (paymentError) {
      console.error('[initiateQueuePaymentAction] ❌ Error creating payment record:', paymentError)
      return {
        success: false,
        error: 'Failed to create payment record',
      }
    }

    console.log('[initiateQueuePaymentAction] ✅ Payment initiated successfully:', {
      paymentId: payment.id,
      sourceId,
      amount: totalAmount,
    })

    revalidatePath(`/queue/${participant.queue_sessions.courts?.id}`)
    revalidatePath('/queue')

    return {
      success: true,
      checkoutUrl,
      paymentId: payment.id,
      sourceId,
    }
  } catch (error: any) {
    console.error('[initiateQueuePaymentAction] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to initiate payment' }
  }
}
