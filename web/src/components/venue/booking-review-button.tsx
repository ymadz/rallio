'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { ReviewModal } from './review-modal'

interface BookingReviewButtonProps {
  courtId: string
  courtName: string
  venueName: string
  venueId: string
  bookingDate: string
  bookingStatus: string
}

export function BookingReviewButton({
  courtId,
  courtName,
  venueName,
  venueId,
  bookingDate,
  bookingStatus,
}: BookingReviewButtonProps) {
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Always allow completed bookings. For confirmed, require booking date to be in the past.
  const normalizedStatus = (bookingStatus || '').trim().toLowerCase()
  const bookingTime = new Date(bookingDate).getTime()
  const isPastBooking = Number.isFinite(bookingTime) ? bookingTime < Date.now() : false
  const canReviewStatus = normalizedStatus === 'completed' || (normalizedStatus === 'confirmed' && isPastBooking)

  if (!canReviewStatus) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setShowReviewModal(true)}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors text-sm font-medium w-full"
      >
        <Star className="w-4 h-4" />
        Write Review
      </button>

      <ReviewModal
        courtId={courtId}
        courtName={courtName}
        venueName={venueName}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          setShowReviewModal(false)
          // Optionally show a success message or redirect
        }}
      />
    </>
  )
}
