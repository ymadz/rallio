'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckoutStore } from '@/stores/checkout-store'
import { CheckoutStepper } from '@/components/checkout/checkout-stepper'
import { BookingSummaryCard } from '@/components/checkout/booking-summary-card'
import { SplitPaymentControls } from '@/components/checkout/split-payment-controls'
import { PaymentMethodSelector } from '@/components/checkout/payment-method-selector'
import { CancellationPolicy } from '@/components/checkout/cancellation-policy'
import { PaymentProcessing } from '@/components/checkout/payment-processing'
import { BookingConfirmation } from '@/components/checkout/booking-confirmation'

export default function CheckoutPage() {
  const router = useRouter()
  const {
    bookingData,
    currentStep,
    isSplitPayment,
    paymentMethod,
    policyAccepted,
    playerCount,
    setCurrentStep,
    resetCheckout,
    getSubtotal,
  } = useCheckoutStore()

  // Redirect if no booking data
  useEffect(() => {
    if (!bookingData) {
      router.push('/courts')
    }
  }, [bookingData, router])

  if (!bookingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary" />
      </div>
    )
  }

  // Calculate duration from startTime and endTime
  const startHour = parseInt(bookingData.startTime.split(':')[0])
  const endHour = parseInt(bookingData.endTime.split(':')[0])
  const duration = endHour - startHour
  const totalBookingFee = getSubtotal() // This now includes duration

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      resetCheckout()
      router.push(`/courts/${bookingData.venueId}`)
    }
  }

  const handleContinue = () => {
    if (currentStep === 'details') {
      setCurrentStep('payment')
    } else if (currentStep === 'payment') {
      if (!paymentMethod) {
        alert('Please select a payment method')
        return
      }
      setCurrentStep('policy')
    } else if (currentStep === 'policy') {
      if (!policyAccepted) {
        alert('Please accept the cancellation policy to continue')
        return
      }
      setCurrentStep('processing')
    }
  }

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('details')
    } else if (currentStep === 'policy') {
      setCurrentStep('payment')
    } else if (currentStep === 'processing') {
      setCurrentStep('policy')
    }
  }

  const canContinue = () => {
    if (currentStep === 'details') return true
    if (currentStep === 'payment') return paymentMethod !== null
    if (currentStep === 'policy') return policyAccepted
    return false
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <CheckoutStepper currentStep={currentStep} />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Details */}
            {currentStep === 'details' && (
              <>
                {/* Court Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 text-lg mb-4">Court Details</h3>
                  <div className="flex gap-4">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-xl mb-2">{bookingData.courtName}</h4>
                      <p className="text-sm text-gray-600 mb-3">{bookingData.venueName}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          🏸 Indoor
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Synthetic
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Capacity: {bookingData.capacity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail Breakdown */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 text-lg mb-4">Detail Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Players Allowed to Play:</span>
                      <span className="font-medium text-gray-900">{bookingData.capacity}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-gray-900">{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Hourly Rate:</span>
                      <span className="font-medium text-gray-900">₱{bookingData.hourlyRate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-gray-600">Booking Fee:</span>
                      <span className="font-medium text-gray-900">₱{totalBookingFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Split Payment Controls */}
                <SplitPaymentControls />

                {/* Split Payment Breakdown */}
                {isSplitPayment && (
                  <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-white/80 text-sm mb-1">Booking Fee:</p>
                        <p className="text-xl font-bold">₱{totalBookingFee.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-white/80 text-sm mb-1">Player(s) Fee:</p>
                        <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-white/80 text-sm mb-1">Total Amount Due:</p>
                        <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 2: Payment Method */}
            {currentStep === 'payment' && (
              <>
                {/* Detail Breakdown (repeated) */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 text-lg mb-4">Detail Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Players Allowed to Play:</span>
                      <span className="font-medium text-gray-900">{bookingData.capacity}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-gray-900">{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Hourly Rate:</span>
                      <span className="font-medium text-gray-900">₱{bookingData.hourlyRate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-gray-600">Booking Fee:</span>
                      <span className="font-medium text-gray-900">₱{totalBookingFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Split Payment Info */}
                {isSplitPayment && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="font-semibold text-gray-900">Play Together, Pay Together!</h4>
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                        {playerCount}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Divide the total fee among your group — fair and simple.
                    </p>

                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-white/80 text-sm mb-1">Booking Fee:</p>
                          <p className="text-xl font-bold">₱{totalBookingFee.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-white/80 text-sm mb-1">Player(s) Fee:</p>
                          <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-white/80 text-sm mb-1">Total Amount Due:</p>
                          <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <PaymentMethodSelector />
                </div>
              </>
            )}

            {/* Step 3: Policy */}
            {currentStep === 'policy' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <CancellationPolicy />
              </div>
            )}

            {/* Step 4: Processing */}
            {currentStep === 'processing' && (
              <PaymentProcessing />
            )}

            {/* Step 5: Confirmation */}
            {currentStep === 'confirmation' && (
              <BookingConfirmation />
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <BookingSummaryCard />
          </div>
        </div>

        {/* Footer Actions */}
        {currentStep !== 'processing' && currentStep !== 'confirmation' && (
          <div className="mt-8 flex items-center justify-between max-w-5xl">
            <button
              onClick={handleBack}
              disabled={currentStep === 'details'}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue()}
              className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
