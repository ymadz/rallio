'use client'

import { useState } from 'react'
import { waiveFee, markAsPaid } from '@/app/actions/queue-actions'
import { X, PhilippinePeso, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

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
    position?: number
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
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)
  const [isWaiving, setIsWaiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleMarkPaid = async () => {
    setIsMarkingPaid(true)
    setError(null)
    try {
      const result = await markAsPaid(participant.id)
      if (!result.success) throw new Error(result.error || 'Failed to mark as paid')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to mark as paid')
    } finally {
      setIsMarkingPaid(false)
    }
  }

  const handleWaiveFee = async () => {
    setIsWaiving(true)
    setError(null)
    try {
      const result = await waiveFee(participant.id, 'Waived by Queue Master')
      if (!result.success) throw new Error(result.error || 'Failed to waive fee')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to waive fee')
    } finally {
      setIsWaiving(false)
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

  const isPaid = participant.paymentStatus === 'paid'
  const isProcessing = isMarkingPaid || isWaiving

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-primary text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <PhilippinePeso className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Payment Management</h2>
                <p className="text-white/80 text-sm">{participant.playerName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Player Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-block w-12 h-12 shrink-0">
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt={participant.playerName}
                    className="w-12 h-12 rounded-full border-2 border-primary bg-white object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {participant.playerName.charAt(0).toUpperCase()}
                  </div>
                )}
                {participant.position !== undefined && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                    {participant.position}
                  </div>
                )}
              </div>
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

          {/* Actions */}
          {isPaid ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800">This player has already paid.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleMarkPaid}
                disabled={isProcessing}
                className="flex flex-col items-center gap-2 p-5 border-2 border-green-200 rounded-xl hover:bg-green-50 active:bg-green-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMarkingPaid ? (
                  <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
                ) : (
                  <CheckCircle className="w-7 h-7 text-green-600" />
                )}
                <span className="font-semibold text-gray-900 text-sm">Mark as Paid</span>
                <span className="text-xs text-gray-500 text-center">Player paid in cash</span>
              </button>

              <button
                onClick={handleWaiveFee}
                disabled={isProcessing}
                className="flex flex-col items-center gap-2 p-5 border-2 border-orange-200 rounded-xl hover:bg-orange-50 active:bg-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWaiving ? (
                  <Loader2 className="w-7 h-7 text-orange-600 animate-spin" />
                ) : (
                  <PhilippinePeso className="w-7 h-7 text-orange-600" />
                )}
                <span className="font-semibold text-gray-900 text-sm">Waive Payment</span>
                <span className="text-xs text-gray-500 text-center">Forgive the amount owed</span>
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
