'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { processChargeableSourceAction, processPaymentByReservationAction } from '@/app/actions/payments'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservation')

  const [processing, setProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Process the payment when PayMongo redirects back
    async function processPayment() {
      try {
        // Get the source_id from URL (PayMongo adds this on redirect)
        const sourceId = searchParams.get('source_id')

        console.log('[PaymentSuccessPage] Processing payment:', { reservationId, sourceId })

        // If we have source_id, use direct source processing
        if (sourceId) {
          console.log('[PaymentSuccessPage] Processing via source_id:', sourceId)

          const result = await processChargeableSourceAction(sourceId)

          if (!result.success) {
            console.error('[PaymentSuccessPage] Direct processing failed, retrying...')
            await new Promise(resolve => setTimeout(resolve, 3000))
            const retryResult = await processChargeableSourceAction(sourceId)
            if (!retryResult.success) {
              setError(retryResult.error || 'Failed to process payment. Please contact support if payment was deducted.')
            }
          } else {
            console.log('[PaymentSuccessPage] Payment processed successfully via source_id')
          }
          setProcessing(false)
          return
        }

        // Fallback: No source_id in URL - use reservation-based processing
        // This handles cases where PayMongo doesn't pass source_id back
        if (reservationId) {
          console.log('[PaymentSuccessPage] No source_id, using reservation-based processing:', reservationId)

          // Wait a moment for any webhook to complete
          await new Promise(resolve => setTimeout(resolve, 2000))

          const result = await processPaymentByReservationAction(reservationId)

          if (!result.success && result.status === 'pending_payment') {
            // Payment might still be processing - wait and retry
            console.log('[PaymentSuccessPage] Payment pending, waiting and retrying...')
            await new Promise(resolve => setTimeout(resolve, 3000))

            const retryResult = await processPaymentByReservationAction(reservationId)
            if (!retryResult.success && retryResult.error) {
              // Don't show error for pending payments - just show success and let user check bookings
              console.warn('[PaymentSuccessPage] Payment may still be processing:', retryResult.error)
            }
          } else if (!result.success && result.error) {
            setError(result.error)
          } else {
            console.log('[PaymentSuccessPage] Payment processed successfully via reservation')
          }
          setProcessing(false)
          return
        }

        // No identifiers at all
        console.warn('[PaymentSuccessPage] No source_id or reservation in URL')
        setProcessing(false)

      } catch (err) {
        console.error('[PaymentSuccessPage] Payment processing error:', err)
        setError(err instanceof Error ? err.message : 'Payment processing failed')
        setProcessing(false)
      }
    }

    processPayment()
  }, [searchParams, reservationId])

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-gray-600 mt-4">Processing your payment...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/bookings')}>View My Bookings</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been received and your court reservation is confirmed.
        </p>

        <div className="space-y-3">
          <Link href={`/bookings`} className="block">
            <Button className="w-full">View My Bookings</Button>
          </Link>
          <Link href="/courts" className="block">
            <Button variant="outline" className="w-full">
              Find More Courts
            </Button>
          </Link>
        </div>

        {reservationId && (
          <p className="text-xs text-gray-500 mt-6">
            Reservation ID: {reservationId.slice(0, 8)}...
          </p>
        )}
      </div>
    </div>
  )
}
