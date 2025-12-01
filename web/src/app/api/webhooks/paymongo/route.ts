import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { createNotification, NotificationTemplates } from '@/lib/notifications'

/**
 * CORS headers for webhook endpoint
 * PayMongo may send preflight requests
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, paymongo-signature',
}

/**
 * Health check endpoint to verify webhook route is accessible
 * Usage: GET https://your-domain.com/api/webhooks/paymongo
 */
export async function GET(request: NextRequest) {
  console.log('🏥 [Webhook Health Check] GET request received')
  console.log('🏥 [Webhook Health Check] Request URL:', request.url)
  console.log('🏥 [Webhook Health Check] Request headers:', Object.fromEntries(request.headers))

  return NextResponse.json({
    status: 'ok',
    message: 'PayMongo webhook endpoint is reachable',
    timestamp: new Date().toISOString(),
    endpoint: '/api/webhooks/paymongo',
    methods: ['GET', 'POST', 'OPTIONS'],
    environment: process.env.NODE_ENV || 'unknown',
  }, {
    status: 200,
    headers: corsHeaders
  })
}

/**
 * Handle preflight OPTIONS requests
 * Required for CORS compliance
 */
export async function OPTIONS(request: NextRequest) {
  console.log('🔧 [PayMongo Webhook] OPTIONS preflight request received')
  console.log('🔧 [PayMongo Webhook] Origin:', request.headers.get('origin'))

  return new Response(null, {
    status: 204,
    headers: corsHeaders
  })
}

/**
 * PayMongo Webhook Handler
 * Handles payment status updates from PayMongo
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  // 🚨 CRITICAL: First log to confirm webhook is reaching server
  console.log('\n🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨')
  console.log('🚨 [PayMongo Webhook] Timestamp:', timestamp)
  console.log('🚨 [PayMongo Webhook] Request URL:', request.url)
  console.log('🚨 [PayMongo Webhook] Request method:', request.method)

  console.log(`\n${'='.repeat(80)}`)
  console.log(`[PayMongo Webhook] ${timestamp} - Processing webhook`)
  console.log(`${'='.repeat(80)}`)

  // 🔍 Debug checklist
  console.log('🔍 [Webhook Debug Checklist]')
  console.log('  ✓ Endpoint reachable?', 'YES - this log confirms it')
  console.log('  ✓ POST method?', request.method)
  console.log('  ✓ Content-Type:', request.headers.get('content-type'))
  console.log('  ✓ Has paymongo-signature?', request.headers.has('paymongo-signature'))
  console.log('  ✓ Content-Length:', request.headers.get('content-length'))
  console.log('  ✓ User-Agent:', request.headers.get('user-agent'))
  console.log('  ✓ Origin:', request.headers.get('origin'))
  console.log('  ✓ All headers:', Object.fromEntries(request.headers))

  try {
    const body = await request.text()
    const signature = request.headers.get('paymongo-signature')

    console.log('[PayMongo Webhook] Request body received:', {
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
      hasSignature: !!signature,
    })

    // Verify webhook signature (with development bypass)
    const isDevelopment = process.env.NODE_ENV === 'development'
    const signatureValid = verifyWebhookSignature(body, signature, isDevelopment)

    console.log('[PayMongo Webhook] Signature verification:', {
      valid: signatureValid,
      hasWebhookSecret: !!process.env.PAYMONGO_WEBHOOK_SECRET,
      isDevelopment,
      bypassedInDev: isDevelopment && !process.env.PAYMONGO_WEBHOOK_SECRET
    })

    if (!signatureValid) {
      console.error('[PayMongo Webhook] ❌ Invalid webhook signature - rejecting request')
      return NextResponse.json({ error: 'Invalid signature' }, {
        status: 401,
        headers: corsHeaders
      })
    }

    const event = JSON.parse(body)
    const eventType = event.data?.attributes?.type
    const eventId = event.data?.id || event.id
    const eventData = event.data?.attributes?.data

    console.log('[PayMongo Webhook] 📦 Event parsed:', {
      eventType,
      eventId,
      eventDataId: eventData?.id,
      eventDataType: eventData?.type,
      hasEventData: !!eventData,
      rawEventKeys: Object.keys(event.data || {}),
      rawEventAttributeKeys: Object.keys(event.data?.attributes || {})
    })

    // Handle different event types
    switch (eventType) {
      case 'source.chargeable':
        console.log('[PayMongo Webhook] 🔄 Handling source.chargeable event')
        await handleSourceChargeable(eventData, eventId)
        break

      case 'payment.paid':
        console.log('[PayMongo Webhook] 💰 Handling payment.paid event')
        await handlePaymentPaid(eventData, eventId)
        break

      case 'payment.failed':
        console.log('[PayMongo Webhook] ❌ Handling payment.failed event')
        await handlePaymentFailed(eventData, eventId)
        break

      default:
        console.log('[PayMongo Webhook] ⚠️ Unhandled webhook event type:', eventType)
    }

    console.log('[PayMongo Webhook] ✅ Webhook processed successfully')
    console.log(`${'='.repeat(80)}\n`)
    return NextResponse.json({ received: true }, {
      status: 200,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('[PayMongo Webhook] ❌ CRITICAL ERROR during webhook processing')
    console.error('[PayMongo Webhook] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name
    })
    console.log(`${'='.repeat(80)}\n`)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Verify PayMongo webhook signature
 * In development mode with no webhook secret, bypass verification
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  isDevelopment: boolean = false
): boolean {
  console.log('🔐 [verifyWebhookSignature] Starting signature verification')
  console.log('🔐 [verifyWebhookSignature] Has signature header?', !!signature)
  console.log('🔐 [verifyWebhookSignature] Is development mode?', isDevelopment)

  if (!signature) {
    console.warn('⚠️ [verifyWebhookSignature] No signature header present')
    if (isDevelopment) {
      console.warn('⚠️ [verifyWebhookSignature] DEVELOPMENT MODE: Bypassing signature check')
      return true
    }
    return false
  }

  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
  console.log('🔐 [verifyWebhookSignature] Has webhook secret?', !!webhookSecret)

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ [verifyWebhookSignature] PAYMONGO_WEBHOOK_SECRET required in production')
      throw new Error('PAYMONGO_WEBHOOK_SECRET is required in production environment')
    }
    console.warn('⚠️ [verifyWebhookSignature] DEVELOPMENT MODE: No webhook secret configured')
    console.warn('⚠️ [verifyWebhookSignature] Bypassing signature verification (UNSAFE for production)')
    return true
  }

  // Extract timestamp and signature from header
  // PayMongo format: t=timestamp,te=test_sig,li=live_sig
  console.log('🔐 [verifyWebhookSignature] Signature header format:', signature.substring(0, 50) + '...')
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const te = parts.find(p => p.startsWith('te='))?.split('=')[1] || ''
  const li = parts.find(p => p.startsWith('li='))?.split('=')[1] || ''

  // Use li (live) if available and non-empty, otherwise use te (test)
  const sig = (li && li.trim().length > 0) ? li : te

  console.log('🔐 [verifyWebhookSignature] PayMongo signature fields:', {
    hasTimestamp: !!timestamp,
    hasTestSig: !!te && te.length > 0,
    hasLiveSig: !!li && li.length > 0,
    selectedSig: sig ? sig.substring(0, 16) + '...' : 'none',
    mode: (li && li.trim().length > 0) ? 'LIVE' : 'TEST'
  })

  console.log('🔐 [verifyWebhookSignature] Parsed components:', {
    hasTimestamp: !!timestamp,
    hasSignature: !!sig,
    timestampLength: timestamp?.length || 0,
    signatureLength: sig?.length || 0
  })

  if (!timestamp || !sig) {
    console.error('❌ [verifyWebhookSignature] Invalid signature format - missing timestamp or signature')
    return false
  }

  // Construct signed payload
  const signedPayload = `${timestamp}.${payload}`
  console.log('🔐 [verifyWebhookSignature] Signed payload length:', signedPayload.length)

  // Generate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex')

  console.log('🔐 [verifyWebhookSignature] Signature comparison:', {
    receivedLength: sig.length,
    expectedLength: expectedSignature.length,
    receivedPreview: sig.substring(0, 16) + '...',
    expectedPreview: expectedSignature.substring(0, 16) + '...',
    match: sig === expectedSignature
  })

  // Compare signatures (timing-safe)
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    )
    console.log('✅ [verifyWebhookSignature] Signature validation result:', isValid)
    return isValid
  } catch (error) {
    console.error('❌ [verifyWebhookSignature] Signature comparison failed:', error)
    return false
  }
}

function normalizeReservation(relationship: any) {
  if (!relationship) return null
  if (Array.isArray(relationship)) {
    return relationship[0] || null
  }
  return relationship
}

function buildStatusHistory(metadata: any, nextStatus: string) {
  const existing = Array.isArray(metadata?.payment_status_history)
    ? metadata.payment_status_history.filter((entry: unknown) => typeof entry === 'string')
    : []

  if (existing.includes(nextStatus)) {
    return existing
  }

  return [...existing, nextStatus]
}

async function markReservationPaidAndConfirmed({
  supabase,
  payment,
  eventId,
  eventType,
}: {
  supabase: ReturnType<typeof createServiceClient>
  payment: any
  eventId?: string | null
  eventType: string
}) {
  console.log('[markReservationPaidAndConfirmed] 🎯 Starting reservation confirmation')
  console.log('[markReservationPaidAndConfirmed] Input:', {
    paymentId: payment?.id,
    reservationId: payment?.reservation_id,
    eventId,
    eventType,
    paymentAmount: payment?.amount
  })

  if (!payment?.reservation_id) {
    console.warn('[markReservationPaidAndConfirmed] ⚠️ Payment missing reservation_id, skipping reservation update', payment?.id)
    return
  }

  const reservationId = payment.reservation_id
  const nowISO = new Date().toISOString()
  console.log('[markReservationPaidAndConfirmed] Timestamp:', nowISO)

  // Fetch current reservation state
  let reservationRecord = normalizeReservation(payment.reservations)
  console.log('[markReservationPaidAndConfirmed] Initial reservation record from payment:', {
    hasRecord: !!reservationRecord,
    status: reservationRecord?.status,
    amountPaid: reservationRecord?.amount_paid
  })

  if (!reservationRecord) {
    console.log('[markReservationPaidAndConfirmed] 🔍 Fetching reservation from database')
    const { data, error } = await supabase
      .from('reservations')
      .select('id, status, amount_paid, metadata')
      .eq('id', reservationId)
      .single()

    console.log('[markReservationPaidAndConfirmed] Reservation fetch result:', {
      found: !!data,
      status: data?.status,
      amountPaid: data?.amount_paid,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details
      } : null
    })

    if (error || !data) {
      console.error('[markReservationPaidAndConfirmed] ❌ Failed to fetch reservation', {
        reservationId,
        error,
      })
      throw error || new Error('Reservation not found for payment completion')
    }

    reservationRecord = data
  }

  // PAYMENT CONFIRMATION FLOW (requires migration 006 applied):
  // pending_payment → paid → confirmed
  // If migration 006 NOT applied: pending → confirmed directly

  // Check if already in final state
  console.log('[markReservationPaidAndConfirmed] 🔍 Checking current reservation status')
  if (reservationRecord.status === 'confirmed') {
    console.log('[markReservationPaidAndConfirmed] ℹ️ Reservation already confirmed')
    // Already confirmed - just ensure amount_paid is synced
    if ((reservationRecord.amount_paid ?? 0) < payment.amount) {
      console.log('[markReservationPaidAndConfirmed] 💰 Syncing amount_paid:', {
        current: reservationRecord.amount_paid,
        new: payment.amount
      })
      const { error: amountError } = await supabase
        .from('reservations')
        .update({
          amount_paid: payment.amount,
          updated_at: nowISO,
        })
        .eq('id', reservationId)

      if (amountError) {
        console.error('[markReservationPaidAndConfirmed] ❌ Failed to sync amount_paid', {
          reservationId,
          error: amountError,
        })
      } else {
        console.log('[markReservationPaidAndConfirmed] ✅ Amount synced successfully')
      }
    }
    console.log('[markReservationPaidAndConfirmed] ✅ Reservation already confirmed:', reservationId)
    return
  }

  // First, mark as 'paid' to indicate payment successful
  console.log('[markReservationPaidAndConfirmed] 📝 Step 1: Marking reservation as PAID')
  if (reservationRecord.status !== 'paid') {
    const paidMetadata = {
      ...(reservationRecord.metadata || {}),
      payment_paid_event: {
        eventId,
        eventType,
        paidAt: nowISO,
        payment_id: payment.id,
      },
      payment_status_history: buildStatusHistory(reservationRecord.metadata, 'paid'),
    }

    console.log('[markReservationPaidAndConfirmed] Attempting to update status to "paid":', {
      reservationId,
      currentStatus: reservationRecord.status,
      targetStatus: 'paid',
      amount: payment.amount,
    })

    const { data: paidReservation, error: paidError } = await supabase
      .from('reservations')
      .update({
        status: 'paid',
        amount_paid: payment.amount,
        updated_at: nowISO,
        metadata: paidMetadata,
      })
      .eq('id', reservationId)
      .select('id, status, amount_paid, metadata')
      .single()

    if (paidError) {
      console.error('[markReservationPaidAndConfirmed] ❌ Failed to mark reservation as paid:', {
        reservationId,
        error: {
          message: paidError.message,
          code: paidError.code,
          details: paidError.details,
          hint: paidError.hint
        },
        errorCode: paidError.code,
        errorDetails: JSON.stringify(paidError, null, 2),
      })

      // If 'paid' status is not valid (migration 006 not applied), go directly to 'confirmed'
      if (paidError.code === '23514') { // CHECK constraint violation
        console.warn('[markReservationPaidAndConfirmed] ⚠️ Migration 006 NOT applied - "paid" status not in CHECK constraint')
        console.warn('[markReservationPaidAndConfirmed] ⚠️ Will skip to "confirmed" status instead')
        // Fall through to confirm step below
      } else {
        console.error('[markReservationPaidAndConfirmed] ❌ CRITICAL: Non-constraint error, aborting')
        throw paidError
      }
    } else {
      console.log('[markReservationPaidAndConfirmed] ✅ Reservation marked as PAID:', {
        id: paidReservation.id,
        status: paidReservation.status,
        amountPaid: paidReservation.amount_paid
      })
      reservationRecord = paidReservation
    }
  } else {
    console.log('[markReservationPaidAndConfirmed] ℹ️ Reservation already in "paid" status, proceeding to confirmation')
  }

  // Then, mark as 'confirmed' to finalize the booking
  console.log('[markReservationPaidAndConfirmed] 📝 Step 2: Marking reservation as CONFIRMED')
  const confirmMetadata = {
    ...(reservationRecord.metadata || {}),
    payment_confirmed_event: {
      eventId,
      eventType,
      confirmedAt: nowISO,
      payment_id: payment.id,
    },
    payment_status_history: buildStatusHistory(reservationRecord.metadata, 'confirmed'),
  }

  console.log('[markReservationPaidAndConfirmed] Attempting to update status to "confirmed":', {
    reservationId,
    currentStatus: reservationRecord.status,
    targetStatus: 'confirmed',
    amount: payment.amount,
  })

  const { data: confirmedReservation, error: confirmError } = await supabase
    .from('reservations')
    .update({
      status: 'confirmed',
      amount_paid: payment.amount,
      updated_at: nowISO,
      metadata: confirmMetadata,
    })
    .eq('id', reservationId)
    .select('id, status, amount_paid')
    .single()

  console.log('[markReservationPaidAndConfirmed] Confirmation update result:', {
    success: !confirmError,
    hasData: !!confirmedReservation,
    status: confirmedReservation?.status,
    error: confirmError ? {
      message: confirmError.message,
      code: confirmError.code,
      details: confirmError.details,
      hint: confirmError.hint
    } : null
  })

  if (confirmError) {
    console.error('[markReservationPaidAndConfirmed] ❌ CRITICAL: Failed to confirm reservation', {
      reservationId,
      error: confirmError,
      errorDetails: JSON.stringify(confirmError, null, 2),
    })
    throw confirmError
  }

  if (!confirmedReservation) {
    console.error('[markReservationPaidAndConfirmed] ❌ CRITICAL: Reservation update returned no data')
    throw new Error('Reservation update failed - no data returned')
  }

  console.log('[markReservationPaidAndConfirmed] ✅✅✅ Reservation confirmed successfully:', {
    reservationId: confirmedReservation.id,
    status: confirmedReservation.status,
    amountPaid: confirmedReservation.amount_paid,
  })

  // 🔔 Send notifications to user
  try {
    const { data: fullReservation } = await supabase
      .from('reservations')
      .select(`
        id,
        user_id,
        start_time,
        courts (
          id,
          name,
          venues (
            id,
            name
          )
        )
      `)
      .eq('id', confirmedReservation.id)
      .single()

    if (fullReservation && fullReservation.user_id) {
      const courtData = Array.isArray(fullReservation.courts) ? fullReservation.courts[0] : fullReservation.courts
      const venueData = courtData?.venues ? (Array.isArray(courtData.venues) ? courtData.venues[0] : courtData.venues) : null
      
      const venueName = venueData?.name || 'Venue'
      const courtName = courtData?.name || 'Court'
      const bookingDate = new Date(fullReservation.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      // Send booking confirmed notification
      await createNotification({
        userId: fullReservation.user_id,
        ...NotificationTemplates.bookingConfirmed(venueName, courtName, bookingDate, confirmedReservation.id),
      })

      // Send payment received notification
      await createNotification({
        userId: fullReservation.user_id,
        ...NotificationTemplates.paymentReceived(payment.amount / 100, confirmedReservation.id),
      })

      console.log('[markReservationPaidAndConfirmed] 📬 Notifications sent to user:', fullReservation.user_id)
    }
  } catch (notificationError) {
    console.error('[markReservationPaidAndConfirmed] ⚠️ Failed to send notifications (non-critical):', notificationError)
    // Don't throw - notifications are non-critical, booking is already confirmed
  }
}

/**
 * Handle source.chargeable event
 * This fires when a payment source (GCash/Maya) becomes ready to charge
 */
async function handleSourceChargeable(data: any, eventId?: string) {
  const sourceId = data.id
  console.log('[handleSourceChargeable] 🔄 Starting handler')
  console.log('[handleSourceChargeable] Source ID:', sourceId)
  console.log('[handleSourceChargeable] Event ID:', eventId)
  console.log('[handleSourceChargeable] Source data:', {
    id: data.id,
    type: data.type,
    status: data.attributes?.status,
    amount: data.attributes?.amount
  })

  const supabase = createServiceClient()
  console.log('[handleSourceChargeable] ✅ Supabase service client created')

  // Find the payment record
  console.log('[handleSourceChargeable] 🔍 Querying payments table for external_id:', sourceId)
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*, reservations(*)')
    .eq('external_id', sourceId)
    .single()

  console.log('[handleSourceChargeable] Database query result:', {
    found: !!payment,
    paymentId: payment?.id,
    reservationId: payment?.reservation_id,
    paymentStatus: payment?.status,
    paymentAmount: payment?.amount,
    hasReservationData: !!payment?.reservations,
    error: paymentError ? {
      message: paymentError.message,
      code: paymentError.code,
      details: paymentError.details
    } : null
  })

  if (paymentError || !payment) {
    console.error('[handleSourceChargeable] ❌ Payment not found for source:', sourceId)
    console.error('[handleSourceChargeable] Database error:', paymentError)
    return
  }

  const baseMetadata = payment.metadata || {}
  const processedEvents: string[] = Array.isArray(baseMetadata.processed_events)
    ? baseMetadata.processed_events.filter((entry: unknown) => typeof entry === 'string')
    : []

  if (eventId && processedEvents.includes(eventId)) {
    console.log('source.chargeable webhook already processed for event:', eventId)
    return
  }

  // IDEMPOTENCY CHECK: ensure reservation is confirmed even if payment already completed
  if (payment.status === 'completed') {
    console.log('Payment already completed, verifying reservation status for source:', sourceId)

    const completedAt = new Date().toISOString()
    const finalProcessedEvents = eventId
      ? Array.from(new Set([...processedEvents, eventId]))
      : processedEvents

    if (finalProcessedEvents.length !== processedEvents.length) {
      const { error: metadataError } = await supabase
        .from('payments')
        .update({
          metadata: {
            ...baseMetadata,
            processed_events: finalProcessedEvents,
            last_success_event: {
              id: eventId,
              type: 'source.chargeable',
              processedAt: completedAt,
            },
          },
        })
        .eq('id', payment.id)

      if (metadataError) {
        console.warn('source.chargeable webhook: Failed to append processed event metadata:', metadataError)
      }
    }

    try {
      await markReservationPaidAndConfirmed({
        supabase,
        payment,
        eventId,
        eventType: 'source.chargeable:duplicate',
      })
    } catch (verifyError) {
      console.error('Failed to verify reservation for already completed payment:', verifyError)
    }
    return
  }

  // Check if currently being processed
  if (baseMetadata.processing) {
    const processingStartedAt = baseMetadata.processing_started_at
    const processingDuration = processingStartedAt
      ? Date.now() - new Date(processingStartedAt).getTime()
      : 0

    // If processing for more than 5 minutes, allow retry
    if (processingDuration < 5 * 60 * 1000) {
      console.warn('Payment already being processed, skipping:', sourceId)
      return
    }
  }

  // Mark as processing to prevent concurrent handling
  await supabase
    .from('payments')
    .update({
      metadata: {
        ...baseMetadata,
        processed_events: processedEvents,
        processing: true,
        processing_started_at: new Date().toISOString(),
        last_processing_event: eventId,
      }
    })
    .eq('id', payment.id)

  // Import the charge processing function
  const { createPayment } = await import('@/lib/paymongo/client')

  try {
    console.log('[handleSourceChargeable] Creating payment with source:', {
      sourceId,
      paymentMethod: payment.payment_method,
      amountPesos: payment.amount,
      amountCentavos: Math.round(payment.amount * 100)
    })

    // Create the actual payment/charge from the chargeable source
    // IMPORTANT: source.type must always be 'source' (not 'gcash' or 'paymaya')
    // The PayMongo API knows the payment method from the source ID
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

    const completedAt = new Date().toISOString()
    const finalProcessedEvents = eventId
      ? Array.from(new Set([...processedEvents, eventId]))
      : processedEvents

    // Update payment record
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: completedAt,
        external_id: paymentResult.id, // Update with payment ID
        metadata: {
          ...baseMetadata,
          processed_events: finalProcessedEvents,
          paymongo_payment: paymentResult,
          processing: false,
          processing_completed_at: completedAt,
          last_success_event: {
            id: eventId,
            type: 'source.chargeable',
            processedAt: completedAt,
          },
        },
      })
      .eq('id', payment.id)

    await markReservationPaidAndConfirmed({
      supabase,
      payment,
      eventId,
      eventType: 'source.chargeable',
    })

    console.log('✅ Webhook: Payment completed and reservation confirmed:', payment.reservation_id)

    try {
      revalidatePath('/reservations')
      revalidatePath('/bookings')
    } catch (revalidateError) {
      console.warn('RevalidatePath failed in source.chargeable webhook:', revalidateError)
    }

    // TODO: Send confirmation email
  } catch (error) {
    console.error('Error processing chargeable source:', error)

    const failureAt = new Date().toISOString()

    // Update payment status to failed
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          ...baseMetadata,
          error: error instanceof Error ? error.message : 'Unknown error',
          failed_at: failureAt,
          processing: false,
          last_failure_event: {
            id: eventId,
            type: 'source.chargeable',
            processedAt: failureAt,
          },
        }
      })
      .eq('id', payment.id)

    // NEW: Cancel the reservation to free up the time slot
    if (payment.reservation_id) {
      await supabase
        .from('reservations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Payment processing failed',
          metadata: {
            ...payment.reservations?.metadata,
            cancelled_by_system: true,
            payment_error: error instanceof Error ? error.message : 'Payment failed'
          }
        })
        .eq('id', payment.reservation_id)

      console.log('Reservation cancelled due to payment failure:', payment.reservation_id)
    }
  }
}

/**
 * Handle payment.paid event
 * This fires when a payment is successfully completed
 */
async function handlePaymentPaid(data: any, eventId?: string) {
  const paymentId = data.id
  console.log('Payment paid:', paymentId)

  const supabase = createServiceClient()

  // Attempt to find the payment record by several possible identifiers
  // 1) external_id (the payment id)
  // 2) the source id (some webhooks reference the source)
  // 3) a payment_reference stored in metadata
  const sourceId = data.attributes?.source?.id || data.attributes?.source_id
  const paymentReference = data.attributes?.metadata?.payment_reference || data.attributes?.metadata?.payment_id
  const reservationIdFromPayload = data.attributes?.metadata?.reservation_id

  const findPaymentByColumn = async (column: string, value?: string | null) => {
    if (!value) return null
    const { data: results, error } = await supabase
      .from('payments')
      .select('*, reservations(*)')
      .eq(column, value)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !results || results.length === 0) {
      return null
    }

    return results[0]
  }

  const findPaymentByMetadataReference = async (value?: string | null) => {
    if (!value) return null
    const { data: results, error } = await supabase
      .from('payments')
      .select('*, reservations(*)')
      .contains('metadata', { payment_reference: value })
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !results || results.length === 0) {
      return null
    }

    return results[0]
  }

  let payment: any = null

  payment = await findPaymentByColumn('external_id', paymentId)
  if (!payment) payment = await findPaymentByColumn('external_id', sourceId)
  if (!payment) payment = await findPaymentByColumn('reference', paymentReference)
  if (!payment) payment = await findPaymentByMetadataReference(paymentReference)
  if (!payment) payment = await findPaymentByColumn('reservation_id', reservationIdFromPayload)

  if (!payment) {
    console.error('Payment not found:', paymentId)
    return
  }

  const baseMetadata = payment.metadata || {}
  const processedEvents: string[] = Array.isArray(baseMetadata.processed_events)
    ? baseMetadata.processed_events.filter((entry: unknown) => typeof entry === 'string')
    : []

  if (eventId && processedEvents.includes(eventId)) {
    console.log('payment.paid webhook already processed for event:', eventId)
    try {
      await markReservationPaidAndConfirmed({
        supabase,
        payment,
        eventId,
        eventType: 'payment.paid:duplicate',
      })
    } catch (verifyError) {
      console.error('Failed to verify reservation on duplicate payment.paid event:', verifyError)
    }
    return
  }

  const completedAt = new Date().toISOString()
  const finalProcessedEvents = eventId
    ? Array.from(new Set([...processedEvents, eventId]))
    : processedEvents

  if (payment.status !== 'completed') {
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: completedAt,
        metadata: {
          ...baseMetadata,
          processed_events: finalProcessedEvents,
          last_success_event: {
            id: eventId,
            type: 'payment.paid',
            processedAt: completedAt,
          },
          paymongo_payment: {
            ...(baseMetadata.paymongo_payment || {}),
            last_webhook_event: {
              id: eventId,
              type: 'payment.paid',
              receivedAt: completedAt,
            },
          },
        },
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('payment.paid webhook: Failed to update payment record:', updateError)
    }
  } else if (finalProcessedEvents.length !== processedEvents.length) {
    const { error: metadataError } = await supabase
      .from('payments')
      .update({
        metadata: {
          ...baseMetadata,
          processed_events: finalProcessedEvents,
          last_success_event: {
            id: eventId,
            type: 'payment.paid',
            processedAt: completedAt,
          },
        },
      })
      .eq('id', payment.id)

    if (metadataError) {
      console.warn('payment.paid webhook: Failed to append processed event metadata:', metadataError)
    }
  }

  await markReservationPaidAndConfirmed({
    supabase,
    payment,
    eventId,
    eventType: 'payment.paid',
  })

  console.log('✅ payment.paid webhook: Reservation confirmed:', payment.reservation_id)

  try {
    revalidatePath('/reservations')
    revalidatePath('/bookings')
  } catch (e) {
    console.warn('RevalidatePath failed in webhook:', e)
  }
}

/**
 * Handle payment.failed event
 * This fires when a payment fails
 */
async function handlePaymentFailed(data: any, eventId?: string) {
  const paymentId = data.id
  const failureCode = data.attributes?.failure_code
  const failureMessage = data.attributes?.failure_message

  console.log('Payment failed:', paymentId, failureCode, failureMessage)

  const supabase = createServiceClient()

  // Flexible lookup (payment id, source id, payment_reference in metadata)
  const sourceId = data.attributes?.source?.id || data.attributes?.source_id
  const paymentReference = data.attributes?.metadata?.payment_reference || data.attributes?.metadata?.payment_id
  const reservationIdFromPayload = data.attributes?.metadata?.reservation_id

  let payment: any = null

  const findPaymentByColumn = async (column: string, value?: string | null) => {
    if (!value) return null
    const { data: results, error } = await supabase
      .from('payments')
      .select('*, reservations(*)')
      .eq(column, value)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !results || results.length === 0) {
      return null
    }

    return results[0]
  }

  const findPaymentByMetadataReference = async (value?: string | null) => {
    if (!value) return null
    const { data: results, error } = await supabase
      .from('payments')
      .select('*, reservations(*)')
      .contains('metadata', { payment_reference: value })
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !results || results.length === 0) {
      return null
    }

    return results[0]
  }

  payment = await findPaymentByColumn('external_id', paymentId)
  if (!payment) payment = await findPaymentByColumn('external_id', sourceId)
  if (!payment) payment = await findPaymentByColumn('reference', paymentReference)
  if (!payment) payment = await findPaymentByMetadataReference(paymentReference)
  if (!payment) payment = await findPaymentByColumn('reservation_id', reservationIdFromPayload)

  if (!payment) {
    console.error('Payment not found:', paymentId)
    return
  }

  const baseMetadata = payment.metadata || {}
  const processedEvents: string[] = Array.isArray(baseMetadata.processed_events)
    ? baseMetadata.processed_events.filter((entry: unknown) => typeof entry === 'string')
    : []

  if (eventId && processedEvents.includes(eventId)) {
    console.log('payment.failed webhook already processed for event:', eventId)
    return
  }

  const failureAt = new Date().toISOString()
  const finalProcessedEvents = eventId
    ? Array.from(new Set([...processedEvents, eventId]))
    : processedEvents

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      metadata: {
        ...baseMetadata,
        failure_code: failureCode,
        failure_message: failureMessage,
        processed_events: finalProcessedEvents,
        last_failure_event: {
          id: eventId,
          type: 'payment.failed',
          processedAt: failureAt,
        },
      },
    })
    .eq('id', payment.id)

  // Cancel the reservation to free up the time slot
  if (payment.reservation_id) {
    const reservationRecord = normalizeReservation(payment.reservations)
    const reservationMetadata = reservationRecord?.metadata || {}

    await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Payment failed',
        metadata: {
          ...reservationMetadata,
          cancelled_by_system: true,
          payment_failed_event: {
            id: eventId,
            code: failureCode,
            message: failureMessage,
            processedAt: failureAt,
          },
        }
      })
      .eq('id', payment.reservation_id)

    console.log('Reservation cancelled due to failed payment:', payment.reservation_id)
  }

  try {
    revalidatePath('/reservations')
    revalidatePath('/bookings')
  } catch (e) {
    console.warn('RevalidatePath failed in webhook:', e)
  }

  console.log('Reservation cancelled due to payment failure:', payment.reservation_id)
}
