'use client'

import { format } from 'date-fns'
import { Booking } from './booking-card'
import { StatusBadge } from '@/components/shared/status-badge'

interface GroupedBookingPreviewCardProps {
  group: {
    id: string
    type: 'grouped_multi_court' | 'grouped_recurring'
    reservations: Booking[]
    totalAmount: number
    amountPaid: number
  }
  serverDate: Date | null
  onClick: () => void
}

export function GroupedBookingPreviewCard({ group, serverDate, onClick }: GroupedBookingPreviewCardProps) {
  const firstBooking = group.reservations[0]
  const startDate = new Date(firstBooking.start_time)
  const endDate = new Date(firstBooking.end_time)

  const courtImages = firstBooking.courts?.court_images || []
  const primaryImage = courtImages.find(img => img.is_primary)
  const imageUrl = primaryImage?.url || courtImages[0]?.url || firstBooking.courts?.venues?.image_url

  const isPastBooking = group.reservations.every(b => new Date(b.end_time) < (serverDate || new Date()))

  // Determine aggregate display status
  const statuses = new Set(group.reservations.map(b => b.status))
  let displayStatus = 'confirmed'
  let displayLabel = 'Grouped Booking'

  if (statuses.has('pending_payment')) {
    displayStatus = 'pending_payment'
    displayLabel = 'Pending Payment'
  } else if (statuses.has('partially_paid')) {
    displayStatus = 'partially_paid'
    displayLabel = 'Partially Paid'
  } else if (group.amountPaid >= group.totalAmount) {
    displayStatus = 'confirmed'
    displayLabel = group.type === 'grouped_recurring' ? 'Recurring Series' : 'Paid'
  }

  if (isPastBooking) {
    displayStatus = 'completed'
    displayLabel = 'Completed'
  }

  // Summarize courts
  const distinctCourts = Array.from(new Set(group.reservations.map(b => b.courts?.name))).filter(Boolean)
  const courtSummary = distinctCourts.length > 2 
    ? `${distinctCourts[0]}, ${distinctCourts[1]} +${distinctCourts.length - 2}`
    : distinctCourts.join(' & ')

  return (
    <button
      onClick={onClick}
      className="bk-card group text-left w-full relative"
      type="button"
    >
      {/* Folder stacked effect (simulated with shadow/border) */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-[1]" />
      
      {/* Visual Stack Layers (Simulating folder/cluster) */}
      <div className="absolute -right-1.5 -bottom-1.5 inset-0 bk-card scale-[0.98] border-primary/10 bg-primary/5 -z-10 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" />
      <div className="absolute -right-3 -bottom-3 inset-0 bk-card scale-[0.96] border-primary/5 bg-primary/10 -z-20 transition-transform group-hover:-translate-x-2 group-hover:-translate-y-2" />

      {imageUrl ? (
        <img src={imageUrl} alt={courtSummary} className="bk-card-img" />
      ) : (
        <div className="bk-card-placeholder">
          <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      )}

      {/* Fog gradient overlay */}
      <div className="bk-fog-gradient" />
      <div className="bk-fog-blur" />

      {/* Status badge - top right */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-wrap gap-1.5 justify-end max-w-[70%]">
        <StatusBadge status={displayStatus} label={displayLabel} size="sm" />
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white shadow-sm ring-1 ring-white/20 whitespace-nowrap">
          {group.reservations.length} Slots
        </span>
      </div>

      {/* Content overlay at bottom */}
      <div className="bk-content">
        <div className="bk-name uppercase truncate pr-4">
          {group.type === 'grouped_recurring' ? `RECURRING: ${courtSummary}` : courtSummary}
        </div>
        <div className="bk-venue">
          <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {firstBooking.courts?.venues?.name || 'Unknown Venue'}
        </div>
        <div className="bk-date">
          📅 {format(startDate, 'EEE, MMM d')}
          {group.type === 'grouped_multi_court' && (
             <span className="ml-1 opacity-80">· Mixed Times</span>
          )}
        </div>
        <div className="bk-price">
          💰 ₱{group.totalAmount.toFixed(2)}
        </div>
        <span className="bk-cta mt-0.5">
          {group.type === 'grouped_recurring' ? 'View Series →' : 'View Group Details →'}
        </span>
      </div>
    </button>
  )
}
