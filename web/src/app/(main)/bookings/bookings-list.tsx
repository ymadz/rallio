'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cancelReservationAction } from '@/app/actions/reservations'

import { RescheduleModal } from '@/components/booking/reschedule-modal'
import { useServerTime } from '@/hooks/use-server-time'
import Link from 'next/link'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookingCard, Booking } from './booking-card'

// Booking interface moved to booking-card.tsx

interface BookingsListProps {
  initialBookings: Booking[]
}

export function BookingsList({ initialBookings }: BookingsListProps) {
  const router = useRouter()
  const { date: serverDate } = useServerTime()
  const [bookings, setBookings] = useState(initialBookings)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null)
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all')
  // activeTab state is now managed by the Tabs component, but we can track it if needed for filtering logic separate from rendering
  // checks. However, TabsContent naturally separates rendering. We'll use a local state to sync with Tabs if we need to know the active tab for other logic,
  // but looking at `filteredBookings`, it relies on `activeTab` state.
  // We will keep `activeTab` and sync it with Tabs onValueChange to keep logic simple without rewriting everything right away.
  const [activeTab, setActiveTab] = useState('upcoming')

  const activeStatuses = ['pending_payment', 'pending', 'confirmed']

  const filteredBookings = bookings.filter((booking) => {
    const startTime = new Date(booking.start_time)
    const now = serverDate || new Date()

    if (activeTab === 'upcoming') {
      // Upcoming: Future ACTIVE bookings OR Currently Ongoing bookings
      if (!activeStatuses.concat(['ongoing']).includes(booking.status)) return false

      // If it's ongoing, always show in upcoming
      if (booking.status === 'ongoing') return true

      // If confirmed/paid but start time passed, check if it's still potentially active (end time in future)
      // This handles the gap where cron hasn't run yet but it's technically "now"
      const endTime = new Date(booking.end_time)
      if (startTime < now && endTime < now) return false // Truly past bookings go to history

      if (filter === 'today') {
        return format(startTime, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
      }
      if (filter === 'week') {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        return startTime <= weekFromNow
      }
      return true
    } else {
      // History: Past or Cancelled/Refunded/Completed
      const isHistoryStatus = ['cancelled', 'refunded', 'pending_refund', 'completed', 'no_show'].includes(booking.status)
      const endTime = new Date(booking.end_time)
      // It's history if it's a history status OR if it was an active status but the time has fully passed
      const isPastActive = activeStatuses.includes(booking.status) && endTime < now
      return isHistoryStatus || isPastActive
    }
  })

  // Sort Bookings
  filteredBookings.sort((a, b) => {
    const timeA = new Date(a.start_time).getTime()
    const timeB = new Date(b.start_time).getTime()
    return activeTab === 'upcoming' ? timeA - timeB : timeB - timeA
  })

  const handleResumePayment = async (booking: Booking, paymentMethod: 'gcash' | 'paymaya' = 'gcash') => {
    setResumingPaymentId(booking.id)

    try {
      const { initiatePaymentAction } = await import('@/app/actions/payments')
      const result = await initiatePaymentAction(booking.id, paymentMethod)

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
    const isPaid = booking.status === 'confirmed' && booking.amount_paid > 0
    const nowTime = serverDate ? serverDate.getTime() : Date.now()
    const hoursUntilStart = (new Date(booking.start_time).getTime() - nowTime) / (1000 * 60 * 60)
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
        setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: 'cancelled' } : b))
      } else {
        alert(result.error || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      alert('Failed to cancel booking. Please try again.')
    }

    setCancellingId(null)
  }

  const totalConfirmed = filteredBookings.filter((b) => b.status === 'confirmed').length
  const awaitingPayment = filteredBookings.filter((b) => {
    const isFullyPaid = b.amount_paid >= b.total_amount
    return ['pending_payment', 'pending'].includes(b.status) || (b.status === 'confirmed' && !isFullyPaid)
  }).length

  return (
    <div>
      {/* Main Tabs */}
      <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="history">History & Refunds</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="upcoming" className="space-y-6">
          {/* Sub-filters for Upcoming */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All Upcoming' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === tab.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Stats Cards (Only show for Upcoming) */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-primary font-medium">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredBookings.length}</p>
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

          {/* Bookings List for Upcoming */}
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
                  {filter === 'all'
                    ? "You don't have any upcoming bookings. Find a court and make your first reservation!"
                    : `No bookings ${filter === 'today' ? 'today' : 'this week'}.`}
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
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  serverDate={serverDate}
                  resumingPaymentId={resumingPaymentId}
                  cancellingId={cancellingId}
                  onResumePayment={handleResumePayment}
                  onCancelBooking={handleCancelBooking}
                  onReschedule={setReschedulingBooking}
                  setBookings={setBookings}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {filteredBookings.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No booking history</h3>
                <p className="text-gray-600">You don't have any past bookings yet.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  serverDate={serverDate}
                  resumingPaymentId={resumingPaymentId}
                  cancellingId={cancellingId}
                  onResumePayment={handleResumePayment}
                  onCancelBooking={handleCancelBooking}
                  onReschedule={setReschedulingBooking}
                  setBookings={setBookings}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {reschedulingBooking && (
        <RescheduleModal
          booking={reschedulingBooking}
          isOpen={!!reschedulingBooking}
          onClose={() => setReschedulingBooking(null)}
          onSuccess={() => {
            setReschedulingBooking(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
