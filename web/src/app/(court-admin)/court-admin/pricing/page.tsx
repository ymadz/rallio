'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { PricingManagement } from '@/components/court-admin/pricing-management'

export default function PricingPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  if (!venueId) {
    return <VenueSelector message="Select a venue to manage pricing" />
  }

  return <PricingManagement venueId={venueId} />
}
