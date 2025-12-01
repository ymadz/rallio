'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { AnalyticsDashboard } from '@/components/court-admin/analytics-dashboard'

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  if (!venueId) {
    return <VenueSelector message="Select a venue to view analytics" />
  }

  return <AnalyticsDashboard venueId={venueId} />
}
