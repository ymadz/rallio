'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { requestRefundAction, getRefundStatusAction } from '@/app/actions/refund-actions'
import { RefreshCw, AlertCircle, CheckCircle2, Undo2 } from 'lucide-react'

interface RefundRequestButtonProps {
  reservationId: string
  status: string
  amountPaid: number
  totalAmount: number
  startTime: string // ISO date string for the booking start time
  onRefundRequested?: () => void
}

export function RefundRequestButton({
  reservationId,
  status,
  amountPaid,
  totalAmount,
  startTime,
  onRefundRequested,
}: RefundRequestButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [refundStatus, setRefundStatus] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  // Wait for client-side mount before rendering portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Only show refund button for paid/confirmed reservations with amount paid
  const isPaidOrConfirmed = status === 'confirmed' && amountPaid > 0

  // Check 24-hour policy: cannot refund within 24 hours of booking start time
  const hoursUntilStart = (new Date(startTime).getTime() - Date.now()) / (1000 * 60 * 60)
  const isWithin24Hours = hoursUntilStart < 24

  const canRequestRefund = isPaidOrConfirmed && !isWithin24Hours

  // Don't render anything if not paid/confirmed or no amount paid
  if (!isPaidOrConfirmed) {
    return null
  }

  const handleCheckStatus = async () => {
    setIsLoading(true)
    setError(null)

    const result = await getRefundStatusAction(reservationId)

    if (result.success) {
      setRefundStatus(result)
    } else {
      setError(result.error || 'Failed to check refund status')
    }

    setIsLoading(false)
  }

  const handleRequestRefund = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the refund')
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await requestRefundAction({
      reservationId,
      reason: reason.trim(),
      reasonCode: 'requested_by_customer',
    })

    if (result.success) {
      setSuccess(true)
      onRefundRequested?.()
    } else {
      setError(result.error || 'Failed to submit refund request')
    }

    setIsLoading(false)
  }

  // Check if there's already a pending refund
  if (refundStatus?.refunds?.some((r: any) => ['pending', 'processing'].includes(r.status))) {
    return (
      <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-md flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Refund Processing
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-md flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Refund Requested
      </div>
    )
  }

  // Show disabled state if within 24 hours
  if (isWithin24Hours) {
    return (
      <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md flex items-center gap-2">
        <Undo2 className="w-4 h-4" />
        Cannot refund within 24 hours of booking
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={!canRequestRefund}
        className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
      >
        <Undo2 className="w-4 h-4 mr-2" />
        Request Refund
      </Button>

      {/* Render modal in portal to escape stacking context issues */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop - cover everything including navbar */}
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => {
              setIsOpen(false)
              setError(null)
              setReason('')
            }}
          />

          {/* Modal Content - positioned above backdrop */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
            <h4 className="font-semibold text-gray-900 text-lg mb-4">Request Refund</h4>

            {/* Refund Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-semibold text-lg">₱{(amountPaid / 100).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Refunds are typically processed within 5-10 business days.
              </p>
            </div>

            {/* Reason Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Refund
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you're requesting a refund..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                rows={4}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false)
                  setError(null)
                  setReason('')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestRefund}
                disabled={isLoading || !reason.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>

            {/* Refund Policy Link */}
            <p className="text-xs text-gray-500 mt-4 text-center">
              By requesting a refund, you agree to our{' '}
              <a href="/refund-policy" className="text-primary hover:underline">
                refund policy
              </a>
              .
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
