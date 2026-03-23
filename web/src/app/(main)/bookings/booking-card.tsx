'use client';

import { useEffect, useState } from 'react';
import { format, differenceInHours } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BookingReviewButton } from '@/components/venue/booking-review-button';
import { StatusBadge } from '@/components/shared/status-badge';

// Redefining interface to avoid circular deps or complex exports for now
export interface Booking {
  id: string;
  booking_id?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  num_players: number;
  payment_type: string;
  notes?: string;
  created_at: string;
  courts: {
    id: string;
    name: string;
    hourly_rate: number;
    court_images?: Array<{
      url: string;
      is_primary: boolean;
      display_order: number;
    }>;
    venues: {
      id: string;
      name: string;
      address?: string;
      city: string;
      image_url?: string;
    };
  };
  payments: Array<{
    id: string;
    status: string;
    payment_method: string;
    amount: number;
  }>;
  recurrence_group_id?: string | null;
  cancellation_reason?: string | null;
  cash_payment_deadline?: string | null;
  metadata?: {
    recurrence_total?: number;
    recurrence_index?: number;
    [key: string]: any;
  };
  // Queue session fields
  type?: 'reservation' | 'queue_session';
  queue_session_id?: string;
  game_format?: string;
  mode?: string;
}

interface BookingCardProps {
  booking: Booking;
  serverDate: Date | null;
  cancellingId: string | null;
  resumingPaymentId: string | null;
  onCancelBooking: (booking: Booking, target?: 'reservation') => void;
  onRefundBooking: (booking: Booking) => void;
  onResumePayment: (booking: Booking, paymentMethod?: 'gcash' | 'paymaya') => void;
  onReschedule: (booking: Booking) => void;
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
}

export function BookingCard({
  booking,
  serverDate,
  cancellingId,
  resumingPaymentId,
  onCancelBooking,
  onRefundBooking,
  onResumePayment,
  onReschedule,
  setBookings,
}: BookingCardProps) {
  const activeStatuses = ['pending_payment', 'pending', 'confirmed', 'partially_paid'];
  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  // -- Helper Logic --

  const isCashBooking = (b: Booking): boolean => {
    return (
      b.metadata?.intended_payment_method === 'cash' ||
      b.metadata?.payment_method === 'cash' ||
      b.payments?.[0]?.payment_method === 'cash'
    );
  };

  const getPaymentStatus = (b: Booking) => {
    const isFullyPaid = b.amount_paid >= b.total_amount;

    // Check partially_paid status FIRST before other statuses
    if (b.status === 'partially_paid') {
      const remaining = b.total_amount - b.amount_paid;
      return { label: `Remaining Balance`, color: 'amber', needsPayment: true };
    }

    if (['confirmed', 'ongoing', 'completed'].includes(b.status) && isFullyPaid) {
      return { label: 'Paid', color: 'green', needsPayment: false };
    }
    if (['confirmed', 'ongoing', 'completed'].includes(b.status) && !isFullyPaid) {
      return { label: 'Pay at Venue', color: 'orange', needsPayment: false };
    }
    if (isCashBooking(b) && b.status === 'pending_payment') {
      return { label: 'Pay at Venue', color: 'blue', needsPayment: false };
    }
    const payment = b.payments?.[0];
    if (!payment) return { label: 'Payment Pending', color: 'yellow', needsPayment: true };

    switch (payment.status) {
      case 'completed':
        return { label: 'Paid', color: 'green', needsPayment: false };
      case 'pending':
        return { label: 'Payment Pending', color: 'yellow', needsPayment: true };
      case 'failed':
        return { label: 'Payment Failed', color: 'red', needsPayment: true };
      default:
        return { label: payment.status, color: 'gray', needsPayment: false };
    }
  };

  const getExtendedPaymentStatus = (b: Booking) => {
    if (b.status === 'pending_refund') {
      return { label: 'Refund Pending', color: 'orange', needsPayment: false };
    }
    if (b.status === 'refunded') {
      return { label: 'Refunded', color: 'gray', needsPayment: false };
    }
    return getPaymentStatus(b);
  };

  const canCancelBooking = (b: Booking): boolean => {
    const startTime = new Date(b.start_time);
    const now = serverDate || new Date();
    const hoursUntilStart = differenceInHours(startTime, now);
    return activeStatuses.includes(b.status) && hoursUntilStart >= 24;
  };

  const bookingStatusBadge = (status: string, b: Booking) => {
    let displayStatus = status;
    let displayLabel = '';

    // Display as Completed if end time has passed and status is confirmed or paid
    const isPastBooking = new Date(b.end_time) < (serverDate || new Date());
    if (status === 'confirmed' && isPastBooking) {
      displayStatus = 'completed';
      displayLabel = 'Completed';
    } else if (status === 'pending_payment') {
      const paymentMethod = b.metadata?.intended_payment_method || b.payments?.[0]?.payment_method;
      if (paymentMethod === 'cash') {
        displayStatus = 'pending_payment';
        displayLabel = 'Awaiting Cash Payment';
      } else {
        displayLabel = 'Pending Payment';
      }
    } else if (status === 'partially_paid') {
      displayLabel = 'Partially Paid';
    } else if (status === 'ongoing') {
      displayLabel = 'Ongoing';
    } else if (status === 'cancelled' && b.cancellation_reason) {
      displayStatus = 'rejected';
      displayLabel = 'Rejected';
    } else {
      displayLabel = status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }

    return <StatusBadge status={displayStatus} label={displayLabel} />;
  };

  const paymentStatus = getExtendedPaymentStatus(booking);
  // Determine if this is a downpayment (partial payment)
  const isDownPayment = booking.payment_type === 'downpayment' || booking.metadata?.is_down_payment === true || booking.metadata?.is_down_payment === 'true';
  const isFullPayment = booking.payment_type === 'full' || booking.payment_type === undefined || booking.payment_type === null;
  // Only show timer for full payment bookings
  const shouldShowCashTimer = isCashBooking(booking) && booking.status === 'pending_payment' && isFullPayment;
  // For full payment, set deadline to 48 hours from booking creation
  const cashDeadline = shouldShowCashTimer
    ? (booking.cash_payment_deadline || booking.metadata?.cash_payment_deadline || new Date(new Date(booking.created_at).getTime() + 48 * 60 * 60 * 1000).toISOString())
    : null;
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    if (!shouldShowCashTimer) return

    const timerId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [shouldShowCashTimer])

  const formatCountdown = (msRemaining: number) => {
    if (msRemaining <= 0) return '00:00:00'

    const totalSeconds = Math.floor(msRemaining / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')

    if (days > 0) return `${days}d ${hh}:${mm}:${ss}`
    return `${hh}:${mm}:${ss}`
  }

  const deadlineMs = cashDeadline ? new Date(cashDeadline).getTime() : 0
  const remainingMs = deadlineMs - nowMs
  const isCashDeadlineExpired = shouldShowCashTimer && remainingMs <= 0

  return (
    <div className="overflow-hidden flex flex-col max-h-[90vh]">
      {/* Image Header */}
      <div className="relative h-56 shrink-0 overflow-hidden">
        {(() => {
          const courtImages = booking.courts.court_images || [];
          const primaryImage = courtImages.find((img) => img.is_primary);
          const imageUrl =
            primaryImage?.url || courtImages[0]?.url || booking.courts.venues.image_url;

          if (imageUrl) {
            return (
              <img
                src={imageUrl}
                alt={booking.courts.name}
                className="w-full h-full object-cover"
              />
            );
          }

          return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <svg
                className="w-12 h-12 text-primary/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          );
        })()}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 max-w-[calc(100%-3rem)] z-10">
          {bookingStatusBadge(booking.status, booking)}
          {booking.type === 'queue_session' && (
            <span className="px-3 py-1.5 rounded-full text-[10px] font-extrabold shadow-lg bg-primary text-white ring-1 ring-white/20 flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              QUEUE SESSION
            </span>
          )}
          {booking.metadata?.weeks_total && booking.metadata.weeks_total > 1 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Week {(booking.metadata.week_index ?? 0) + 1}/{booking.metadata.weeks_total}
            </span>
          )}
          {booking.metadata?.rescheduled && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Rescheduled
            </span>
          )}
          {booking.status === 'refunded' && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              Refunded
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="px-5 pt-5 pb-4 overflow-y-auto min-h-0 bk-modal-scroll">
        <style>{`
                    .bk-modal-scroll::-webkit-scrollbar { width: 4px; }
                    .bk-modal-scroll::-webkit-scrollbar-track { background: transparent; }
                    .bk-modal-scroll::-webkit-scrollbar-thumb { background: rgba(13,148,136,0.2); border-radius: 9999px; }
                    .bk-modal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(13,148,136,0.35); }
                    .bk-modal-scroll { scrollbar-width: thin; scrollbar-color: rgba(13,148,136,0.2) transparent; }
                `}</style>

        {/* Venue & Court */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-0.5 uppercase tracking-wide">
            {booking.courts.name}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {booking.courts.venues.name}
          </p>
        </div>

        {/* Date & Time */}
        <div
          className="rounded-xl p-4 mb-4 border border-primary/15"
          style={{
            background:
              'linear-gradient(135deg, rgba(204, 251, 241, 0.35) 0%, rgba(209, 250, 229, 0.35) 100%)',
          }}
        >
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

        {/* Reschedule Rejection Info */}
        {booking.metadata?.last_reschedule_rejection && (
          <div className="rounded-xl p-4 mb-4 border border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800 font-semibold text-xs uppercase tracking-wider">
                Reschedule Rejected
              </p>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
              {booking.metadata.last_reschedule_rejection.reason}
            </p>
            {booking.metadata.last_reschedule_rejection.rejected_at && (
              <p className="text-xs text-red-400 mt-2">
                {format(new Date(booking.metadata.last_reschedule_rejection.rejected_at), 'MMM d, yyyy · h:mm a')}
              </p>
            )}
          </div>
        )}

        {/* Pending Reschedule Request */}
        {booking.metadata?.reschedule_request?.status === 'pending' && (
          <div className="rounded-xl p-4 mb-4 border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-amber-800 font-semibold text-xs uppercase tracking-wider">
                Reschedule Pending Approval
              </p>
            </div>
            <div className="text-sm text-amber-700 space-y-1">
              <p>
                <span className="font-medium">Proposed:</span>{' '}
                {format(new Date(booking.metadata.reschedule_request.proposed_start_time), 'EEE, MMM d, yyyy')}
              </p>
              <p>
                {format(new Date(booking.metadata.reschedule_request.proposed_start_time), 'h:mm a')} –{' '}
                {format(new Date(booking.metadata.reschedule_request.proposed_end_time), 'h:mm a')}
              </p>
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {/* Reason for rejection instead of payment */}
          {(booking.status === 'rejected' || booking.status === 'cancelled') &&
          booking.cancellation_reason ? (
            <>
              <div className="col-span-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-red-800 font-semibold mb-1 text-xs uppercase tracking-wider">
                  Reason for Rejection
                </p>
                <p className="text-red-700">{booking.cancellation_reason}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">
                  Status
                </p>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm text-white bg-red-500">
                  Rejected
                </span>
              </div>
              <div>
                <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">
                  Amount
                </p>
                <p className="font-bold text-gray-400 line-through">
                  ₱{booking.total_amount.toFixed(2)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">
                  Payment
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm text-white ${
                    paymentStatus.color === 'green'
                      ? 'bg-green-500'
                      : paymentStatus.color === 'yellow'
                        ? 'bg-yellow-500'
                        : paymentStatus.color === 'blue'
                          ? 'bg-blue-500'
                          : paymentStatus.color === 'gray'
                            ? 'bg-gray-500'
                            : paymentStatus.color === 'orange'
                              ? 'bg-orange-500'
                              : 'bg-red-500'
                  }`}
                >
                  {paymentStatus.label}
                </span>
              </div>

              {/* Partial Payment Breakdown Card */}
              {booking.status === 'partially_paid' && booking.amount_paid > 0 ? (
                <div
                  className="col-span-2 rounded-xl p-4 mt-1 border border-primary/10"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(204, 251, 241, 0.25) 0%, rgba(209, 250, 229, 0.25) 100%)',
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Total Amount</span>
                      <span className="font-semibold text-gray-900">
                        ₱{booking.total_amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Down Payment Paid</span>
                      <span className="font-medium text-gray-600">
                        − ₱{Math.min(booking.amount_paid, booking.total_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-primary/15 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-amber-700">
                        Remaining Balance Due
                      </span>
                      <span className="text-xl font-bold text-amber-700">
                        ₱{Math.max(0, booking.total_amount - booking.amount_paid).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : ['pending_refund', 'refunded'].includes(booking.status) ? (
                <div
                  className="col-span-2 rounded-xl p-4 mt-1 border border-primary/10"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(204, 251, 241, 0.25) 0%, rgba(209, 250, 229, 0.25) 100%)',
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Total Amount</span>
                      <span className="font-semibold text-gray-400 line-through">
                        ₱{booking.total_amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-primary/15 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-primary">
                        Refund {booking.status === 'refunded' ? 'Processed' : 'Requested'}
                      </span>
                      <span className="text-xl font-bold text-primary">
                        ₱{Math.min(booking.amount_paid, booking.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Simple amount display for non-partial, non-refund bookings - skip if already in col-span-2 */}
                  {!(
                    booking.metadata?.recurrence_total && booking.metadata.recurrence_total > 1
                  ) ? (
                    <div
                      className="col-span-2 rounded-xl p-4 mt-1 border border-primary/10"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(204, 251, 241, 0.25) 0%, rgba(209, 250, 229, 0.25) 100%)',
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Amount</span>
                        <span className="text-xl font-bold text-gray-900">
                          ₱{booking.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="col-span-2 rounded-xl p-4 mt-1 border border-primary/10"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(204, 251, 241, 0.25) 0%, rgba(209, 250, 229, 0.25) 100%)',
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Amount</span>
                          <span className="font-semibold text-gray-900">
                            ₱{booking.total_amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">per session</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {shouldShowCashTimer && (
                <div
                  className={`col-span-2 rounded-xl p-4 mt-1 border ${isCashDeadlineExpired ? 'border-red-200' : 'border-amber-200'}`}
                  style={{
                    background: isCashDeadlineExpired
                      ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.45) 0%, rgba(254, 242, 242, 0.45) 100%)'
                      : 'linear-gradient(135deg, rgba(254, 243, 199, 0.45) 0%, rgba(255, 251, 235, 0.45) 100%)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${isCashDeadlineExpired ? 'text-red-700' : 'text-amber-700'}`}>
                        Cash Payment Deadline
                      </p>
                      <p className={`text-xs mt-1 ${isCashDeadlineExpired ? 'text-red-600' : 'text-amber-700'}`}>
                        {isCashDeadlineExpired
                          ? 'Deadline passed. This booking will be cancelled if still unpaid.'
                          : `Pay cash at venue before ${format(new Date(cashDeadline as string), 'MMM d, yyyy • h:mm a')}`}
                      </p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm font-bold tabular-nums ${isCashDeadlineExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {formatCountdown(remainingMs)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-4 border-t border-primary/10">
          <BookingReviewButton
            courtId={booking.courts.id}
            courtName={booking.courts.name}
            venueName={booking.courts.venues.name}
            venueId={booking.courts.venues.id}
            bookingDate={booking.start_time}
            bookingStatus={booking.status}
          />

          {booking.status === 'pending_refund' && (
            <div className="w-full p-2 bg-green-50 border border-green-200 rounded-xl text-center text-sm text-green-700 font-medium">
              Refund Request Pending Approval
            </div>
          )}

          {paymentStatus.needsPayment &&
            (!isCashBooking(booking) || booking.status === 'partially_paid') && (
              <Button
                className="w-full bg-primary hover:bg-primary/90 rounded-xl shadow-md shadow-primary/20"
                size="sm"
                onClick={() => onResumePayment(booking, 'gcash')}
                disabled={resumingPaymentId === booking.id}
              >
                {resumingPaymentId === booking.id ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    Continue Payment
                  </>
                )}
              </Button>
            )}

          {isCashBooking(booking) && booking.status === 'pending_payment' && (
            <Button
              className="w-full bg-primary hover:bg-primary/90 rounded-xl shadow-md shadow-primary/20"
              size="sm"
              onClick={() => onResumePayment(booking, 'gcash')}
              disabled={resumingPaymentId === booking.id}
            >
              {resumingPaymentId === booking.id ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Pay via E-Wallet
                </>
              )}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            {booking.type === 'queue_session' && booking.queue_session_id ? (
              /* Queue Session Actions */
              <>
                <Link href={`/queue/${booking.queue_session_id || booking.courts?.id}`}>
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl text-green-700 border-green-300 bg-white hover:bg-green-50 hover:text-green-800 hover:border-green-400 transition-colors"
                    size="sm"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    Manage Queue
                  </Button>
                </Link>
                <Link href={`/bookings/${booking.id}/receipt`}>
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors"
                    size="sm"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View Receipt
                  </Button>
                </Link>
              </>
            ) : (
              /* Regular Booking Actions */
              <>
                <Link href={`/courts/${booking.courts.venues.id}`}>
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors"
                    size="sm"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Court
                  </Button>
                </Link>

                <Link href={`/bookings/${booking.id}/receipt`}>
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors"
                    size="sm"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View Receipt
                  </Button>
                </Link>

                {/* Refund button for paid confirmed bookings (>24h) */}
                {(booking.status === 'confirmed' || booking.status === 'partially_paid') &&
                  booking.amount_paid > 0 &&
                  canCancelBooking(booking) && (
                    <div className="w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRefundBooking(booking)}
                        className="w-full h-10 rounded-xl transition-colors text-primary border-primary/30 hover:bg-primary/5 hover:text-primary hover:border-primary/40"
                      >
                        <svg
                          className="w-4 h-4 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Request Refund
                      </Button>
                    </div>
                  )}

                {canCancelBooking(booking) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReschedule(booking)}
                      className="w-full h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Reschedule
                    </Button>

                    {/* Show Cancel for unpaid, nothing extra for paid (refund button is above) */}
                    {!((booking.status === 'confirmed' || booking.status === 'partially_paid') && booking.amount_paid > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancelBooking(booking, 'reservation')}
                        disabled={cancellingId === booking.id}
                        className="w-full h-10 rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
                      >
                        {cancellingId === booking.id ? (
                          <>
                            <Spinner className="w-4 h-4 mr-2" />
                            Please wait...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4 mr-1.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Cancel Slot
                          </>
                        )}
                      </Button>
                    )}

                  </>
                )}
              </>
            )}
          </div>
          {booking.type !== 'queue_session' && canCancelBooking(booking) && (
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Free rescheduling/cancellation available up to 24 hours before booking.
            </p>
          )}
        </div>

        {!canCancelBooking(booking) &&
          !['cancelled', 'refunded', 'pending_refund', 'completed'].includes(booking.status) && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Cannot cancel or reschedule within 24 hours of booking
            </p>
          )}
      </div>
    </div>
  );
}
