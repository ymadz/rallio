'use client'

import { useState } from 'react'
import { PhilippinePeso, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { initiateQueuePaymentAction } from '@/app/actions/payments'
import { useRouter } from 'next/navigation'

interface PaymentSummaryWidgetProps {
  participantId: string
  amountOwed: number
  gamesPlayed: number
  costPerGame: number
  paymentStatus: 'pending' | 'partial' | 'paid'
  courtId: string
}

export function PaymentSummaryWidget({
  participantId,
  amountOwed,
  gamesPlayed,
  costPerGame,
  paymentStatus,
  courtId,
}: PaymentSummaryWidgetProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'paymaya' | null>(null)

  const handlePayment = async (method: 'gcash' | 'paymaya') => {
    setIsProcessing(true)
    setError(null)
    setSelectedMethod(method)

    try {
      const result = await initiateQueuePaymentAction(participantId, method)

      if (!result.success) {
        setError(result.error || 'Failed to initiate payment')
        return
      }

      // Redirect to payment URL
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed')
    } finally {
      setIsProcessing(false)
      setSelectedMethod(null)
    }
  }

  // Payment status colors
  const statusConfig: Record<string, {
    bg: string
    border: string
    text: string
    icon: any
    label: string
  }> = {
    pending: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Payment Required',
    },
    partial: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: AlertCircle,
      label: 'Partial Payment',
    },
    paid: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'Paid in Full',
    },
  }

  const config = statusConfig[paymentStatus] || statusConfig.pending
  const StatusIcon = config.icon

  if (amountOwed === 0 && paymentStatus === 'paid') {
    return (
      <div className={`${config.bg} border ${config.border} rounded-xl p-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">All Paid Up!</p>
            <p className="text-sm text-gray-600">You're all set. Thanks for playing!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <PhilippinePeso className="w-5 h-5 text-primary" />
          Payment Summary
        </h3>
        <div className={`px-3 py-1 ${config.bg} ${config.border} border rounded-full flex items-center gap-1.5`}>
          <StatusIcon className={`w-3.5 h-3.5 ${config.text}`} />
          <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Games Played</span>
          <span className="font-semibold text-gray-900">{gamesPlayed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Cost per Game</span>
          <span className="font-semibold text-gray-900">₱{costPerGame.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">Amount Owed</span>
            <span className="text-2xl font-bold text-primary">₱{amountOwed.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Buttons */}
      {amountOwed > 0 && paymentStatus !== 'paid' && (
        <>
          <div className="space-y-2">
            <button
              onClick={() => handlePayment('gcash')}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing && selectedMethod === 'gcash' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay with GCash
                </>
              )}
            </button>

            <button
              onClick={() => handlePayment('paymaya')}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing && selectedMethod === 'paymaya' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay with Maya
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              💡 You must pay before leaving the queue
            </p>
          </div>
        </>
      )}
    </div>
  )
}
