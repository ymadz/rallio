'use client'

import { useCheckoutStore } from '@/stores/checkout-store'

export function PaymentMethodSelector() {
  const { 
    paymentMethod, 
    setPaymentMethod, 
    isDownPayment, 
    setIsDownPayment, 
    customDownPaymentAmount, 
    setCustomDownPaymentAmount,
    bookingData,
    getTotalAmount 
  } = useCheckoutStore()

  const allowDownPayment = bookingData?.allowDownPayment || false;
  const minimumDownPayment = bookingData?.minimumDownPayment || 0;
  const totalAmount = getTotalAmount();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCustomDownPaymentAmount(isNaN(val) ? 0 : val);
  };

  const handleAmountBlur = () => {
    let amount = customDownPaymentAmount || 0;
    if (amount < minimumDownPayment) amount = minimumDownPayment;
    if (amount > totalAmount) amount = totalAmount;
    setCustomDownPaymentAmount(amount);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Header row: title + down payment toggle */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-lg">Select Payment Method</h3>

          {allowDownPayment && !bookingData?.isQueueSession && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-sm font-medium text-gray-700">Down Payment</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isDownPayment}
                  onChange={(e) => setIsDownPayment(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          )}
        </div>

        {/* Down Payment Amount Input (appears when toggled on) */}
        {isDownPayment && allowDownPayment && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment Amount (₱)</label>
              <p className="text-xs text-gray-500 mb-2">Minimum required: ₱{minimumDownPayment.toLocaleString()}</p>
              <input
                type="number"
                min={minimumDownPayment}
                max={totalAmount}
                step="10"
                value={customDownPaymentAmount || ''}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                placeholder={`Min ₱${minimumDownPayment}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-medium bg-white"
              />
            </div>

          </div>
        )}

        {/* Payment Method Cards */}
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
              Pay in cash. Booking will be pending until payment is verified.
            </p>

            {paymentMethod === 'cash' && (
              <div className="mt-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-green-600">Selected</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
