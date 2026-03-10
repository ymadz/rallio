'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { getMyVenues } from '@/app/actions/court-admin-actions'

interface VenueSelectorProps {
  message?: string
  actionLabel?: string
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
  actionLabel = 'Tap to view analytics',
  redirectPath
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
      <div className="w-full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Venues Yet</h3>
          <p className="text-gray-500 mb-6">
            You need to create a venue before you can access this feature.
          </p>
          <button
            onClick={() => router.push('/court-admin/venues')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {venues.map((venue) => {
          const isSelected = venue.id === selectedVenueId
          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => handleVenueChange(venue.id)}
              className={`bg-white border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all group w-full text-left ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
              }`}
            >
              {/* Venue Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">
                      {venue.name}
                    </h3>
                    {venue.is_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    ) : !venue.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Not Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Pending Approval
                      </span>
                    )}
                  </div>
                  {!venue.is_verified && venue.is_active && (
                    <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                      ⏳ Your venue is awaiting Global Admin approval. It won't appear in public listings until verified.
                    </p>
                  )}
                  {!venue.is_verified && !venue.is_active && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      ❌ Your venue was not approved. Check notifications for details.
                    </p>
                  )}
                  {venue.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{venue.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="text-xs font-semibold text-primary">Selected</span>
                  )}
                </div>
              </div>

              {/* Venue Info */}
              <div className="space-y-2 mb-4">
                {venue.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{venue.address}</span>
                  </div>
                )}
                {venue.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{venue.phone}</span>
                  </div>
                )}
                {venue.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{venue.email}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{venue.courts?.[0]?.count || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Courts</p>
                  </div>
                  <div className="text-center">
                    <div className="space-y-1">
                      <p className={`text-sm font-medium ${venue.is_active ? 'text-primary' : 'text-gray-400'}`}>
                        {venue.is_active ? 'Active' : 'Inactive'}
                      </p>
                      <p className={`text-xs font-medium ${venue.is_verified ? 'text-primary' : !venue.is_active ? 'text-red-600' : 'text-yellow-600'}`}>
                        {venue.is_verified ? 'Verified' : !venue.is_active ? 'Not Approved' : 'Pending Verification'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Status</p>
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                    {actionLabel}
                  </span>
                  <span className="text-sm text-primary font-medium">
                    View →
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {venues.length > 1 && (
        <p className="text-sm text-gray-500 mt-6">
          Showing {venues.length} venues. Tap a venue to view detailed analytics.
        </p>
      )}
    </div>
  )
}
