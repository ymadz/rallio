'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2, ArrowRight, Receipt, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { processChargeableSourceAction } from '@/app/actions/payments';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');
  const sessionId = searchParams.get('session');
  const sourceId = searchParams.get('source_id');

  const [participant, setParticipant] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(!!sourceId);
  const [processingError, setProcessingError] = useState<string | null>(null);

  useEffect(() => {
    // Trigger confetti celebration
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function processPayment() {
      if (!sourceId) return;

      try {
        console.log('[QueuePaymentSuccessPage] 🔄 Processing source_id:', sourceId);
        const result = await processChargeableSourceAction(sourceId);

        if (!result.success) {
          console.error('[QueuePaymentSuccessPage] ❌ Processing failed:', result.error);
          setProcessingError(result.error || 'Failed to process payment');
        } else {
          console.log('[QueuePaymentSuccessPage] ✅ Payment processed successfully');
        }
      } catch (err) {
        console.error('[QueuePaymentSuccessPage] 🧨 Unexpected error:', err);
        setProcessingError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsProcessing(false);
      }
    }

    processPayment();
  }, [sourceId]);

  useEffect(() => {
    const loadPaymentDetails = async () => {
      if (!participantId) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch participant details with payment info
        const { data: participantData, error: participantError } = await supabase
          .from('queue_participants')
          .select(
            `
            *,
            queue_sessions (
              *,
              courts (
                name,
                venues (
                  name
                )
              )
            ),
            payments (
              id,
              amount,
              payment_method,
              paid_at,
              reference
            )
          `
          )
          .eq('id', participantId)
          .single();

        if (participantError) throw participantError;

        setParticipant(participantData);
        setSession(participantData.queue_sessions);
      } catch (error) {
        console.error('Error loading payment details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentDetails();
  }, [participantId]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Receipt className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Finalizing Payment</h2>
          <p className="text-gray-600">
            Please wait while we confirm your transaction and clear your balance...
          </p>
        </div>
      </div>
    );
  }

  if (processingError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full border border-red-100">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-8 font-medium">{processingError}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Try Again
            </button>
            <Link
              href="/queue"
              className="w-full px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium inline-block"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  const payment = participant?.payments?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-8">Your queue payment has been processed successfully</p>

          {/* Payment Details */}
          {participant && session && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left space-y-4">
              <div className="flex items-start gap-3">
                <Receipt className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Queue Session</p>
                  <p className="font-semibold text-gray-900">
                    {session.courts?.venues?.name} • {session.courts?.name}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-sm text-gray-500">Games Played</p>
                    <p className="font-semibold text-gray-900">{participant.games_played || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount Paid</p>
                    <p className="font-semibold text-gray-900">
                      ₱
                      {payment?.amount?.toFixed(2) || participant.amount_owed?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>

                {payment && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-500">Payment Method</p>
                        <p className="font-semibold text-gray-900 capitalize">
                          {payment.payment_method === 'gcash'
                            ? 'GCash'
                            : payment.payment_method === 'paymaya'
                              ? 'Maya'
                              : payment.payment_method === 'cash'
                                ? 'Cash'
                                : payment.payment_method || 'Cash'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Promo / Discount</p>
                        <p className="font-semibold text-gray-900">
                          {session.discount_amount && session.discount_amount > 0 ? (
                            <span className="text-green-600">
                              -₱{session.discount_amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Paid At</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(payment.paid_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {payment.reference && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Transaction ID</p>
                        <p className="font-mono text-xs text-gray-700 break-all mt-1">
                          {payment.reference}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Thank You Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Thank you for playing!</span>
              <br />
              Your payment has been recorded and you're all set.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {session && (
              <Link
                href={`/queue/${session.court_id}`}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold inline-flex items-center justify-center gap-2"
              >
                Return to Queue
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link
              href="/queue"
              className="w-full px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium inline-block"
            >
              Find Another Queue
            </Link>
          </div>
        </div>

        {/* Receipt Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">A receipt has been saved to your account history</p>
        </div>
      </div>
    </div>
  );
}

export default function QueuePaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
