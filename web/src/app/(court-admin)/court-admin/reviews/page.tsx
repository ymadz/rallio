'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { ReviewsManagement } from '@/components/court-admin/reviews-management'

export default function ReviewsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header - only show when no venue is selected */}
      {!venueId && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Reviews</h1>
          <p className="text-gray-600">Monitor and respond to customer feedback</p>
        </div>
      )}

      {!venueId ? (
        /* Show venue selector when no venue is selected */
        <div className="mb-8">
          <VenueSelector message="Choose a venue to manage reviews" actionLabel="Tap to view reviews" />
        </div>
      ) : (
        /* Show reviews management when venue is selected */
        <ReviewsManagement venueId={venueId} />
      )}
    </div>
  )
}
