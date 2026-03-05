'use client'

import { useState, useEffect } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'

export function PaymentMethodSelector() {
  const {
    paymentMethod,
    setPaymentMethod,
    downPaymentPercentage,
    getTotalAmount,
    setCustomDownPaymentAmount,
    customDownPaymentAmount,
  } = useCheckoutStore()

  const total = getTotalAmount()
  const isDownPaymentRequired = downPaymentPercentage ? downPaymentPercentage > 0 : false
  const minimumDownPayment = isDownPaymentRequired
    ? Math.round((total * ((downPaymentPercentage ?? 20) / 100)) * 100) / 100
    : 0

  const [inputValue, setInputValue] = useState('')

  // Auto-set down payment to minimum when cash is selected
  useEffect(() => {
    if (paymentMethod === 'cash' && isDownPaymentRequired) {
      if (!customDownPaymentAmount || customDownPaymentAmount <= 0) {
        setCustomDownPaymentAmount(minimumDownPayment)
        setInputValue(minimumDownPayment.toFixed(2))
      } else {
        setInputValue(customDownPaymentAmount.toFixed(2))
      }
    }
  }, [paymentMethod, isDownPaymentRequired])

  const handleAmountChange = (value: string) => {
    setInputValue(value)
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed > 0) {
      setCustomDownPaymentAmount(parsed)
    } else if (value === '') {
      setCustomDownPaymentAmount(minimumDownPayment)
    }
  }

  const effectiveAmount = Math.min(Math.max(customDownPaymentAmount || minimumDownPayment, 0), total)
  const isBelowMinimum = customDownPaymentAmount !== undefined && customDownPaymentAmount > 0 && customDownPaymentAmount < minimumDownPayment
  const isAboveTotal = customDownPaymentAmount !== undefined && customDownPaymentAmount > total

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 text-lg">Select Payment Method</h3>

      <div className="grid md:grid-cols-2 gap-4">
        {/* E-Wallet Option */}
        <button
          onClick={() => setPaymentMethod('e-wallet')}
          className={`
            relative border-2 rounded-xl p-6 text-left transition-all
            ${paymentMethod === 'e-wallet'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          {/* Radio indicator */}
          <div className="absolute top-4 right-4">
            <div
              className={`
                h-5 w-5 rounded-full border-2 flex items-center justify-center
                ${paymentMethod === 'e-wallet' ? 'border-primary' : 'border-gray-300'}
              `}
            >
              {paymentMethod === 'e-wallet' && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          </div>

          {/* Icon */}
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h4 className="font-semibold text-gray-900 mb-2">E-Wallet</h4>
          <p className="text-sm text-gray-600">
            Pay via GCash, Maya, or other e-wallets using QR code. Instant confirmation.
          </p>

          {paymentMethod === 'e-wallet' && (
            <div className="mt-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-green-600">Selected</span>
            </div>
          )}
        </button>

        {/* Cash Option */}
        <button
          onClick={() => setPaymentMethod('cash')}
          className={`
            relative border-2 rounded-xl p-6 text-left transition-all
            ${paymentMethod === 'cash'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          {/* Radio indicator */}
          <div className="absolute top-4 right-4">
            <div
              className={`
                h-5 w-5 rounded-full border-2 flex items-center justify-center
                ${paymentMethod === 'cash' ? 'border-primary' : 'border-gray-300'}
              `}
            >
              {paymentMethod === 'cash' && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          </div>

          {/* Icon */}
          <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>

          <h4 className="font-semibold text-gray-900 mb-2">Cash</h4>
          <p className="text-sm text-gray-600">
            {isDownPaymentRequired
              ? `Pay a minimum ${downPaymentPercentage}% down payment online to secure your slot. Pay the rest at the venue.`
              : 'Pay in cash at the venue. Booking will be pending until payment is verified.'}
          </p>

          {paymentMethod === 'cash' && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-green-600">Selected</span>
              </div>
              <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-orange-800">
                  <strong>Warning:</strong> Lack of cash payment may result in account restrictions. See policy.
                </p>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Down Payment Section */}
      {paymentMethod === 'cash' && isDownPaymentRequired && (
        <div className={`mt-2 rounded-xl overflow-hidden transition-colors bg-gradient-to-br from-primary via-primary/90 to-primary/70 ${isBelowMinimum ? 'ring-2 ring-red-400' : ''}`}>
          {/* Header */}
          <div className="px-5 py-3 backdrop-blur-md bg-white/15 border-b border-white/20">
            <h4 className="text-sm font-semibold text-white">Down Payment</h4>
            <p className="text-xs text-white/70 mt-0.5">
              Minimum {downPaymentPercentage}% required to secure your booking
            </p>
          </div>

          {/* Input */}
          <div className="px-5 py-4 backdrop-blur-sm bg-white/10">
            <label className="block text-xs font-medium text-white/70 mb-1.5">Enter amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm font-medium">₱</span>
              <input
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    handleAmountChange(val)
                  }
                }}
                onBlur={() => {
                  const parsed = parseFloat(inputValue)
                  if (!isNaN(parsed) && parsed > 0) {
                    setInputValue(parsed.toFixed(2))
                  } else {
                    setInputValue(minimumDownPayment.toFixed(2))
                    setCustomDownPaymentAmount(minimumDownPayment)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={minimumDownPayment.toFixed(2)}
                className={`w-full pl-8 pr-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 transition-colors backdrop-blur-md ${
                  isBelowMinimum
                    ? 'bg-red-500/20 border border-red-300/50 text-red-100 placeholder-red-200/50 focus:ring-red-400/40'
                    : 'bg-white/20 border border-white/30 text-white placeholder-white/40 focus:ring-white/40'
                }`}
              />
            </div>

            {/* Validation message */}
            {isBelowMinimum && (
              <p className="mt-1.5 text-xs text-red-200 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Minimum is ₱{minimumDownPayment.toFixed(2)}
              </p>
            )}
            {isAboveTotal && (
              <p className="mt-1.5 text-xs text-orange-200 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Maximum is ₱{total.toFixed(2)} (full amount)
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="px-5 py-3 backdrop-blur-md bg-white/15 border-t border-white/20 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">You pay now</span>
              <span className={`font-bold text-lg ${isBelowMinimum ? 'text-red-200' : 'text-white'}`}>
                ₱{effectiveAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Remaining at venue</span>
              <span className="font-semibold text-white/90">₱{(total - effectiveAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
