'use client'

import { useState, useEffect } from 'react'
import { getMyVenues, getVenueCourts } from '@/app/actions/court-admin-actions'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Plus,
  Edit,
  Eye,
  Loader2,
  AlertCircle,
  ChevronRight,
  PhilippinePeso,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { VenueEditModal } from './venue-edit-modal'

interface Venue {
  id: string
  name: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  latitude?: number
  longitude?: number
  is_active: boolean
  is_verified: boolean
  courts?: { count: number }[]
  created_at: string
}

interface Court {
  id: string
  name: string
  surface_type?: string
  court_type?: string
  hourly_rate: string
  is_active: boolean
}

export function VenueManagement() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [courts, setCourts] = useState<Court[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCourts, setIsLoadingCourts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadVenues()
  }, [])

  const loadVenues = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getMyVenues()
      if (!result.success) {
        throw new Error(result.error)
      }
      setVenues(result.venues || [])

      // Auto-select first venue if available
      if (result.venues && result.venues.length > 0) {
        handleSelectVenue(result.venues[0])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load venues')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVenue = async (venue: Venue) => {
    setSelectedVenue(venue)
    setIsLoadingCourts(true)
    try {
      const result = await getVenueCourts(venue.id)
      if (result.success) {
        setCourts(result.courts || [])
      }
    } catch (err) {
      console.error('Failed to load courts:', err)
    } finally {
      setIsLoadingCourts(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Venues</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadVenues}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 text-xl">No Venues Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You haven't registered any venues yet. Create your first venue to start managing courts and accepting reservations.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-5 h-5" />
            <span>Create Venue</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Venues & Courts</h1>
            <p className="text-gray-600">Manage your venues and court listings</p>
          </div>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md">
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Add Venue</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Venue List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900">My Venues ({venues.length})</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {venues.map((venue) => {
                const courtCount = venue.courts?.[0]?.count || 0
                const isSelected = selectedVenue?.id === venue.id

                return (
                  <button
                    key={venue.id}
                    onClick={() => handleSelectVenue(venue)}
                    className={`w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{venue.name}</h3>
                          {venue.is_verified && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                              Verified
                            </span>
                          )}
                        </div>
                        {venue.city && (
                          <p className="text-sm text-gray-500 mb-2">{venue.city}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{courtCount} court{courtCount !== 1 ? 's' : ''}</span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            venue.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {venue.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 mt-1 ${
                        isSelected ? 'text-blue-600' : ''
                      }`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Venue Details & Courts */}
        <div className="lg:col-span-2">
          {selectedVenue ? (
            <div className="space-y-6">
              {/* Venue Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{selectedVenue.name}</h2>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Venue</span>
                  </button>
                </div>

                {selectedVenue.description && (
                  <p className="text-gray-600 mb-4">{selectedVenue.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedVenue.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Address</div>
                        <div className="text-sm text-gray-500">{selectedVenue.address}</div>
                      </div>
                    </div>
                  )}

                  {selectedVenue.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Phone</div>
                        <div className="text-sm text-gray-500">{selectedVenue.phone}</div>
                      </div>
                    </div>
                  )}

                  {selectedVenue.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Email</div>
                        <div className="text-sm text-gray-500">{selectedVenue.email}</div>
                      </div>
                    </div>
                  )}

                  {selectedVenue.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Website</div>
                        <a
                          href={selectedVenue.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {selectedVenue.website}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Courts List */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Courts ({courts.length})
                  </h2>
                  <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span>Add Court</span>
                  </button>
                </div>

                {isLoadingCourts ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : courts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">No Courts Yet</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Add courts to this venue to start accepting reservations
                    </p>
                    <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                      <Plus className="w-4 h-4" />
                      <span>Add Your First Court</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {courts.map((court) => (
                      <div
                        key={court.id}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{court.name}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                court.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {court.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {court.court_type && (
                                <span className="capitalize">{court.court_type}</span>
                              )}
                              {court.surface_type && (
                                <span className="capitalize">{court.surface_type}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <PhilippinePeso className="w-4 h-4" />
                                ₱{parseFloat(court.hourly_rate).toFixed(2)}/hr
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                            <Link
                              href={`/courts/${court.id}`}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a venue to view details and courts</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Venue Modal */}
      {selectedVenue && (
        <VenueEditModal
          venue={selectedVenue}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            loadVenues()
            // Update selected venue with new data
            const updatedVenue = venues.find(v => v.id === selectedVenue.id)
            if (updatedVenue) {
              setSelectedVenue(updatedVenue)
            }
          }}
        />
      )}
    </div>
  )
}
