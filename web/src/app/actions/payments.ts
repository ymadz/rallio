'use server'

import { createClient } from '@/lib/supabase/server'
import { createGCashCheckout, createMayaCheckout, getSource, createPayment } from '@/lib/paymongo'
import { revalidatePath } from 'next/cache'

export type PaymentMethod = 'gcash' | 'paymaya' | 'cash'

// Type for reservation with nested relations from Supabase query
type ReservationWithRelations = {
  id: string
  user_id: string
  total_amount: number
  amount_paid: number
  status: string
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

    // Check if already paid
    if (['paid', 'confirmed'].includes(reservation.status) || reservation.amount_paid >= reservation.total_amount) {
      return { success: false, error: 'Reservation already paid' }
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
    const description = `${venueName} - ${courtName}`

    // Generate success/failed URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/checkout/success?reservation=${reservationId}`
    const failedUrl = `${baseUrl}/checkout/failed?reservation=${reservationId}`

    // NOTE: Split payment feature disabled - always charge full amount
    // TODO: Implement proper multi-player payment flow with unique payment links
    const amountToCharge = reservation.total_amount

    console.log('[initiatePaymentAction] 💰 Payment calculation:', {
      paymentType: reservation.payment_type,
      totalAmount: reservation.total_amount,
      numPlayers: reservation.num_players,
      amountToCharge,
    })

    let checkoutUrl: string
    let sourceId: string

    // Create payment source based on method
    try {
      if (paymentMethod === 'gcash') {
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
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else if (paymentMethod === 'paymaya') {
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
          },
        })
        checkoutUrl = result.checkoutUrl
        sourceId = result.sourceId
      } else {
        return { success: false, error: 'Cash payment not yet supported' }
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
    // Status: 'pending_payment' (requires migration 006) or 'pending' (fallback)
    console.log('[initiatePaymentAction] 📝 Updating reservation status to pending_payment')
    const { error: reservationUpdateError } = await supabase
      .from('reservations')
      .update({
        status: 'pending_payment',
        metadata: {
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
    const supabase = await createClient()

    // Get the payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('external_id', sourceId)
      .single()

    if (paymentError || !payment) {
      return { success: false, error: 'Payment record not found' }
    }

    // Idempotency check: If payment is already completed
    if (payment.status === 'completed') {
      console.log('Payment already completed, verifying reservation status:', sourceId)

      // CRITICAL FIX: Ensure reservation is confirmed even if payment was already processed
      // This handles race conditions where payment completes but reservation update fails
      const { data: reservation } = await supabase
        .from('reservations')
        .select('status, id')
        .eq('id', payment.reservation_id)
        .single()

      if (reservation?.status !== 'confirmed') {
        console.warn('⚠️ Payment completed but reservation not confirmed - fixing now')
        console.log('Reservation ID:', payment.reservation_id)
        console.log('Current status:', reservation?.status)

        // Update the reservation to confirmed
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            status: 'confirmed',
            amount_paid: payment.amount,
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
    console.log('Updating reservation to confirmed:', payment.reservation_id)
    const { data: updatedReservation, error: reservationError } = await supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        amount_paid: payment.amount,
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

      if (verification?.status !== 'confirmed') {
        console.error('CRITICAL: Reservation not confirmed after update!')
        console.error('Expected: confirmed, Got:', verification?.status)

        // Retry once
        console.log('Retrying reservation update...')
        await supabase
          .from('reservations')
          .update({ status: 'confirmed', amount_paid: payment.amount })
          .eq('id', payment.reservation_id)
      }
    }

    console.log('✅ Payment and reservation updated successfully')
    console.log('Payment ID:', payment.id)
    console.log('Reservation ID:', payment.reservation_id)
    console.log('Reservation status:', updatedReservation?.[0]?.status || 'unknown')

    revalidatePath('/reservations')
    revalidatePath('/bookings')

    return { success: true }
  } catch (error) {
    console.error('Charge processing error:', error)

    // Clear processing flag on error
    const supabase = await createClient()
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
    const supabase = await createClient()

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
        .select('status')
        .eq('id', reservationId)
        .single()

      if (reservation?.status === 'confirmed') {
        console.log('[processPaymentByReservationAction] Reservation already confirmed')
        return { success: true, status: 'confirmed' }
      }

      // Payment completed but reservation not confirmed - fix it
      console.warn('[processPaymentByReservationAction] Payment completed but reservation not confirmed - fixing')
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          amount_paid: payment.amount,
        })
        .eq('id', reservationId)

      if (updateError) {
        console.error('[processPaymentByReservationAction] Failed to confirm reservation:', updateError)
        return { success: false, error: 'Failed to confirm reservation' }
      }

      revalidatePath('/reservations')
      revalidatePath('/bookings')
      return { success: true, status: 'confirmed' }
    }

    // For cash payments, no processing needed - just return pending status
    if (payment.payment_method === 'cash') {
      console.log('[processPaymentByReservationAction] Cash payment - no processing needed')
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
