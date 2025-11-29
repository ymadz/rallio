'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { XCircle, Loader2, RefreshCw, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

function PaymentFailedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const participantId = searchParams.get('participant')
  const sessionId = searchParams.get('session')
  const error = searchParams.get('error')

  const [participant, setParticipant] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPaymentDetails = async () => {
      if (!participantId) {
        setIsLoading(false)
        return
      }

      try {
        const supabase = createClient()

        // Fetch participant details
        const { data: participantData, error: participantError } = await supabase
          .from('queue_participants')
          .select(`
            *,
            queue_sessions (
              *,
              courts (
                name,
                venues (
                  name
                )
              )
            )
          `)
          .eq('id', participantId)
          .single()

        if (participantError) throw participantError

        setParticipant(participantData)
        setSession(participantData.queue_sessions)
      } catch (error) {
        console.error('Error loading payment details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPaymentDetails()
  }, [participantId])

  const handleRetry = () => {
    // Navigate back to queue to retry payment
    if (session?.court_id) {
      router.push(`/queue/${session.court_id}`)
    } else {
      router.push('/queue')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Error Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600 mb-8">
            We couldn't process your payment. Please try again.
          </p>

          {/* Error Details */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">Error Details</p>
                  <p className="text-sm text-red-700">{decodeURIComponent(error)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Summary */}
          {participant && session && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left space-y-4">
              <div>
                <p className="text-sm text-gray-500">Queue Session</p>
                <p className="font-semibold text-gray-900">
                  {session.courts?.venues?.name} • {session.courts?.name}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Games Played</p>
                    <p className="font-semibold text-gray-900">{participant.games_played || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount Owed</p>
                    <p className="font-semibold text-red-600">
                      ₱{participant.amount_owed?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Common Issues */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-blue-900 mb-2">Common Issues:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Insufficient balance in your account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Payment timed out or expired</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Network connection interrupted</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Payment method not supported</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>

            <Link
              href="/queue"
              className="w-full px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Queues
            </Link>
          </div>

          {/* Support Note */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <Link href="/support" className="text-primary hover:underline font-medium">
                Contact Support
              </Link>
            </p>
          </div>
        </div>

        {/* Payment Warning */}
        {participant?.amount_owed > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-yellow-800 text-center">
              <span className="font-semibold">Important:</span> You still have an outstanding balance. Please complete payment before leaving the queue.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QueuePaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  )
}
