'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { cancelReservationAction } from '@/app/actions/reservations'
import { markRescheduleResultSeenAction } from '@/app/actions/reschedule-actions'

import { RescheduleModal } from '@/components/booking/reschedule-modal'
import { CancelBookingModal } from '@/components/booking/cancel-booking-modal'
import { BookingGroupModal } from '@/components/booking/booking-group-modal'
import { useServerTime } from '@/hooks/use-server-time'
import Link from 'next/link'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { BookingCard, Booking } from './booking-card'
import { BookingPreviewCard } from './booking-preview-card'
import { GroupedBookingPreviewCard } from './grouped-booking-preview-card'

interface BookingGroup {
  id: string
  type: 'single' | 'grouped_multi_court' | 'grouped_recurring'
  reservations: Booking[]
  totalAmount: number
  amountPaid: number
}

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
  const [cancelModalState, setCancelModalState] = useState<{booking: Booking, target: 'reservation' | 'refund_reservation'} | null>(null)
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all')
  // activeTab state is now managed by the Tabs component, but we can track it if needed for filtering logic separate from rendering
  // checks. However, TabsContent naturally separates rendering. We'll use a local state to sync with Tabs if we need to know the active tab for other logic,
  // but looking at `filteredBookings`, it relies on `activeTab` state.
  // We will keep `activeTab` and sync it with Tabs onValueChange to keep logic simple without rewriting everything right away.
  const [activeTab, setActiveTab] = useState('upcoming')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<BookingGroup | null>(null)
  const [outOfOrderWarning, setOutOfOrderWarning] = useState<{
    booking: Booking
    paymentMethod: 'gcash' | 'paymaya'
    unpaidDays: number[]
  } | null>(null)

  const handleSelectBooking = (booking: Booking) => {
    setSelectedBooking(booking)

    // Mark reschedule result as seen (fire-and-forget)
    const hasUnseenApproval = booking.metadata?.rescheduled && !booking.metadata?.reschedule_approved_seen
    const hasUnseenRejection = booking.metadata?.last_reschedule_rejection && !booking.metadata?.reschedule_rejected_seen

    if (hasUnseenApproval || hasUnseenRejection) {
      markRescheduleResultSeenAction(booking.id).then(() => {
        // Update local state so the tag disappears from preview cards
        setBookings(prev => prev.map(b => {
          if (b.id !== booking.id) return b
          return {
            ...b,
            metadata: {
              ...b.metadata,
              ...(hasUnseenApproval ? { reschedule_approved_seen: true } : {}),
              ...(hasUnseenRejection ? { reschedule_rejected_seen: true } : {}),
            }
          }
        }))
      })
    }
  }

  const activeStatuses = ['pending_payment', 'pending', 'confirmed', 'partially_paid']

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
    } else if (activeTab === 'history') {
      // History: Past or Cancelled/Completed (exclude refund statuses)
      const isHistoryStatus = ['cancelled', 'completed', 'no_show'].includes(booking.status)
      const endTime = new Date(booking.end_time)
      // It's history if it's a history status OR if it was an active status but the time has fully passed
      const isPastActive = activeStatuses.includes(booking.status) && endTime < now
      return isHistoryStatus || isPastActive
    } else {
      // Refunds: Only refund-related statuses
      return ['refunded', 'pending_refund'].includes(booking.status)
    }
  })

  const groupedBookings = useMemo(() => {
    const groups: { [key: string]: BookingGroup } = {}

    filteredBookings.forEach(booking => {
      // Priority 1: recurrence_group_id (recurring)
      // Priority 2: individual id (single)
      const groupId = booking.recurrence_group_id || booking.id
      const groupType = booking.recurrence_group_id ? 'grouped_recurring' : 'single'

      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          type: groupType,
          reservations: [],
          totalAmount: 0,
          amountPaid: 0
        }
      }

      groups[groupId].reservations.push(booking)
      groups[groupId].totalAmount += booking.total_amount
      groups[groupId].amountPaid += Math.min(booking.amount_paid, booking.total_amount)
    })

    // CRITICAL: Post-process to ensure single-reservation groups are treated as single bookings
    // This handles the case where a booking_id is shared but only 1 reservation remains (e.g. after cancellations)
    // or if a booking_id was assigned but only 1 court was booked.
    Object.values(groups).forEach(group => {
      group.reservations.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )

      if (group.reservations.length === 1) {
        group.type = 'single'
      }
    })

    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.reservations[0].start_time).getTime()
      const timeB = new Date(b.reservations[0].start_time).getTime()
      return activeTab === 'upcoming' ? timeA - timeB : timeB - timeA
    })
  }, [filteredBookings, activeTab])


  const getUnpaidEarlierDays = (booking: Booking): number[] => {
    if (!booking.recurrence_group_id) return []

    const currentIndex = booking.metadata?.recurrence_index ?? booking.metadata?.week_index ?? -1
    if (currentIndex <= 0) return []

    const sameGroupBookings = bookings.filter(
      (b) => b.recurrence_group_id === booking.recurrence_group_id && b.id !== booking.id
    )

    const unpaidDays: number[] = []
    for (const b of sameGroupBookings) {
      const bIndex = b.metadata?.recurrence_index ?? b.metadata?.week_index ?? -1
      if (bIndex < currentIndex) {
        const isFullyPaid = b.amount_paid >= b.total_amount
        const isPaidStatus = ['confirmed', 'completed', 'ongoing'].includes(b.status) && isFullyPaid
        if (!isPaidStatus && b.status !== 'cancelled' && b.status !== 'refunded') {
          unpaidDays.push(bIndex + 1)
        }
      }
    }

    return unpaidDays.sort((a, b) => a - b)
  }

  const handleResumePayment = async (booking: Booking, paymentMethod: 'gcash' | 'paymaya' = 'gcash') => {
    // Check for unpaid earlier days in the same recurrence group
    const unpaidDays = getUnpaidEarlierDays(booking)
    if (unpaidDays.length > 0) {
      setOutOfOrderWarning({ booking, paymentMethod, unpaidDays })
      return
    }

    await proceedWithPayment(booking, paymentMethod)
  }

  const proceedWithPayment = async (booking: Booking, paymentMethod: 'gcash' | 'paymaya' = 'gcash') => {
    setResumingPaymentId(booking.id)

    try {
      const { initiatePaymentAction } = await import('@/app/actions/payments')
      const result = await initiatePaymentAction(
        booking.id, 
        paymentMethod,
        { isMobile: Capacitor.isNativePlatform() }
      )

      if (result.success && result.checkoutUrl) {
        if (Capacitor.isNativePlatform()) {
          await Browser.open({ url: result.checkoutUrl })
        } else {
          window.location.href = result.checkoutUrl
        }
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

  const handleCancelBooking = (booking: Booking, target: 'reservation' = 'reservation') => {
    setCancelModalState({ booking, target })
  }

  const handleRefundBooking = (booking: Booking) => {
    setCancelModalState({ booking, target: 'refund_reservation' })
  }

  const totalConfirmed = filteredBookings.filter((b) => b.status === 'confirmed').length
  const awaitingPayment = filteredBookings.filter((b) => {
    const isFullyPaid = b.amount_paid >= b.total_amount
    return ['pending_payment', 'pending', 'partially_paid'].includes(b.status) || (b.status === 'confirmed' && !isFullyPaid)
  }).length
  const summaryBookings = [...bookings].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  return (
    <div>
      {/* Card styles matching home page sc-card design */}
      <style>{`
        .bk-card {
          position: relative;
          border-radius: 1.125rem;
          overflow: hidden;
          border: 1px solid rgba(13,148,136,0.18);
          box-shadow: none;
          transition:
            transform 0.30s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.30s ease;
          display: block;
          height: 300px;
          background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
          cursor: pointer;
        }
        .bk-card:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.08),
            0 8px 28px rgba(13,148,136,0.16),
            0 16px 48px rgba(0,0,0,0.10);
        }
        .bk-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.40s cubic-bezier(0.34,1.56,0.64,1);
        }
        .bk-card:hover .bk-card-img {
          transform: scale(1.06);
        }
        .bk-card-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%);
        }
        .bk-fog-gradient {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 65%;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(
            to bottom,
            transparent              0%,
            rgba(5,46,40,0.18)      25%,
            rgba(5,46,40,0.55)      55%,
            rgba(5,46,40,0.85)     100%
          );
        }
        .bk-fog-blur {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 45%;
          pointer-events: none;
          z-index: 3;
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
        }
        .bk-content {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          z-index: 5;
          padding: 0.875rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .bk-name {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.01em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .bk-venue {
          font-size: 0.8125rem;
          color: rgba(204,251,241,0.85);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bk-date {
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          line-height: 1.3;
        }
        .bk-price {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #99f6e4;
          line-height: 1.3;
        }
        .bk-cta {
          display: block;
          width: 100%;
          margin-top: 5px;
          padding: 5px 0;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #ffffff;
          font-size: 0.8125rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-align: center;
          border-radius: 0.625rem;
          border: 1px solid rgba(255,255,255,0.28);
          transition: background 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .bk-card:hover .bk-cta {
          background: rgba(13,148,136,0.72);
          transform: scale(1.02);
        }
          
          /* QueueCard Glassmorphism Styles applied to Summary */
          @keyframes qc-shimmer {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
          .sqc-card {
            position: relative;
            overflow: hidden;
            border-radius: 1.25rem;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
          }
          .sqc-header {
            position: relative;
            overflow: hidden;
          }
          .sqc-header .qc-noise {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 1;
            opacity: 0.055;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='qc'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23qc)' opacity='1'/%3E%3C/svg%3E");
            background-size: 150px 150px;
            mix-blend-mode: overlay;
          }
          .sqc-header .qc-highlight {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 2;
            background: linear-gradient(
              135deg,
              rgba(204,251,241,0.16) 0%,
              rgba(153,246,228,0.06) 30%,
              transparent 55%,
              rgba(0,0,0,0.04) 100%
            );
          }
        `}</style>

      {/* Main Tabs */}
      <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <TabsList className="grid w-full sm:w-[600px] grid-cols-4">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Total Bookings */}
            <div className="stat-glass stat-glass-teal relative overflow-hidden rounded-xl p-2.5 sm:rounded-2xl sm:p-4 border border-white/20 transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              style={{
                backgroundImage: [
                  'radial-gradient(ellipse 80% 60% at 15% 20%, rgba(20,184,166,0.55) 0%, transparent 55%)',
                  'radial-gradient(ellipse 60% 70% at 90% 85%, rgba(6,182,212,0.40) 0%, transparent 55%)',
                  'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
                ].join(','),
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 20px rgba(13,148,136,0.2)'
              }}>
              <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: '180px 180px', mixBlendMode: 'overlay' }} />
              <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                <div className="hidden w-10 h-10 rounded-full sm:flex items-center justify-center border border-white/30" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 0 0 3px rgba(255,255,255,0.06)' }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs leading-tight font-medium text-white/75">Total Bookings</p>
                  <p className="text-lg sm:text-2xl leading-none sm:leading-normal font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>{filteredBookings.length}</p>
                </div>
              </div>
            </div>

            {/* Awaiting Payment */}
            <div className="stat-glass stat-glass-amber relative overflow-hidden rounded-xl p-2.5 sm:rounded-2xl sm:p-4 border border-white/20 transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              style={{
                backgroundImage: [
                  'radial-gradient(ellipse 80% 60% at 20% 25%, rgba(251,191,36,0.50) 0%, transparent 55%)',
                  'radial-gradient(ellipse 60% 70% at 85% 80%, rgba(245,158,11,0.40) 0%, transparent 55%)',
                  'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                ].join(','),
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 20px rgba(217,119,6,0.2)'
              }}>
              <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: '180px 180px', mixBlendMode: 'overlay' }} />
              <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                <div className="hidden w-10 h-10 rounded-full sm:flex items-center justify-center border border-white/30" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 0 0 3px rgba(255,255,255,0.06)' }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs leading-tight font-medium text-white/75">Awaiting Payment</p>
                  <p className="text-lg sm:text-2xl leading-none sm:leading-normal font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>{awaitingPayment}</p>
                </div>
              </div>
            </div>

            {/* Confirmed / Paid */}
            <div className="stat-glass stat-glass-emerald relative overflow-hidden rounded-xl p-2.5 sm:rounded-2xl sm:p-4 border border-white/20 transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              style={{
                backgroundImage: [
                  'radial-gradient(ellipse 80% 60% at 80% 20%, rgba(52,211,153,0.50) 0%, transparent 55%)',
                  'radial-gradient(ellipse 60% 70% at 15% 85%, rgba(16,185,129,0.40) 0%, transparent 55%)',
                  'linear-gradient(135deg, #059669 0%, #047857 100%)'
                ].join(','),
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 20px rgba(5,150,105,0.2)'
              }}>
              <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: '180px 180px', mixBlendMode: 'overlay' }} />
              <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                <div className="hidden w-10 h-10 rounded-full sm:flex items-center justify-center border border-white/30" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 0 0 3px rgba(255,255,255,0.06)' }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs leading-tight font-medium text-white/75">Confirmed / Paid</p>
                  <p className="text-lg sm:text-2xl leading-none sm:leading-normal font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>{totalConfirmed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bookings List for Upcoming */}
          {groupedBookings.length === 0 ? (
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-white to-teal-50 p-10 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/15 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {filter === 'all' ? 'No upcoming bookings' : filter === 'today' ? 'Nothing scheduled today' : 'Nothing this week'}
                </h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  {filter === 'all'
                    ? 'Your schedule is wide open! Browse available courts and book your next game.'
                    : `No bookings ${filter === 'today' ? 'for today' : 'this week'}. Try checking all upcoming bookings.`}
                </p>
                <Link href="/courts">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 rounded-xl shadow-md shadow-primary/20 px-8">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Find Courts
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {groupedBookings.map((group) => {
                if (group.type === 'single') {
                  const booking = group.reservations[0]

                  return (
                    <BookingPreviewCard
                      key={booking.id}
                      booking={booking}
                      serverDate={serverDate}
                      onClick={() => handleSelectBooking(booking)}
                    />
                  )
                }

                return (
                  <GroupedBookingPreviewCard
                    key={group.id}
                    group={group as any}
                    serverDate={serverDate}
                    onClick={() => setSelectedGroup(group)}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {groupedBookings.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 p-10 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No booking history</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Your past bookings and completed sessions will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {groupedBookings.map((group) => {
                if (group.type === 'single') {
                  const booking = group.reservations[0]

                  return (
                    <BookingPreviewCard
                      key={booking.id}
                      booking={booking}
                      serverDate={serverDate}
                      onClick={() => handleSelectBooking(booking)}
                    />
                  )
                }

                return (
                  <GroupedBookingPreviewCard
                    key={group.id}
                    group={group as any}
                    serverDate={serverDate}
                    onClick={() => setSelectedGroup(group)}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="refunds">
          {groupedBookings.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 p-10 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <svg className="w-7 h-7 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No refund requests</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Your refund requests and processed refunds will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {groupedBookings.map((group) => {
                if (group.type === 'single') {
                  const booking = group.reservations[0]

                  return (
                    <BookingPreviewCard
                      key={booking.id}
                      booking={booking}
                      serverDate={serverDate}
                      onClick={() => handleSelectBooking(booking)}
                    />
                  )
                }

                return (
                  <GroupedBookingPreviewCard
                    key={group.id}
                    group={group as any}
                    serverDate={serverDate}
                    onClick={() => setSelectedGroup(group)}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 p-10 text-center">
                <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <svg className="w-7 h-7 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No booking summary</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">Your bookings will appear here.</p>
                </div>
              </div>
            ) : (
              <Card className="sqc-card">
                <CardHeader className="sqc-header px-6 py-5 border-b border-primary/5 pb-5" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)' }}>
                  <div className="qc-noise" />
                  <div className="qc-highlight" />
                  <CardTitle className="relative z-10 text-xl font-bold text-white tracking-tight drop-shadow-sm">Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                  <div className="md:hidden p-3 space-y-2">
                    {summaryBookings.map((booking) => {
                      const paymentMethod = booking.metadata?.intended_payment_method || booking.metadata?.payment_method || booking.payments?.[0]?.payment_method || 'N/A'
                      const formattedMethod = paymentMethod === 'N/A' ? 'N/A' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => handleSelectBooking(booking)}
                          className="w-full text-left rounded-xl border border-gray-100 bg-white p-3 transition-colors hover:bg-teal-50/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{booking.courts.venues.name}</p>
                              <p className="text-xs text-gray-500 truncate">{booking.courts.name}</p>
                            </div>
                            <div className="shrink-0 rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
                              ₱{booking.total_amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-600">
                              {format(new Date(booking.start_time), 'MMM d, yyyy')} • {format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
                            </p>
                            <p className="shrink-0 text-[11px] font-semibold text-gray-500">{formattedMethod}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="hidden md:block">
                    <Table className="border-0">
                      <TableHeader className="border-0">
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                          <TableHead className="font-semibold text-gray-600 pl-6 w-[40%] text-xs uppercase tracking-wider py-4">Venue & Court</TableHead>
                          <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wider py-4">Date & Time</TableHead>
                          <TableHead className="font-semibold text-gray-600 text-right pr-6 text-xs uppercase tracking-wider py-4">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="border-0">
                        {summaryBookings.map((booking) => {
                          const paymentMethod = booking.metadata?.intended_payment_method || booking.metadata?.payment_method || booking.payments?.[0]?.payment_method || 'N/A'
                          const formattedMethod = paymentMethod === 'N/A' ? 'N/A' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)

                          return (
                            <TableRow key={booking.id} className="border-b border-gray-100/50 last:border-0 hover:bg-teal-50/40 transition-all duration-300 cursor-pointer group" onClick={() => handleSelectBooking(booking)}>
                              <TableCell className="pl-6 py-4">
                                <div className="flex flex-col gap-1 border-l-2 border-transparent group-hover:border-teal-400 pl-3 transition-colors duration-300">
                                  <span className="text-[15px] font-bold text-gray-800 tracking-tight group-hover:text-teal-900 transition-colors">
                                    {booking.courts.venues.name}
                                  </span>
                                  <span className="text-[13px] text-gray-500 font-medium">
                                    {booking.courts.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[14px] font-semibold text-gray-800">
                                    {format(new Date(booking.start_time), 'MMM d, yyyy')}
                                  </span>
                                  <span className="text-[12px] text-gray-500 font-medium bg-gray-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                                    {format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6 py-4">
                                <div className="inline-flex items-center gap-2 text-[13px] font-bold text-teal-700 bg-white/60 px-3.5 py-1.5 rounded-xl ring-1 ring-teal-200/50 shadow-sm shadow-teal-900/5 whitespace-nowrap backdrop-blur-md">
                                  <span>₱{booking.total_amount.toFixed(2)}</span>
                                  <span className="w-1 h-1 rounded-full bg-teal-400/60"></span>
                                  <span>{formattedMethod}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Booking Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="inset-0 translate-x-0 translate-y-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 w-screen h-[100dvh] max-w-none max-h-none p-0 overflow-hidden rounded-none border-0 shadow-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:max-w-lg sm:max-h-[90vh] sm:flex sm:flex-col sm:!rounded-2xl sm:border sm:border-primary/15 sm:shadow-xl sm:shadow-primary/10">
          <VisuallyHidden>
            <DialogTitle>Booking Details</DialogTitle>
          </VisuallyHidden>
          {selectedBooking && (
            <BookingCard
              booking={selectedBooking}
              serverDate={serverDate}
              resumingPaymentId={resumingPaymentId}
              cancellingId={cancellingId}
              onResumePayment={handleResumePayment}
              onCancelBooking={(b, target) => { setSelectedBooking(null); handleCancelBooking(b, target) }}
              onRefundBooking={(b) => { setSelectedBooking(null); handleRefundBooking(b) }}
              onReschedule={(b) => { setSelectedBooking(null); setReschedulingBooking(b) }}
              setBookings={setBookings}
            />
          )}
        </DialogContent>
      </Dialog>

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

      {cancelModalState && (
        <CancelBookingModal
          booking={cancelModalState.booking}
          target={cancelModalState.target}
          isOpen={!!cancelModalState}
          onClose={() => setCancelModalState(null)}
          onCancelSuccess={() => {
            router.refresh()
            setCancelModalState(null)
          }}
          onRefundSuccess={() => {
            router.refresh()
            setCancelModalState(null)
          }}
        />
      )}

      {/* Out-of-order payment warning modal */}
      <Dialog open={!!outOfOrderWarning} onOpenChange={(open) => !open && setOutOfOrderWarning(null)}>
        <DialogContent className="!rounded-2xl border-amber-200 max-w-md p-6">
          <DialogTitle className="flex items-center gap-2 text-amber-700 text-lg font-semibold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Unpaid Earlier Booking{outOfOrderWarning && outOfOrderWarning.unpaidDays.length > 1 ? 's' : ''}
          </DialogTitle>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-600">
              You&apos;re about to pay for{' '}
              <span className="font-semibold text-gray-900">
                Day {outOfOrderWarning ? (outOfOrderWarning.booking.metadata?.recurrence_index ?? outOfOrderWarning.booking.metadata?.week_index ?? 0) + 1 : ''}
              </span>{' '}
              of your booking, but{' '}
              <span className="font-semibold text-amber-700">
                Day {outOfOrderWarning?.unpaidDays.join(', Day ')}
              </span>{' '}
              {outOfOrderWarning && outOfOrderWarning.unpaidDays.length > 1 ? 'are' : 'is'} still unpaid.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">Are you sure you want to continue?</p>
              <p>You can pay for earlier days first by going back and selecting them.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setOutOfOrderWarning(null)}
            >
              Go Back
            </Button>
            <Button
              className="rounded-xl bg-primary hover:bg-primary/90"
              onClick={() => {
                if (outOfOrderWarning) {
                  proceedWithPayment(outOfOrderWarning.booking, outOfOrderWarning.paymentMethod)
                }
                setOutOfOrderWarning(null)
              }}
            >
              Continue to Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        {/* Group Details Modal */}
        <BookingGroupModal
          group={selectedGroup as any}
          isOpen={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onRescheduleBooking={(b) => {
            setSelectedGroup(null)
            setReschedulingBooking(b)
          }}
          onCancelBooking={(b) => {
            setSelectedGroup(null)
            handleCancelBooking(b)
          }}
          onRefundBooking={(b) => {
            setSelectedGroup(null)
            handleRefundBooking(b)
          }}
          onResumePayment={(b, paymentMethod) => {
            handleResumePayment(b, paymentMethod)
          }}
          serverDate={serverDate}
        />
    </div>
  )
}
