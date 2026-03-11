'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Booking } from '@/app/(main)/bookings/booking-card'

interface UpcomingBookingsProps {
  bookings: Booking[]
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps) {
  const router = useRouter()

  if (bookings.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-500 mb-2">No upcoming bookings</p>
        <Link href="/courts" className="text-sm font-medium text-primary hover:text-primary/80">
          Book a court now
        </Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .ub-card {
          position: relative;
          border-radius: 1.125rem;
          overflow: hidden;
          border: 1px solid rgba(13,148,136,0.18);
          box-shadow: none;
          transition:
            transform 0.30s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.30s ease;
          display: block;
          height: 230px;
          background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
          cursor: pointer;
        }
        .ub-card:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.08),
            0 8px 28px rgba(13,148,136,0.16),
            0 16px 48px rgba(0,0,0,0.10);
        }
        .ub-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.40s cubic-bezier(0.34,1.56,0.64,1);
        }
        .ub-card:hover .ub-card-img {
          transform: scale(1.06);
        }
        .ub-card-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%);
        }
        .ub-fog-gradient {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 60%;
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
        .ub-fog-blur {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 40%;
          pointer-events: none;
          z-index: 3;
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
        }
        .ub-content {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          z-index: 5;
          padding: 0.875rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ub-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.01em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .ub-venue {
          font-size: 0.6875rem;
          color: rgba(204,251,241,0.85);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ub-date {
          font-size: 0.6875rem;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          line-height: 1.3;
        }
        .ub-price {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #99f6e4;
          line-height: 1.3;
        }
        .ub-cta {
          display: block;
          width: 100%;
          margin-top: 5px;
          padding: 5px 0;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-align: center;
          border-radius: 0.625rem;
          border: 1px solid rgba(255,255,255,0.28);
          transition: background 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .ub-card:hover .ub-cta {
          background: rgba(13,148,136,0.72);
          transform: scale(1.02);
        }
      `}</style>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {bookings.map((booking) => {
          const startDate = new Date(booking.start_time)
          const endDate = new Date(booking.end_time)

          const courtImages = booking.courts?.court_images || []
          const primaryImage = courtImages.find(img => img.is_primary)
          const imageUrl =
            primaryImage?.url ||
            courtImages[0]?.url ||
            booking.courts?.venues?.image_url

          const isCashBooking =
            booking.metadata?.intended_payment_method === 'cash' ||
            booking.metadata?.payment_method === 'cash' ||
            booking.payments?.[0]?.payment_method === 'cash'

          let displayStatus = booking.status
          let displayLabel = ''
          if (booking.status === 'pending_payment') {
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
          } else {
            displayLabel = booking.status
              .split('_')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ')
          }

          return (
            <button
              key={booking.id}
              onClick={() => router.push('/bookings')}
              className="ub-card group text-left w-full"
              type="button"
            >
              {imageUrl ? (
                <img src={imageUrl} alt={booking.courts?.name ?? 'Court'} className="ub-card-img" />
              ) : (
                <div className="ub-card-placeholder">
                  <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              <div className="ub-fog-gradient" />
              <div className="ub-fog-blur" />

              {/* Status badge */}
              <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
                <StatusBadge status={displayStatus} label={displayLabel} size="sm" />
                {booking.type === 'queue_session' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-green-700 border border-green-300 backdrop-blur-sm">
                    Queue
                  </span>
                )}
              </div>

              <div className="ub-content">
                <div className="ub-name uppercase">{booking.courts?.name ?? 'Court'}</div>
                <div className="ub-venue">
                  <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {booking.courts?.venues?.name ?? 'Venue'}
                </div>
                <div className="ub-date">
                  📅 {format(startDate, 'EEE, MMM d')} · {format(startDate, 'h:mm a')} – {format(endDate, 'h:mm a')}
                </div>
                <div className="ub-price">
                  💰 ₱{booking.total_amount.toFixed(2)}
                </div>
                <span className="ub-cta">View Details →</span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
