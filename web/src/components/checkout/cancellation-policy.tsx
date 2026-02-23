'use client'

import { useState } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'

export function CancellationPolicy() {
  const { paymentMethod, policyAccepted, setPolicyAccepted } = useCheckoutStore()
  const activeTab = paymentMethod || 'e-wallet'

  const eWalletPolicy = [
    'You can cancel your booking anytime.',
    'Refunds are only available within 7 days after full payment.',
    'After 7 days, no refund will be issued.',
    'For partial payments, only the amount paid will be refunded.',
    "If the court manager cancels your booking, you'll receive a full refund regardless of the 7-day limit.",
  ]

  const cashPolicy = [
    'You can cancel your booking anytime before the scheduled time.',
    'Refunds are only available within 7 days after full payment.',
    'After 7 days, no refund will be issued.',
    'For partial payments, only the amount paid will be refunded.',
    "If the court manager cancels your booking, you'll receive a full refund regardless of the 7-day limit.",
    'Cash refunds must be collected in person at the venue.',
  ]

  const policy = activeTab === 'e-wallet' ? eWalletPolicy : cashPolicy

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 text-lg">Cancellation Policy</h3>
      <p className="text-sm text-gray-600">
        Guidelines on booking cancellations, refunds, and applicable fees.
      </p>

      {/* Tabs Removed */}

      {/* Policy Content */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <ul className="space-y-3">
          {policy.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
              <span className="text-sm text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={policyAccepted}
            onChange={(e) => setPolicyAccepted(e.target.checked)}
            className="
              h-5 w-5 rounded border-2 border-gray-300 text-primary
              focus:ring-2 focus:ring-primary focus:ring-offset-2
              cursor-pointer
            "
          />
        </div>
        <span className="text-sm text-gray-700 group-hover:text-gray-900">
          I have read the Cancellation Policy for{' '}
          <span className="font-medium">
            {activeTab === 'e-wallet' ? 'E-wallet' : 'Cash'} Payment
          </span>
        </span>
      </label>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <svg
          className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-blue-800">
          This provides a clear refund flow and fairness for both sides while automating deductions via
          the {activeTab === 'e-wallet' ? 'e-wallet' : 'cash'} system.
        </p>
      </div>
    </div>
  )
}
