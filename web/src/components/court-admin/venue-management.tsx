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
  Search,
  Filter,
  MoreVertical
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
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadVenues()
  }, [])

  useEffect(() => {
    let result = venues
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.city?.toLowerCase().includes(query) ||
        v.address?.toLowerCase().includes(query)
      )
    }
    setFilteredVenues(result)
  }, [venues, searchQuery])

  const loadVenues = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getMyVenues()
      if (!result.success) {
        throw new Error(result.error)
      }
      setVenues(result.venues || [])

      // No auto-select since we show table
      /* if (result.venues && result.venues.length > 0) {
        handleSelectVenue(result.venues[0])
      } */
    } catch (err: any) {
      setError(err.message || 'Failed to load venues')
    } finally {
      setIsLoading(false)
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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 text-xl">No Venues Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You haven't registered any venues yet. Create your first venue to start managing courts and accepting reservations.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
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
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md">
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Add Venue</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by venue name, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Venues Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venue Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Courts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVenues.map((venue) => {
                const courtCount = venue.courts?.[0]?.count || 0
                return (
                  <tr key={venue.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mr-3">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{venue.name}</span>
                            {venue.is_verified && (
                              <span className="px-1.5 py-0.5 text-[10px] uppercase bg-green-100 text-green-700 rounded-full font-bold">
                                Verified
                              </span>
                            )}
                          </div>
                          {venue.website && (
                            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">
                              Visit Website
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {venue.address && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-900">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {venue.address}
                          </div>
                        )}
                        {venue.city && (
                          <span className="text-sm text-gray-500 ml-5">{venue.city}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {courtCount} {courtCount === 1 ? 'Court' : 'Courts'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${venue.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                        }`}>
                        {venue.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedVenue(venue)
                            setShowEditModal(true)
                          }}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit Venue"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/court-admin/venues/${venue.id}`}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Manage Courts"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
