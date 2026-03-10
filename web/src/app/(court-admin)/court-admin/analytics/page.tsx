'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { AnalyticsDashboard } from '@/components/court-admin/analytics-dashboard'

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!venueId ? (
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
                <p className="text-gray-600">View revenue and performance insights for your venues.</p>
              </div>
            </div>
          </div>
          <VenueSelector message="Select a venue to view analytics" />
        </>
      ) : (
        <AnalyticsDashboard venueId={venueId} />
      )}
    </div>
  )
}
