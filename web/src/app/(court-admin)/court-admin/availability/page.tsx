'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { AvailabilityManagement } from '@/components/court-admin/availability-management'

export default function AvailabilityPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  if (!venueId) {
    return <VenueSelector message="Select a venue to manage availability" />
  }

  return <AvailabilityManagement venueId={venueId} />
}
