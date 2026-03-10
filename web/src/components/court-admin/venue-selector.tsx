'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { getMyVenues } from '@/app/actions/court-admin-actions'

interface VenueSelectorProps {
  message?: string
  redirectPath?: string
  actionLabel?: string
}

interface Venue {
  id: string
  name: string
  city?: string
  is_active: boolean
}

export function VenueSelector({
  message = "Select a venue to continue",
  redirectPath,
  actionLabel = "Tap to view analytics"
}: VenueSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentVenueId = searchParams.get('venueId')

  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenueId || '')

  const handleVenueChange = (venueId: string) => {
    setSelectedVenueId(venueId)

    if (venueId) {
      // Get current path or use redirectPath
      const currentPath = redirectPath || window.location.pathname
      const newUrl = `${currentPath}?venueId=${venueId}`
      router.push(newUrl)
    }
  }

  useEffect(() => {
    async function loadVenues() {
      const result = await getMyVenues()
      if (result.success && result.venues) {
        setVenues(result.venues)
      }
      setLoading(false)
    }

    loadVenues()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading venues...</p>
        </div>
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Venues Yet</h3>
          <p className="text-gray-500 mb-6">
            You need to create a venue before you can access this feature.
          </p>
          <button
            onClick={() => router.push('/court-admin/venues')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            <span>Create Your First Venue</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {venues.map((venue) => (
          <button
            key={venue.id}
            onClick={() => handleVenueChange(venue.id)}
            className="group relative bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-400 hover:shadow-xl transition-all duration-200 text-left overflow-hidden"
          >
            {/* Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <Building2 className="w-6 h-6 text-teal-600" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {actionLabel}
                </span>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-teal-600 transition-colors">
                  {venue.name}
                </h4>
                {venue.city && (
                  <p className="text-sm text-gray-500">{venue.city}</p>
                )}
              </div>
              
              {/* Arrow indicator */}
              <div className="mt-4 flex items-center text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-sm font-semibold">View Analytics</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
