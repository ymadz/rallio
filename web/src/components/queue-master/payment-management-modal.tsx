'use client'

import { useState } from 'react'
import { waiveFee, markAsPaid } from '@/app/actions/queue-actions'
import { initiateQueuePaymentAction } from '@/app/actions/payments'
import { X, DollarSign, CreditCard, Loader2, CheckCircle, AlertCircle, QrCode } from 'lucide-react'

type PaymentMethod = 'gcash' | 'paymaya'

interface PaymentManagementModalProps {
  isOpen: boolean
  onClose: () => void
  participant: {
    id: string
    userId: string
    playerName: string
    avatarUrl?: string
    gamesPlayed: number
    amountOwed: number
    paymentStatus: 'unpaid' | 'partial' | 'paid'
  }
  sessionId: string
  costPerGame: number
  onSuccess?: () => void
}

export function PaymentManagementModal({
  isOpen,
  onClose,
  participant,
  sessionId,
  costPerGame,
  onSuccess,
}: PaymentManagementModalProps) {
  const [action, setAction] = useState<'mark-paid' | 'waive' | 'qr-code' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('gcash')
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null)

  if (!isOpen) return null

  const handleMarkPaid = async () => {
    console.log('💵 [PaymentModal] Mark as paid clicked for participant:', participant.id)
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await markAsPaid(participant.id)

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark as paid')
      }

      console.log('✅ [PaymentModal] Mark as paid successful')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('❌ [PaymentModal] Mark as paid error:', err)
      setError(err.message || 'Failed to mark as paid')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWaiveFee = async () => {
    console.log('💸 [PaymentModal] Waive fee clicked for participant:', participant.id)
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await waiveFee(participant.id, 'Waived by Queue Master')

      if (!result.success) {
        throw new Error(result.error || 'Failed to waive fee')
      }

      console.log('✅ [PaymentModal] Waive fee successful')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('❌ [PaymentModal] Waive fee error:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateQR = async () => {
    console.log('🔐 [PaymentModal] Generate QR clicked:', {
      participantId: participant.id,
      userId: participant.userId,
      sessionId,
      paymentMethod: selectedPaymentMethod,
      amountOwed: participant.amountOwed,
    })

    setIsSubmitting(true)
    setError(null)
    setPaymentSuccess(null)

    try {
      // Call the queue payment action (with userId for Queue Master)
      const result = await initiateQueuePaymentAction(sessionId, selectedPaymentMethod, participant.userId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate payment QR code')
      }

      console.log('✅ [PaymentModal] QR code generated successfully:', {
        checkoutUrl: result.checkoutUrl,
        paymentId: result.paymentId,
      })

      // Open checkout URL in new tab
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank')
        setPaymentSuccess('Payment QR code opened in new tab. Player can scan to pay.')
      }
    } catch (err: any) {
      console.error('❌ [PaymentModal] QR generation error:', err)
      setError(err.message || 'Failed to generate QR code')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700 border-green-200'
      case 'partial': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'unpaid': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Payment Management</h2>
                <p className="text-white/80 text-sm">{participant.playerName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {paymentSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{paymentSuccess}</span>
            </div>
          )}

          {/* Player Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              {participant.avatarUrl ? (
                <img
                  src={participant.avatarUrl}
                  alt={participant.playerName}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {participant.playerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{participant.playerName}</h3>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(participant.paymentStatus)} capitalize`}>
                  {participant.paymentStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-500 mb-1">Games Played</p>
                <p className="text-lg font-bold text-gray-900">{participant.gamesPlayed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Amount Owed</p>
                <p className="text-lg font-bold text-gray-900">₱{participant.amountOwed.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                {participant.gamesPlayed} games × ₱{costPerGame} per game
              </p>
            </div>
          </div>

          {/* Payment Method Selection for QR Code */}
          {action === 'qr-code' && !paymentSuccess && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-3">Select Payment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedPaymentMethod('gcash')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'gcash'
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-primary/30'
                    }`}
                  >
                    <div className="text-center">
                      <CreditCard className="w-6 h-6 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-medium text-gray-900">GCash</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('paymaya')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'paymaya'
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-primary/30'
                    }`}
                  >
                    <div className="text-center">
                      <CreditCard className="w-6 h-6 mx-auto mb-1 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">Maya</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Generate a <strong>{selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'}</strong> payment QR code for{' '}
                  <strong>₱{participant.amountOwed.toLocaleString()}</strong>?
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Payment link will open in a new tab and can be shared with the player.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setAction(null)
                    setError(null)
                    setPaymentSuccess(null)
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerateQR}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      Generate QR Code
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Payment Actions */}
          {!action && (
            <div className="space-y-3">
              <button
                onClick={() => setAction('qr-code')}
                disabled={participant.paymentStatus === 'paid'}
                className="w-full flex items-center gap-3 p-4 border-2 border-primary/30 rounded-xl hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Generate Payment QR</p>
                  <p className="text-sm text-gray-600">GCash or Maya payment link</p>
                </div>
              </button>

              <button
                onClick={() => setAction('mark-paid')}
                disabled={participant.paymentStatus === 'paid'}
                className="w-full flex items-center gap-3 p-4 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Mark as Paid</p>
                  <p className="text-sm text-gray-600">Player paid in cash</p>
                </div>
              </button>

              <button
                onClick={() => setAction('waive')}
                disabled={participant.paymentStatus === 'paid'}
                className="w-full flex items-center gap-3 p-4 border-2 border-orange-200 rounded-xl hover:bg-orange-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Waive Payment</p>
                  <p className="text-sm text-gray-600">Forgive the amount owed</p>
                </div>
              </button>
            </div>
          )}

          {/* Confirmation for Mark Paid */}
          {action === 'mark-paid' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Confirm that <strong>{participant.playerName}</strong> has paid <strong>₱{participant.amountOwed.toLocaleString()}</strong> in cash?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation for Waive */}
          {action === 'waive' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  Waive <strong>₱{participant.amountOwed.toLocaleString()}</strong> for <strong>{participant.playerName}</strong>?
                </p>
                <p className="text-xs text-gray-600">
                  This action cannot be undone. The amount will be marked as paid with a $0 charge.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleWaiveFee}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Waive'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close Button */}
          {!action && (
            <button
              onClick={onClose}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
