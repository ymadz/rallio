'use client'

import { useSearchParams } from 'next/navigation'
import { VenueSelector } from '@/components/court-admin/venue-selector'
import { PricingManagement } from '@/components/court-admin/pricing-management'

export default function PricingPage() {
  const searchParams = useSearchParams()
  const venueId = searchParams.get('venueId')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header - only show when no venue is selected */}
      {!venueId && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pricing Management</h1>
          <p className="text-gray-600">Set hourly rates and pricing rules for your courts</p>
        </div>
      )}

      {!venueId ? (
        /* Show venue selector when no venue is selected */
        <div className="mb-8">
          <VenueSelector message="Choose a venue to manage pricing" actionLabel="Tap to manage pricing" />
        </div>
      ) : (
        /* Show pricing management when venue is selected */
        <PricingManagement venueId={venueId} />
      )}
    </div>
  )
}
