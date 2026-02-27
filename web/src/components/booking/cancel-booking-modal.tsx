'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, X } from 'lucide-react'

export interface CancelBookingModalProps {
    booking: {
        id: string
        start_time: string
        end_time: string
        total_amount: number
        amount_paid: number
        status: string
        courts: {
            name: string
            venues: {
                name: string
            }
        }
    }
    isOpen: boolean
    onClose: () => void
    onCancelSuccess: () => void
    onRefundSuccess: () => void
}

export function CancelBookingModal({
    booking,
    isOpen,
    onClose,
    onCancelSuccess,
    onRefundSuccess,
}: CancelBookingModalProps) {
    const [mounted, setMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)

    const isPaid = booking.status === 'confirmed' && booking.amount_paid > 0
    const mode = isPaid ? 'refund' : 'cancel'

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setReason('')
            setError(null)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        if (mode === 'refund' && !reason.trim()) {
            setError('Please provide a reason for the refund')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            if (mode === 'refund') {
                const { requestRefundAction } = await import('@/app/actions/refund-actions')
                const result = await requestRefundAction({
                    reservationId: booking.id,
                    reason: reason.trim(),
                    reasonCode: 'requested_by_customer',
                })

                if (result.success) {
                    onRefundSuccess()
                    onClose()
                } else {
                    setError(result.error || 'Failed to submit refund request')
                }
            } else {
                const { cancelReservationAction } = await import('@/app/actions/reservations')
                const result = await cancelReservationAction(booking.id)

                if (result.success) {
                    onCancelSuccess()
                    onClose()
                } else {
                    setError(result.error || 'Failed to cancel booking')
                }
            }
        } catch (err) {
            console.error('Error:', err)
            setError('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    if (!mounted || !isOpen) return null

    const startDate = new Date(booking.start_time)
    const endDate = new Date(booking.end_time)

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70"
                onClick={() => {
                    if (!isLoading) onClose()
                }}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${mode === 'refund'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                        : 'bg-gradient-to-r from-red-500 to-red-600'
                    } text-white`}>
                    <h3 className="text-lg font-bold">
                        {mode === 'refund' ? 'Request Refund' : 'Cancel Booking'}
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Booking Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 text-sm mb-2">Booking Details</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Court</span>
                                <span className="font-medium text-gray-900">{booking.courts.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Venue</span>
                                <span className="font-medium text-gray-900">{booking.courts.venues.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Date</span>
                                <span className="font-medium text-gray-900">{format(startDate, 'EEE, MMM d, yyyy')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Time</span>
                                <span className="font-medium text-gray-900">
                                    {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Refund Info (paid bookings) */}
                    {mode === 'refund' && (
                        <>
                            <div className="bg-orange-50 rounded-lg p-4 mb-5 border border-orange-200">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm text-orange-800">Refund Amount</span>
                                    <span className="text-lg font-bold text-orange-900">
                                        ₱{booking.amount_paid.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-xs text-orange-600">
                                    Refunds are typically processed within 5-10 business days after admin approval.
                                </p>
                            </div>

                            {/* Reason */}
                            <div className="mb-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason for Refund <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Please explain why you're requesting a refund..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {/* Cancel Info (unpaid bookings) */}
                    {mode === 'cancel' && (
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to cancel this booking? This action cannot be undone.
                        </p>
                    )}

                    {/* Error */}
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
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            Go Back
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading || (mode === 'refund' && !reason.trim())}
                            className={`flex-1 ${mode === 'refund'
                                    ? 'bg-orange-600 hover:bg-orange-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner size="sm" className="mr-2" />
                                    Processing...
                                </>
                            ) : mode === 'refund' ? (
                                'Submit Refund Request'
                            ) : (
                                'Cancel Booking'
                            )}
                        </Button>
                    </div>

                    {/* Policy link */}
                    {mode === 'refund' && (
                        <p className="text-xs text-gray-500 mt-4 text-center">
                            By requesting a refund, you agree to our{' '}
                            <a href="/refund-policy" className="text-primary hover:underline">
                                refund policy
                            </a>.
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
