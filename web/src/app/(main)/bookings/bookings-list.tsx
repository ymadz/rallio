'use client'

import { useState } from 'react'
import { format, differenceInHours, isPast, isFuture } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cancelReservationAction } from '@/app/actions/reservations'
import { BookingReviewButton } from '@/components/venue/booking-review-button'
import { RefundRequestButton } from '@/components/reservations/refund-request-button'
import Link from 'next/link'
import Image from 'next/image'

interface Booking {
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

interface BookingsListProps {
  initialBookings: Booking[]
}

export function BookingsList({ initialBookings }: BookingsListProps) {
  const [bookings, setBookings] = useState(initialBookings)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')

  const activeStatuses = ['pending_payment', 'pending', 'paid', 'confirmed']

  const handleResumePayment = async (booking: Booking) => {
    setResumingPaymentId(booking.id)

    try {
      const { initiatePaymentAction } = await import('@/app/actions/payments')
      const result = await initiatePaymentAction(booking.id, 'gcash')

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        alert(result.error || 'Failed to initiate payment. Please try again.')
        setResumingPaymentId(null)
      }
    } catch (error) {
      console.error('Error resuming payment:', error)
      alert('Failed to initiate payment. Please try again.')
      setResumingPaymentId(null)
    }
  }

  const handleCancelBooking = async (booking: Booking) => {
    const isPaid = ['paid', 'confirmed'].includes(booking.status) && booking.amount_paid > 0
    const hoursUntilStart = (new Date(booking.start_time).getTime() - Date.now()) / (1000 * 60 * 60)
    const isWithin24Hours = hoursUntilStart < 24

    // Different confirmation messages based on status
    let confirmMessage = 'Are you sure you want to cancel this booking?'
    if (isPaid && !isWithin24Hours) {
      confirmMessage = 'This booking is paid. Cancelling will automatically request a refund. Continue?'
    } else if (isPaid && isWithin24Hours) {
      confirmMessage = 'Warning: Refunds are not available within 24 hours of booking time. Cancel anyway?'
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setCancellingId(booking.id)

    try {
      // If paid and eligible for refund, request refund first
      if (isPaid && !isWithin24Hours) {
        const { requestRefundAction } = await import('@/app/actions/refund-actions')
        const refundResult = await requestRefundAction({
          reservationId: booking.id,
          reason: 'Cancelled by user',
          reasonCode: 'requested_by_customer'
        })

        if (refundResult.success) {
          // Refund requested successfully! Status is now pending_refund.
          setBookings(prev => prev.map(b =>
            b.id === booking.id ? { ...b, status: 'pending_refund' } : b
          ))
          setCancellingId(null)
          return
        } else {
          console.warn('Refund request failed:', refundResult.error)
          // If refund fails, we might still want to cancel? 
          // Or alert user? Let's alert.
          alert(`Refund request failed: ${refundResult.error || 'Unknown error'}.`)
        }
      }

      // Cancel the booking (if not refunding or if refund failed but we proceed? No, stop if refund intent failed usually)
      if (isPaid && !isWithin24Hours) {
        // If we are here, refund action was attempted but logic above `return`ed if success.
        // If failed, we probably stopped or continued? 
        // Let's assume if refund failed components didn't return, we try to cancel reservation anyway?
        // No, if refund failed, we should probably stop.
        setCancellingId(null)
        return
      }

      const result = await cancelReservationAction(booking.id)

      if (result.success) {
        setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      } else {
        alert(result.error || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      alert('Failed to cancel booking. Please try again.')
    }

    setCancellingId(null)
  }

  const getPaymentStatus = (booking: Booking) => {
    // Check if fully paid
    const isFullyPaid = booking.amount_paid >= booking.total_amount

    // If booking is marked as 'paid' or is 'confirmed' with full payment
    if (booking.status === 'paid' || (booking.status === 'confirmed' && isFullyPaid)) {
      return { label: 'Paid', color: 'green', needsPayment: false }
    }

    // If confirmed but not fully paid (e.g. Cash at Venue)
    if (booking.status === 'confirmed' && !isFullyPaid) {
      return { label: 'Pay at Venue', color: 'orange', needsPayment: false }
    }

    // Check payment records for digital attempts
    const payment = booking.payments?.[0]
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

  // Update getPaymentStatus to handle pending_refund
  const getExtendedPaymentStatus = (booking: Booking) => {
    if (booking.status === 'pending_refund') {
      return { label: 'Refund Pending', color: 'orange', needsPayment: false }
    }
    if (booking.status === 'refunded') {
      return { label: 'Refunded', color: 'gray', needsPayment: false }
    }
    return getPaymentStatus(booking)
  }

  const canCancelBooking = (booking: Booking): boolean => {
    const startTime = new Date(booking.start_time)
    const hoursUntilStart = differenceInHours(startTime, new Date())
    return activeStatuses.includes(booking.status) && hoursUntilStart > 24
  }

  const getTimeRemaining = (startTime: string) => {
    const hours = differenceInHours(new Date(startTime), new Date())
    if (hours < 24) return `${hours}h remaining`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }

  const filteredBookings = bookings.filter((booking) => {
    const startTime = new Date(booking.start_time)
    const now = new Date()

    if (activeTab === 'upcoming') {
      // Upcoming: Future ACTIVE bookings
      if (!activeStatuses.includes(booking.status)) return false
      if (startTime < now) return false // Past bookings go to history

      if (filter === 'today') {
        return format(startTime, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
      }
      if (filter === 'week') {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        return startTime <= weekFromNow
      }
      return true
    } else {
      // History: Past or Cancelled/Refunded
      const isHistoryStatus = ['cancelled', 'refunded', 'pending_refund', 'completed', 'no_show'].includes(booking.status)
      const isPastActive = activeStatuses.includes(booking.status) && startTime < now
      return isHistoryStatus || isPastActive
    }
  })

  // Sort Bookings
  filteredBookings.sort((a, b) => {
    const timeA = new Date(a.start_time).getTime()
    const timeB = new Date(b.start_time).getTime()
    return activeTab === 'upcoming' ? timeA - timeB : timeB - timeA
  })

  const bookingStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_payment: 'bg-amber-500 text-white',
      pending: 'bg-amber-500 text-white',
      paid: 'bg-primary text-white',
      confirmed: 'bg-emerald-600 text-white',
      cancelled: 'bg-red-600 text-white',
      pending_refund: 'bg-amber-600 text-white',
      refunded: 'bg-gray-500 text-white',
      completed: 'bg-primary text-white',
      no_show: 'bg-gray-700 text-white',
    }

    const readable = status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

    return (
      <span
        className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${styles[status] || 'bg-gray-500 text-white'
          }`}
      >
        {readable}
      </span>
    )
  }

  const totalConfirmed = bookings.filter((b) => ['paid', 'confirmed'].includes(b.status)).length
  const awaitingPayment = bookings.filter((b) => {
    const isFullyPaid = b.amount_paid >= b.total_amount
    return ['pending_payment', 'pending'].includes(b.status) || (b.status === 'confirmed' && !isFullyPaid)
  }).length

  return (
    <div>
      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${activeTab === 'upcoming'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${activeTab === 'history'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          History & Refunds
        </button>
      </div>

      {/* Filter Tabs (Only for Upcoming) */}
      {activeTab === 'upcoming' && (
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          {[
            { value: 'all', label: 'All Upcoming' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${filter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-primary font-medium">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{bookings.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-amber-700 font-medium">Awaiting Payment</p>
              <p className="text-2xl font-bold text-amber-900">{awaitingPayment}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-medium">Confirmed / Paid</p>
              <p className="text-2xl font-bold text-emerald-900">{totalConfirmed}</p>
            </div>
          </div>
        </Card>
      </div>
      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming bookings</h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'upcoming'
                ? (filter === 'all'
                  ? "You don't have any upcoming bookings. Find a court and make your first reservation!"
                  : `No bookings ${filter === 'today' ? 'today' : 'this week'}.`)
                : "You don't have any booking history yet."}
            </p>
            <Link href="/courts">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find Courts
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBookings.map((booking) => {
            const startDate = new Date(booking.start_time)
            const endDate = new Date(booking.end_time)
            const paymentStatus = getExtendedPaymentStatus(booking)

            return (
              <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image Header */}
                <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    {bookingStatusBadge(booking.status)}
                    {/* Show badge for recurring bookings */}
                    {booking.metadata?.recurrence_total && booking.metadata.recurrence_total > 1 && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {/* Only show "Week X/Y" if there are multiple weeks */}
                        {booking.metadata.weeks_total && booking.metadata.weeks_total > 1 ? (
                          <>Week {(booking.metadata.week_index ?? 0) + 1}/{booking.metadata.weeks_total}</>
                        ) : (
                          // For same-week multi-day, just show session index
                          <>Session {(booking.metadata.recurrence_index ?? 0) + 1}/{booking.metadata.recurrence_total}</>
                        )}
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

                  {/* Date & Time - Prominent */}
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
                          'bg-red-500'
                        }`}>
                        {paymentStatus.label}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Amount</p>
                      <p className="font-bold text-gray-900">₱{booking.total_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Time Until</p>
                      <p className="font-semibold text-primary">{getTimeRemaining(booking.start_time)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                    {/* Review Button for Past Confirmed Bookings */}
                    <BookingReviewButton
                      courtId={booking.courts.id}
                      courtName={booking.courts.name}
                      venueName={booking.courts.venues.name}
                      venueId={booking.courts.venues.id}
                      bookingDate={booking.start_time}
                      bookingStatus={booking.status}
                    />

                    {/* Refund Button for Paid/Confirmed Bookings */}
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

                    {/* Status Message for Pending Refund */}
                    {booking.status === 'pending_refund' && (
                      <div className="w-full p-2 bg-orange-50 border border-orange-200 rounded-md text-center text-sm text-orange-700 font-medium">
                        Refund Request Pending Approval
                      </div>
                    )}

                    {/* Continue Payment Button for Pending Payments */}
                    {paymentStatus.needsPayment && (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90"
                        size="sm"
                        onClick={() => handleResumePayment(booking)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(booking)}
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
                      )}
                    </div>
                    {canCancelBooking(booking) && (
                      <p className="text-[10px] text-gray-400 mt-2 text-center">
                        Free cancellation/refund available up to 24 hours before booking.
                      </p>
                    )}
                  </div>

                  {!canCancelBooking(booking) && booking.status !== 'cancelled' && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Cannot cancel within 24 hours of booking
                    </p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
