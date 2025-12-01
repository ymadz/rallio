'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown } from 'lucide-react'
import { getMyVenues } from '@/app/actions/court-admin-actions'

interface VenueSelectorProps {
  message?: string
  redirectPath?: string
}

interface Venue {
  id: string
  name: string
  city?: string
  is_active: boolean
}

export function VenueSelector({
  message = "Select a venue to continue",
  redirectPath
}: VenueSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentVenueId = searchParams.get('venueId')

  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenueId || '')

  useEffect(() => {
    async function loadVenues() {
      const result = await getMyVenues()
      if (result.success && result.venues) {
        setVenues(result.venues)

        // If only one venue, auto-select it
        if (result.venues.length === 1 && !currentVenueId) {
          const venueId = result.venues[0].id
          setSelectedVenueId(venueId)
          handleVenueChange(venueId)
        }
      }
      setLoading(false)
    }

    loadVenues()
  }, [])

  const handleVenueChange = (venueId: string) => {
    setSelectedVenueId(venueId)

    if (venueId) {
      // Get current path or use redirectPath
      const currentPath = redirectPath || window.location.pathname
      const newUrl = `${currentPath}?venueId=${venueId}`
      router.push(newUrl)
    }
  }

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
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md w-full px-4">
        <Building2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{message}</h3>
        <p className="text-gray-500 mb-6">
          Choose a venue to view and manage its data.
        </p>

        <div className="relative">
          <select
            value={selectedVenueId}
            onChange={(e) => handleVenueChange(e.target.value)}
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg appearance-none cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-left"
          >
            <option value="">Select a venue...</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} {venue.city ? `- ${venue.city}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {venues.length > 0 && (
          <p className="text-sm text-gray-500 mt-4">
            You have {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
          </p>
        )}
      </div>
    </div>
  )
}
