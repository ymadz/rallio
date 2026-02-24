'use client'

import { useEffect, useState, useRef } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { createReservationAction } from '@/app/actions/reservations'
import { createQueueSession } from '@/app/actions/queue-actions'
import { initiatePaymentAction } from '@/app/actions/payments'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export function PaymentProcessing() {
  const router = useRouter()
  const {
    bookingData,
    isSplitPayment,
    playerCount,
    playerPayments,
    paymentMethod,
    getPerPlayerAmount,
    getTotalAmount,
    setCurrentStep,
    setBookingReference,
    discountAmount,
    discountType,
    discountReason,
  } = useCheckoutStore()

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  // Use useRef to prevent re-renders and useEffect loops
  const hasInitialized = useRef(false)
  const retryAttempts = useRef(0)
  const MAX_RETRIES = 1 // Allow 1 retry for transient errors

  useEffect(() => {
    // Create reservation and initiate payment
    const initializePayment = async () => {
      // Prevent double initialization using ref (doesn't cause re-renders)
      if (hasInitialized.current) {
        console.log('Payment initialization already started, skipping...')
        return
      }

      // Guard clause: Only proceed if we have valid booking data
      if (!bookingData) {
        console.warn('Payment initialization skipped: No booking data available')
        return
      }

      // CRITICAL: Only initialize if payment method has been selected
      if (!paymentMethod) {
        console.warn('Payment initialization skipped: No payment method selected yet')
        return
      }

      // Validate all required booking data fields
      if (!bookingData.courtId || !bookingData.venueId || !bookingData.date ||
        !bookingData.startTime || !bookingData.endTime) {
        console.error('Payment initialization error: Missing required booking data fields', bookingData)
        setError('Invalid booking data. Please go back and select a time slot again.')
        setLoading(false)
        return
      }

      // Mark as initialized immediately to prevent race conditions
      hasInitialized.current = true
      setLoading(true)
      setError(null)

      try {
        // Get the current user
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('User not authenticated')
        }

        // Step 1: Create the reservation
        // Ensure date is a Date object (might be string from localStorage)
        const bookingDate = typeof bookingData.date === 'string'
          ? new Date(bookingData.date)
          : bookingData.date

        if (Number.isNaN(bookingDate.getTime())) {
          console.error('Invalid booking date detected:', bookingData.date)
          throw new Error('Invalid booking date. Please select your time slot again.')
        }

        const [startHour, startMinute] = bookingData.startTime.split(':').map(Number)
        const [endHour, endMinute] = bookingData.endTime.split(':').map(Number)

        const startDateTime = new Date(bookingDate.getTime())
        startDateTime.setHours(startHour, startMinute ?? 0, 0, 0)

        const endDateTime = new Date(bookingDate.getTime())
        endDateTime.setHours(endHour, endMinute ?? 0, 0, 0)

        // Handle overnight bookings gracefully (should not typically happen but avoids zero-length ranges)
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1)
        }

        const startTimeISO = startDateTime.toISOString()
        const endTimeISO = endDateTime.toISOString()

        console.log('Creating reservation with data:', {
          courtId: bookingData.courtId,
          userId: user.id,
          startTimeISO,
          endTimeISO,
          totalAmount: getTotalAmount(),
        })

        let newReservationId: string | null = null

        if (bookingData.isQueueSession && bookingData.queueSessionData) {
          console.log('Creating queue session(s)...')

          const sessionResult = await createQueueSession({
            courtId: bookingData.courtId,
            startTime: startDateTime,
            endTime: endDateTime,
            mode: bookingData.queueSessionData.mode,
            gameFormat: bookingData.queueSessionData.gameFormat,
            maxPlayers: bookingData.queueSessionData.maxPlayers,
            costPerGame: bookingData.queueSessionData.costPerGame,
            isPublic: bookingData.queueSessionData.isPublic,
            recurrenceWeeks: bookingData.recurrenceWeeks,
            selectedDays: bookingData.selectedDays
          })

          if (!sessionResult.success) {
            console.error('Queue session creation failed:', sessionResult.error)
            throw new Error(sessionResult.error || 'Failed to create queue session')
          }

          // If session requires approval, we stop here (no payment yet)
          if (sessionResult.requiresApproval) {
            router.push('/queue-master/sessions') // Or success page?
            return
          }

          // If no approval required, we expect a reservation ID for payment
          // If free (no payment required), metadata might indicate that?
          // But here we assume payment flow.
          // We must grab reservationId from the first created session.
          if (!sessionResult.session?.reservationId) {
            // Fallback for unexpected case where session created but no reservation ID returned
            // This might happen if session logic changed.
            console.error('No reservation ID returned for queue session')
            throw new Error('Failed to retrieve reservation details for payment')
          }

          newReservationId = sessionResult.session.reservationId

        } else {
          // Standard Reservation Flow
          console.log('Creating standard reservation...')

          const reservationResult = await createReservationAction({
            courtId: bookingData.courtId,
            userId: user.id,
            startTimeISO,
            endTimeISO,
            totalAmount: getTotalAmount(),
            numPlayers: isSplitPayment ? playerCount : 1,
            paymentType: isSplitPayment ? 'split' : 'full',
            paymentMethod,
            notes: isSplitPayment ? `Split payment with ${playerCount} players` : undefined,
            discountApplied: Math.abs(discountAmount),
            discountType,
            discountReason,
            recurrenceWeeks: bookingData.recurrenceWeeks,
            selectedDays: bookingData.selectedDays,
          })

          if (!reservationResult.success || !reservationResult.reservationId) {
            console.error('Reservation creation failed:', {
              error: reservationResult.error,
              bookingData: {
                courtId: bookingData.courtId,
                courtName: bookingData.courtName,
                venueName: bookingData.venueName,
                startTime: startTimeISO,
                endTime: endTimeISO,
              },
              userId: user.id,
            })
            throw new Error(reservationResult.error || 'Failed to create reservation')
          }
          newReservationId = reservationResult.reservationId
        }

        const confirmedReservationId = newReservationId
        setReservationId(confirmedReservationId)
        console.log('Reservation created successfully:', confirmedReservationId)

        // For cash payments, skip payment initiation and redirect to receipt
        if (paymentMethod === 'cash') {
          setLoading(false)
          setPaymentStatus('processing')
          setBookingReference(confirmedReservationId.slice(0, 8), confirmedReservationId)

          // Special handling for Queue Sessions with cash payment
          if (bookingData.isQueueSession) {
            // Queue sessions redirect to session management
            return
          }

          // Redirect cash bookings directly to the receipt page
          router.push(`/bookings/${confirmedReservationId}/receipt`)
          return
        }

        // Step 2: Initiate payment for e-wallet
        // Use the payment method selected by the user (gcash, maya, etc.)
        const paymentResult = await initiatePaymentAction(confirmedReservationId, 'gcash')

        if (!paymentResult.success || !paymentResult.checkoutUrl) {
          throw new Error(paymentResult.error || 'Failed to initiate payment')
        }

        // Set loading to false and update UI to show confirmation
        setLoading(false)
        setPaymentStatus('processing')
        setBookingReference(confirmedReservationId.slice(0, 8), confirmedReservationId)

        // Store checkout URL for manual redirect
        sessionStorage.setItem('paymongoCheckoutUrl', paymentResult.checkoutUrl)

        // Immediate redirect to prevent any state update issues
        // The 2-second delay was causing potential error flashes
        window.location.href = paymentResult.checkoutUrl
      } catch (err) {
        console.error('Payment initialization error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Payment initialization failed'
        setError(errorMessage)
        setLoading(false)

        // Auto-retry for transient errors (not user-facing errors like "already booked" or PayMongo config errors)
        const isTransientError = !errorMessage.includes('already booked') &&
          !errorMessage.includes('Invalid booking data') &&
          !errorMessage.includes('currently unavailable') &&
          !errorMessage.includes('Pay with Cash')

        if (isTransientError && retryAttempts.current < MAX_RETRIES) {
          retryAttempts.current += 1
          console.log(`Retrying payment initialization (attempt ${retryAttempts.current}/${MAX_RETRIES})...`)
          setIsRetrying(true)

          // Wait 2 seconds before retrying
          setTimeout(() => {
            hasInitialized.current = false
            setError(null)
            setLoading(true)
            setIsRetrying(false)
            // Trigger re-initialization
            initializePayment()
          }, 2000)
        } else {
          // Reset initialization flag to allow manual retry
          hasInitialized.current = false
          setIsRetrying(false)
        }
      }
    }

    initializePayment()
    // Note: getTotalAmount and setBookingReference are stable Zustand store functions
    // They don't need to be in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingData, paymentMethod])

  // Manual retry function
  const handleRetry = () => {
    console.log('Manual retry triggered by user')
    hasInitialized.current = false
    retryAttempts.current = 0
    setError(null)
    setLoading(true)
    setReservationId(null)
    // Trigger re-initialization by updating state
    window.location.reload() // Simple approach: reload the page
  }

  // Don't render anything if no booking data
  if (!bookingData) return null

  // Don't render anything if payment method hasn't been selected yet
  // This prevents the component from showing premature UI
  if (!paymentMethod) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-900 text-lg mb-2">Payment Method Required</h3>
              <p className="text-sm text-yellow-800">
                Please go back and select a payment method (E-Wallet or Cash) before proceeding to payment processing.
              </p>
              <button
                onClick={() => setCurrentStep('payment')}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
              >
                Go Back to Payment Method
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const amountToPay = isSplitPayment ? getPerPlayerAmount() : getTotalAmount()

  // Show loading/redirecting state for e-wallet payments
  if (loading && paymentMethod === 'e-wallet') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-primary/20 rounded-xl p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mb-6" />
            <h3 className="font-semibold text-gray-900 text-xl mb-2">
              {paymentStatus === 'processing' ? 'Redirecting to Payment...' : 'Processing Booking...'}
            </h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              {paymentStatus === 'processing'
                ? 'Redirecting you to secure payment...'
                : 'Creating your reservation and preparing payment checkout...'
              }
            </p>
            {reservationId && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 w-full max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-medium text-green-900">Reservation Created</p>
                </div>
                <p className="text-xs text-green-700">
                  Booking Reference: <span className="font-mono font-bold">{reservationId.slice(0, 8).toUpperCase()}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show retry indicator
  if (isRetrying) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-yellow-200 rounded-xl p-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-600 mb-4" />
            <h3 className="font-semibold text-yellow-900 text-lg mb-2">Retrying...</h3>
            <p className="text-sm text-yellow-800 text-center">
              The booking encountered an error. Automatically retrying in a moment...
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Attempt {retryAttempts.current} of {MAX_RETRIES}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 text-lg mb-2">Booking Failed</h3>
              <p className="text-sm text-red-800 mb-4">{error}</p>

              {/* Error-specific guidance */}
              {error.includes('already booked') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-700">
                    <strong>Tip:</strong> The time slot you selected may have just been booked by another user,
                    or there may be a pending reservation. Please try selecting a different time slot.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {/* Show retry button for non-conflict errors */}
                {!error.includes('already booked') && (
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Try Again
                  </button>
                )}

                {/* Show "Try Different Time" for conflict errors */}
                {error.includes('already booked') && (
                  <button
                    onClick={() => setCurrentStep('details')}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Choose Different Time
                  </button>
                )}

                {/* Always show "Return to Court" if we have a venue ID */}
                {bookingData?.venueId && (
                  <button
                    onClick={() => router.push(`/courts/${bookingData.venueId}`)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    Return to Court
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Debug info (only shown in development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Debug Information
            </summary>
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p><strong>Error:</strong> {error}</p>
              <p><strong>Court ID:</strong> {bookingData?.courtId || 'N/A'}</p>
              <p><strong>Venue ID:</strong> {bookingData?.venueId || 'N/A'}</p>
              <p><strong>Date:</strong> {bookingData?.date ? new Date(bookingData.date).toISOString() : 'N/A'}</p>
              <p><strong>Time:</strong> {bookingData?.startTime || 'N/A'} - {bookingData?.endTime || 'N/A'}</p>
              <p><strong>Reservation ID:</strong> {reservationId || 'Not created'}</p>
            </div>
          </details>
        )}
      </div>
    )
  }

  // Single payment (no split)
  if (!isSplitPayment) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 text-lg mb-4">
            {paymentMethod === 'e-wallet' ? 'Scan QR Code to Pay' : 'Cash Payment Instructions'}
          </h3>

          {paymentMethod === 'e-wallet' ? (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Scan this QR code using your e-wallet app (GCash, Maya, etc.) to complete your payment.
              </p>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary mb-4" />
                  <p className="text-sm text-gray-600">Generating QR code...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {/* QR Code */}
                  <div className="bg-white border-4 border-gray-200 rounded-xl p-4 mb-4">
                    {qrCodeUrl ? (
                      <div className="relative w-[300px] h-[300px]">
                        <Image
                          src={qrCodeUrl}
                          alt="Payment QR Code"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-[300px] h-[300px] bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-500">QR code unavailable</p>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-center mb-6">
                    <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
                    <p className="text-3xl font-bold text-primary">₱{amountToPay.toFixed(2)}</p>
                  </div>

                  {/* Instructions */}
                  <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-2">How to pay:</p>
                        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Open your e-wallet app (GCash, Maya, etc.)</li>
                          <li>Select "Scan QR" or "Pay via QR"</li>
                          <li>Point your camera at the QR code above</li>
                          <li>Confirm the payment amount</li>
                          <li>Complete the transaction</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  {paymentStatus === 'processing' && (
                    <div className="w-full mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-600 border-t-transparent" />
                        <p className="text-sm text-yellow-800">
                          Waiting for payment confirmation...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // Cash payment instructions
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white text-center">
                <p className="text-sm text-white/80 mb-2">Amount to Pay</p>
                <p className="text-4xl font-bold">₱{amountToPay.toFixed(2)}</p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900 mb-2">Important:</p>
                    <p className="text-xs text-orange-800">
                      Your booking will be marked as <strong>"Pending Payment"</strong>. Please bring the exact amount to the venue before your scheduled time. Failure to pay may result in booking cancellation and account restrictions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-2">Instructions:</p>
                    <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Save your booking reference number</li>
                      <li>Arrive at least 15 minutes before your scheduled time</li>
                      <li>Present your booking reference to the venue staff</li>
                      <li>Pay the exact amount in cash</li>
                      <li>Receive your payment receipt and court access</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (reservationId) {
                router.push(`/bookings/${reservationId}/receipt`)
              } else {
                setCurrentStep('confirmation')
              }
            }}
            disabled={paymentMethod === 'e-wallet' && paymentStatus !== 'success'}
            className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paymentMethod === 'e-wallet' ? 'Complete Booking' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    )
  }

  // Split payment (multiple players)
  return (
    <div className="space-y-6">
      {/* Split Payment Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">Split Payment Progress</h3>
            <p className="text-sm text-gray-600 mt-1">
              Each player needs to complete their payment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">
              {playerPayments.filter(p => p.status === 'paid').length}
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-2xl font-bold text-gray-900">{playerCount}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-500"
            style={{
              width: `${(playerPayments.filter(p => p.status === 'paid').length / playerCount) * 100}%`
            }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">
          {((playerPayments.filter(p => p.status === 'paid').length / playerCount) * 100).toFixed(0)}% Complete
        </p>
      </div>

      {/* Player Payment Cards */}
      <div className="grid gap-4">
        {playerPayments.map((payment) => (
          <div
            key={payment.playerNumber}
            className={`bg-white border-2 rounded-xl p-6 transition-all ${payment.status === 'paid'
              ? 'border-green-500 bg-green-50/50'
              : payment.status === 'pending'
                ? 'border-gray-200'
                : 'border-red-500 bg-red-50/50'
              }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`
                  h-10 w-10 rounded-full flex items-center justify-center font-bold
                  ${payment.status === 'paid' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}
                `}>
                  {payment.playerNumber}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Player {payment.playerNumber}</p>
                  {payment.email && (
                    <p className="text-xs text-gray-500">{payment.email}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">₱{payment.amountDue.toFixed(2)}</p>
                {payment.status === 'paid' && payment.paidAt && (
                  <p className="text-xs text-green-600 mt-1">
                    Paid {new Date(payment.paidAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {/* Status Badge */}
            {payment.status === 'paid' ? (
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Payment Confirmed</span>
              </div>
            ) : payment.status === 'pending' ? (
              <div>
                {paymentMethod === 'e-wallet' && payment.qrCodeUrl ? (
                  <div className="flex gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-2 flex-shrink-0">
                      <div className="relative w-32 h-32">
                        <Image
                          src={payment.qrCodeUrl}
                          alt={`QR Code for Player ${payment.playerNumber}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-sm text-gray-600 mb-2">
                        Scan with e-wallet app to pay
                      </p>
                      <div className="flex items-center gap-2 text-yellow-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent" />
                        <span className="text-xs font-medium">Waiting for payment...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <div className="animate-pulse h-2 w-2 rounded-full bg-yellow-600" />
                    <span className="text-sm font-medium">Pending Payment</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Payment Failed</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Warning for incomplete payments */}
      {playerPayments.some(p => p.status !== 'paid') && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-orange-800">
              <strong>Note:</strong> All players must complete their payments for the booking to be confirmed. This booking will be automatically cancelled if all payments are not received within 30 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (reservationId) {
              router.push(`/bookings/${reservationId}/receipt`)
            } else {
              setCurrentStep('confirmation')
            }
          }}
          disabled={playerPayments.some(p => p.status !== 'paid')}
          className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {playerPayments.every(p => p.status === 'paid') ? 'Complete Booking' : 'Waiting for All Payments'}
        </button>
      </div>
    </div>
  )
}
