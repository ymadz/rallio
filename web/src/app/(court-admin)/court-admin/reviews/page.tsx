'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { ReviewsManagement } from '@/components/court-admin/reviews-management'

export default function ReviewsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  if (!venueId) {
    return <VenueSelector message="Select a venue to manage reviews" />
  }

  return <ReviewsManagement venueId={venueId} />
}
