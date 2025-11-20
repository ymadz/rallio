'use client'

import { useEffect, useState } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import Image from 'next/image'

export function PaymentProcessing() {
  const {
    bookingData,
    isSplitPayment,
    playerCount,
    playerPayments,
    paymentMethod,
    getPerPlayerAmount,
    getTotalAmount,
    setCurrentStep,
  } = useCheckoutStore()

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success'>('pending')

  useEffect(() => {
    // Simulate QR code generation
    // In real implementation, this would call PayMongo API to create a payment link
    const generateQRCode = async () => {
      setLoading(true)
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Mock QR code URL (in production, this comes from PayMongo)
        setQrCodeUrl('https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=PAYMONGO_PAYMENT_LINK')
        setPaymentStatus('processing')
      } catch (error) {
        console.error('Failed to generate QR code:', error)
      } finally {
        setLoading(false)
      }
    }

    if (paymentMethod === 'e-wallet') {
      generateQRCode()
    } else {
      // For cash payments, skip QR generation
      setLoading(false)
      setPaymentStatus('processing')
    }
  }, [paymentMethod])

  if (!bookingData) return null

  const amountToPay = isSplitPayment ? getPerPlayerAmount() : getTotalAmount()

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
            onClick={() => setCurrentStep('confirmation')}
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
            className={`bg-white border-2 rounded-xl p-6 transition-all ${
              payment.status === 'paid'
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
          onClick={() => setCurrentStep('confirmation')}
          disabled={playerPayments.some(p => p.status !== 'paid')}
          className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {playerPayments.every(p => p.status === 'paid') ? 'Complete Booking' : 'Waiting for All Payments'}
        </button>
      </div>
    </div>
  )
}
