'use client'

import { format, differenceInHours } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { BookingReviewButton } from '@/components/venue/booking-review-button'
import { RefundRequestButton } from '@/components/reservations/refund-request-button'

// Redefining interface to avoid circular deps or complex exports for now
export interface Booking {
    id: string
    start_time: string
    end_time: string
    status: string
    total_amount: number
    amount_paid: number
    num_players: number
    payment_type: string
    notes?: string
    created_at: string
    courts: {
        id: string
        name: string
        hourly_rate: number
        venues: {
            id: string
            name: string
            address?: string
            city: string
        }
    }
    payments: Array<{
        id: string
        status: string
        payment_method: string
        amount: number
    }>
    recurrence_group_id?: string | null
    metadata?: {
        recurrence_total?: number
        recurrence_index?: number
        [key: string]: any
    }
}

interface BookingCardProps {
    booking: Booking
    serverDate: Date | null
    cancellingId: string | null
    resumingPaymentId: string | null
    onCancelBooking: (booking: Booking) => void
    onResumePayment: (booking: Booking) => void
    onReschedule: (booking: Booking) => void
    setBookings: React.Dispatch<React.SetStateAction<Booking[]>>
}

export function BookingCard({
    booking,
    serverDate,
    cancellingId,
    resumingPaymentId,
    onCancelBooking,
    onResumePayment,
    onReschedule,
    setBookings
}: BookingCardProps) {
    const activeStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']
    const startDate = new Date(booking.start_time)
    const endDate = new Date(booking.end_time)

    // -- Helper Logic --

    const isCashBooking = (b: Booking): boolean => {
        return b.metadata?.intended_payment_method === 'cash' ||
            b.metadata?.payment_method === 'cash' ||
            b.payments?.[0]?.payment_method === 'cash'
    }

    const getPaymentStatus = (b: Booking) => {
        const isFullyPaid = b.amount_paid >= b.total_amount

        if (b.status === 'paid' || (b.status === 'confirmed' && isFullyPaid)) {
            return { label: 'Paid', color: 'green', needsPayment: false }
        }
        if (b.status === 'confirmed' && !isFullyPaid) {
            return { label: 'Pay at Venue', color: 'orange', needsPayment: false }
        }
        if (isCashBooking(b) && b.status === 'pending_payment') {
            return { label: 'Pay at Venue', color: 'blue', needsPayment: false }
        }
        const payment = b.payments?.[0]
        if (!payment) return { label: 'Payment Pending', color: 'yellow', needsPayment: true }

        switch (payment.status) {
            case 'completed':
                return { label: 'Paid', color: 'green', needsPayment: false }
            case 'pending':
                return { label: 'Payment Pending', color: 'yellow', needsPayment: true }
            case 'failed':
                return { label: 'Payment Failed', color: 'red', needsPayment: true }
            default:
                return { label: payment.status, color: 'gray', needsPayment: false }
        }
    }

    const getExtendedPaymentStatus = (b: Booking) => {
        if (b.status === 'pending_refund') {
            return { label: 'Refund Pending', color: 'orange', needsPayment: false }
        }
        if (b.status === 'refunded') {
            return { label: 'Refunded', color: 'gray', needsPayment: false }
        }
        return getPaymentStatus(b)
    }

    const canCancelBooking = (b: Booking): boolean => {
        const startTime = new Date(b.start_time)
        const now = serverDate || new Date()
        const hoursUntilStart = differenceInHours(startTime, now)
        return activeStatuses.includes(b.status) && hoursUntilStart > 24
    }

    const getTimeRemaining = (startTime: string, endTime?: string, isOngoing?: boolean) => {
        const now = serverDate || new Date()
        if (isOngoing && endTime) {
            const hours = differenceInHours(new Date(endTime), now)
            if (hours < 1) {
                const minutes = Math.floor((new Date(endTime).getTime() - now.getTime()) / (1000 * 60))
                return `${Math.max(0, minutes)}m remaining`
            }
            if (hours < 24) return `${hours}h remaining`
            const days = Math.floor(hours / 24)
            return `${days} day${days > 1 ? 's' : ''}`
        }
        const hours = differenceInHours(new Date(startTime), now)
        if (hours < 24) return `${hours}h remaining`
        const days = Math.floor(hours / 24)
        return `${days} day${days > 1 ? 's' : ''}`
    }

    const bookingStatusBadge = (status: string, b: Booking) => {
        const styles: Record<string, string> = {
            reserved: 'bg-blue-500 text-white',
            pending_payment: 'bg-amber-500 text-white',
            pending: 'bg-amber-500 text-white',
            paid: 'bg-primary text-white',
            confirmed: 'bg-emerald-600 text-white',
            ongoing: 'bg-green-500 text-white animate-pulse',
            cancelled: 'bg-red-600 text-white',
            pending_refund: 'bg-amber-600 text-white',
            refunded: 'bg-gray-500 text-white',
            completed: 'bg-primary text-white',
            no_show: 'bg-gray-700 text-white',
        }

        let displayStatus = status
        let displayLabel = ''

        if (status === 'pending_payment') {
            const paymentMethod = b.metadata?.intended_payment_method || b.payments?.[0]?.payment_method
            if (paymentMethod === 'cash') {
                displayStatus = 'reserved'
                displayLabel = 'Reserved'
            } else {
                displayLabel = 'Pending Payment'
            }
        } else if (status === 'ongoing') {
            displayLabel = 'Ongoing'
        } else {
            displayLabel = status
                .split('_')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ')
        }

        return (
            <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${styles[displayStatus] || 'bg-gray-500 text-white'
                    }`}
            >
                {displayLabel}
            </span>
        )
    }

    const paymentStatus = getExtendedPaymentStatus(booking)

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Image Header */}
            <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
                <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                    {bookingStatusBadge(booking.status, booking)}
                    {booking.metadata?.weeks_total && booking.metadata.weeks_total > 1 && (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Week {(booking.metadata.week_index ?? 0) + 1}/{booking.metadata.weeks_total}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-6 pt-6 pb-4">
                {/* Venue & Court */}
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {booking.courts.name}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {booking.courts.venues.name}
                    </p>
                </div>

                {/* Date & Time */}
                <div className="bg-primary/5 rounded-lg p-4 mb-4 border border-primary/20">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs text-primary font-medium mb-1">Date</p>
                            <p className="text-lg font-bold text-gray-900">
                                {format(startDate, 'EEE, MMM d, yyyy')}
                            </p>
                        </div>
                        <div className="h-12 w-px bg-primary/20" />
                        <div className="flex-1 text-right">
                            <p className="text-xs text-primary font-medium mb-1">Time</p>
                            <p className="text-lg font-bold text-gray-900">
                                {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                        <p className="text-gray-500 mb-1">Players</p>
                        <p className="font-semibold text-gray-900">{booking.num_players || 1} player{(booking.num_players || 1) > 1 ? 's' : ''}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Payment</p>
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold shadow-sm text-white ${paymentStatus.color === 'green' ? 'bg-green-500' :
                            paymentStatus.color === 'yellow' ? 'bg-yellow-500' :
                                paymentStatus.color === 'blue' ? 'bg-blue-500' :
                                    paymentStatus.color === 'orange' ? 'bg-orange-500' :
                                        'bg-red-500'
                            }`}>
                            {paymentStatus.label}
                        </span>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Amount</p>
                        <p className="font-bold text-gray-900">₱{booking.total_amount.toFixed(2)}</p>
                        {(booking.metadata?.recurrence_total && booking.metadata.recurrence_total > 1) && (
                            <p className="text-xs text-gray-400 mt-0.5">per session</p>
                        )}
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Time Until</p>
                        <p className="font-semibold text-primary">{getTimeRemaining(booking.start_time)}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                    <BookingReviewButton
                        courtId={booking.courts.id}
                        courtName={booking.courts.name}
                        venueName={booking.courts.venues.name}
                        venueId={booking.courts.venues.id}
                        bookingDate={booking.start_time}
                        bookingStatus={booking.status}
                    />

                    {['paid', 'confirmed'].includes(booking.status) && booking.amount_paid > 0 && (
                        <RefundRequestButton
                            reservationId={booking.id}
                            status={booking.status}
                            amountPaid={booking.amount_paid * 100}
                            totalAmount={booking.total_amount * 100}
                            startTime={booking.start_time}
                            onRefundRequested={() => {
                                setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: 'pending_refund' } : b))
                            }}
                        />
                    )}

                    {booking.status === 'pending_refund' && (
                        <div className="w-full p-2 bg-orange-50 border border-orange-200 rounded-md text-center text-sm text-orange-700 font-medium">
                            Refund Request Pending Approval
                        </div>
                    )}

                    {paymentStatus.needsPayment && !isCashBooking(booking) && (
                        <Button
                            className="w-full bg-primary hover:bg-primary/90"
                            size="sm"
                            onClick={() => onResumePayment(booking)}
                            disabled={resumingPaymentId === booking.id}
                        >
                            {resumingPaymentId === booking.id ? (
                                <>
                                    <Spinner className="w-4 h-4 mr-2" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Continue Payment
                                </>
                            )}
                        </Button>
                    )}

                    <div className="flex gap-4 pt-2">
                        <Link href={`/courts/${booking.courts.venues.id}`} className="flex-1">
                            <Button variant="outline" className="w-full h-10 border-gray-300 hover:bg-gray-50 hover:text-primary hover:border-primary/50 transition-colors" size="sm">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Court
                            </Button>
                        </Link>

                        <Link href={`/bookings/${booking.id}/receipt`} className="flex-1">
                            <Button variant="outline" className="w-full h-10 border-gray-300 hover:bg-gray-50 hover:text-primary hover:border-primary/50 transition-colors" size="sm">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                View Receipt
                            </Button>
                        </Link>

                        {canCancelBooking(booking) && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onReschedule(booking)}
                                    className="flex-1 h-10 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Reschedule
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onCancelBooking(booking)}
                                    disabled={cancellingId === booking.id}
                                    className="flex-1 h-10 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
                                >
                                    {cancellingId === booking.id ? (
                                        <>
                                            <Spinner className="w-4 h-4 mr-2" />
                                            Please wait...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Cancel
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                    {canCancelBooking(booking) && (
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            Free rescheduling/cancellation available up to 24 hours before booking.
                        </p>
                    )}
                </div>

                {!canCancelBooking(booking) && booking.status !== 'cancelled' && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        Cannot cancel or reschedule within 24 hours of booking
                    </p>
                )}
            </div>
        </Card>
    )
}
