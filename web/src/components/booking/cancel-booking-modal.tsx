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
        booking_id?: string | null
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
    target?: 'reservation' | 'refund_reservation'
}

export function CancelBookingModal({
    booking,
    isOpen,
    onClose,
    onCancelSuccess,
    onRefundSuccess,
    target = 'reservation',
}: CancelBookingModalProps) {
    const [mounted, setMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)

    const isPaid = (booking.status === 'confirmed' || booking.status === 'partially_paid') && booking.amount_paid > 0
    const mode = target === 'refund_reservation' ? 'refund' : 'cancel'
    const requiresReason = mode === 'refund' || (mode === 'cancel' && isPaid)

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
        if (requiresReason && !reason.trim()) {
            setError('Please provide a reason')
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
                // If this is a queue session, use the specialized action
                if ((booking as any).type === 'queue_session' && (booking as any).queue_session_id) {
                    const { cancelQueueSession } = await import('@/app/actions/queue-actions')
                    const result = await cancelQueueSession((booking as any).queue_session_id, reason.trim())
                    
                    if (result.success) {
                        onCancelSuccess()
                        onClose()
                    } else {
                        setError(result.error || 'Failed to cancel queue session')
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
        <div className="fixed inset-0 z-[99999] flex items-end justify-center p-0 sm:items-center sm:p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70"
                onClick={() => {
                    if (!isLoading) onClose()
                }}
            />

            {/* Modal */}
            <div className="relative z-10 w-full h-[100dvh] max-w-none bg-white rounded-none shadow-2xl overflow-hidden flex flex-col sm:w-full sm:h-auto sm:max-w-md sm:max-h-[85dvh] sm:rounded-2xl">
                {/* Header */}
                <div className={`px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between ${mode === 'refund'
                    ? 'bg-gradient-to-r from-primary to-primary/90'
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

                <div className="p-4 sm:p-6 overflow-y-auto">
                    {/* Booking Summary */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 text-sm mb-2">Booking Details</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-gray-500">Court</span>
                                <span className="font-medium text-gray-900 text-right break-words">{booking.courts.name}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-gray-500">Venue</span>
                                <span className="font-medium text-gray-900 text-right break-words">{booking.courts.venues.name}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-gray-500">Date</span>
                                <span className="font-medium text-gray-900 text-right">{format(startDate, 'EEE, MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-gray-500">Time</span>
                                <span className="font-medium text-gray-900 text-right">
                                    {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Refund Info (paid bookings) */}
                    {requiresReason && (
                        <>
                            {isPaid && (
                                <div className="bg-green-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-5 border border-green-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-green-800">Est. Refundable Amount</span>
                                        <span className="text-lg font-bold text-green-900">
                                            ₱{Math.min(booking.amount_paid, booking.total_amount).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-green-700">
                                        Refunds are typically processed within 5-10 business days after admin approval.
                                        <br/>
                                        <span className="opacity-75">{mode === 'refund' && isPaid && "The final amount might differ if this is a bulk payment."}</span>
                                    </p>
                                </div>
                            )}

                            {/* Reason */}
                            <div className="mb-4 sm:mb-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {mode === 'refund' ? 'Reason for Refund' : 'Reason for Cancellation'} <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={mode === 'refund' ? "Please explain why you're requesting a refund..." : 'Please explain why you are cancelling this booking...'}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {/* Cancel Info (unpaid bookings) */}
                    {mode === 'cancel' && (
                        <p className="text-sm text-gray-600 mb-4 sm:mb-5">
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
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full sm:flex-1"
                        >
                            Go Back
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading || (requiresReason && !reason.trim())}
                            className={`w-full sm:flex-1 ${mode === 'refund'
                                ? 'bg-primary hover:bg-primary/90'
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
