'use client'

import { useCheckoutStore } from '@/stores/checkout-store'

export function PaymentMethodSelector() {
  const { paymentMethod, setPaymentMethod } = useCheckoutStore()

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 text-lg">Select Payment Method</h3>

      <div className="grid md:grid-cols-2 gap-4">
        {/* E-Wallet Option */}
        <button
          onClick={() => setPaymentMethod('e-wallet')}
          className={`
            relative border-2 rounded-xl p-6 text-left transition-all
            ${
              paymentMethod === 'e-wallet'
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
            ${
              paymentMethod === 'cash'
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
            Pay in cash at the venue. Booking will be pending until payment is verified.
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
    </div>
  )
}
