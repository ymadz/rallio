'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { AnalyticsDashboard } from '@/components/court-admin/analytics-dashboard'

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header - only show when no venue is selected */}
      {!venueId && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
          <p className="text-gray-600">Track your venue performance, occupancy rates, and revenue trends</p>
        </div>
      )}

      {!venueId ? (
        /* Show venue selector when no venue is selected */
        <div className="mb-8">
          <VenueSelector message="Choose a venue to view analytics" />
        </div>
      ) : (
        /* Show dashboard when venue is selected */
        <AnalyticsDashboard venueId={venueId} />
      )}
    </div>
  )
}
