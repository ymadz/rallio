'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { processChargeableSourceAction, processPaymentByReservationAction } from '@/app/actions/payments'
import Link from 'next/link'

export default function QueueMasterPaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservation')
  const [queueSessionId, setQueueSessionId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function processPayment() {
      try {
        const sourceId = searchParams.get('source_id')

        if (sourceId) {
          const result = await processChargeableSourceAction(sourceId)

          if (!result.success) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            const retryResult = await processChargeableSourceAction(sourceId)
            if (!retryResult.success) {
              setError(retryResult.error || 'Failed to process payment. Please contact support if payment was deducted.')
            }
          }

          setProcessing(false)
          return
        }

        if (reservationId) {
          await new Promise(resolve => setTimeout(resolve, 2000))

          const result = await processPaymentByReservationAction(reservationId)

          if (!result.success && result.status === 'pending_payment') {
            await new Promise(resolve => setTimeout(resolve, 3000))
            const retryResult = await processPaymentByReservationAction(reservationId)
            if (!retryResult.success && retryResult.error) {
              // Avoid blocking the user for pending status
              console.warn('[QueueMasterPaymentSuccess] Payment may still be processing:', retryResult.error)
            }
          } else if (!result.success && result.error) {
            setError(result.error)
          }

          setProcessing(false)
          return
        }

        setProcessing(false)
      } catch (err) {
        console.error('[QueueMasterPaymentSuccess] Payment processing error:', err)
        setError(err instanceof Error ? err.message : 'Payment processing failed')
        setProcessing(false)
      }
    }

    processPayment()
  }, [searchParams, reservationId])

  useEffect(() => {
    async function findQueueSession() {
      if (!reservationId) return

      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data: queueSession } = await supabase
          .from('queue_sessions')
          .select('id')
          .filter('metadata->>reservation_id', 'eq', reservationId)
          .single()

        if (queueSession) {
          setQueueSessionId(queueSession.id)
        }
      } catch (err) {
        console.error('[QueueMasterPaymentSuccess] Error checking queue session:', err)
      }
    }

    findQueueSession()
  }, [reservationId])


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
          <Button onClick={() => router.push('/queue-master')}>Back to Queue Master</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your queue session is now active. Redirecting you to session management...
        </p>

        <div className="space-y-3">
          <Link
            href={queueSessionId ? `/queue-master/sessions/${queueSessionId}` : '/queue-master/sessions'}
            className="block"
          >
            <Button className="w-full">Manage Session</Button>
          </Link>

          <Link href="/queue-master" className="block">
            <Button variant="outline" className="w-full">
              Back to Queue Master
            </Button>
          </Link>

          {reservationId && (
            <Link href={`/bookings/${reservationId}/receipt`} className="block">
              <Button variant="outline" className="w-full">
                View Receipt
              </Button>
            </Link>
          )}
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
