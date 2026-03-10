'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { ReviewsManagement } from '@/components/court-admin/reviews-management'

export default function ReviewsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!venueId ? (
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews</h1>
                <p className="text-gray-600">Monitor and respond to customer feedback for your venues.</p>
              </div>
            </div>
          </div>
          <VenueSelector message="Select a venue to manage reviews" actionLabel="Tap to see reviews" />
        </>
      ) : (
        <ReviewsManagement venueId={venueId} />
      )}
    </div>
  )
}
