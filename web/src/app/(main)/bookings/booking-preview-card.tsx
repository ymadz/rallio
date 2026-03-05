'use client'

import { format } from 'date-fns'
import { Booking } from './booking-card'
import { StatusBadge } from '@/components/shared/status-badge'

interface BookingPreviewCardProps {
  booking: Booking
  serverDate: Date | null
  onClick: () => void
}

export function BookingPreviewCard({ booking, serverDate, onClick }: BookingPreviewCardProps) {
  const startDate = new Date(booking.start_time)
  const endDate = new Date(booking.end_time)

  const courtImages = booking.courts.court_images || []
  const primaryImage = courtImages.find(img => img.is_primary)
  const imageUrl = primaryImage?.url || courtImages[0]?.url || booking.courts.venues.image_url

  const isPastBooking = endDate < (serverDate || new Date())

  const isCashBooking =
    booking.metadata?.intended_payment_method === 'cash' ||
    booking.metadata?.payment_method === 'cash' ||
    booking.payments?.[0]?.payment_method === 'cash'

  // Determine display status
  let displayStatus = booking.status
  let displayLabel = ''
  if (booking.status === 'confirmed' && isPastBooking) {
    displayStatus = 'completed'
    displayLabel = 'Completed'
  } else if (booking.status === 'pending_payment') {
    if (isCashBooking) {
      displayStatus = 'confirmed'
      displayLabel = 'Reserved'
    } else {
      displayLabel = 'Pending Payment'
    }
  } else if (booking.status === 'partially_paid') {
    if (booking.amount_paid >= booking.total_amount) {
      displayStatus = 'confirmed'
      displayLabel = 'Paid'
    } else {
      displayLabel = 'Partially Paid'
    }
  } else if (booking.status === 'ongoing') {
    displayLabel = 'Ongoing'
  } else if (booking.status === 'cancelled' && booking.cancellation_reason) {
    displayStatus = 'rejected'
    displayLabel = 'Rejected'
  } else {
    displayLabel = booking.status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return (
    <button
      onClick={onClick}
      className="bk-card group text-left w-full"
      type="button"
    >
      {imageUrl ? (
        <img src={imageUrl} alt={booking.courts.name} className="bk-card-img" />
      ) : (
        <div className="bk-card-placeholder">
          <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* Fog gradient overlay */}
      <div className="bk-fog-gradient" />
      <div className="bk-fog-blur" />

      {/* Status badge - top right */}
      <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
        <StatusBadge status={displayStatus} label={displayLabel} size="sm" />
        {booking.type === 'queue_session' && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-green-700 border border-green-300 backdrop-blur-sm">
            Queue
          </span>
        )}
      </div>

      {/* Content overlay at bottom */}
      <div className="bk-content">
        <div className="bk-name uppercase">{booking.courts.name}</div>
        <div className="bk-venue">
          <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {booking.courts.venues.name}
        </div>
        <div className="bk-date">
          📅 {format(startDate, 'EEE, MMM d')} · {format(startDate, 'h:mm a')} – {format(endDate, 'h:mm a')}
        </div>
        <div className="bk-price">
          💰 ₱{booking.total_amount.toFixed(2)}
        </div>
        <span className="bk-cta">
          View Details →
        </span>
      </div>
    </button>
  )
}
