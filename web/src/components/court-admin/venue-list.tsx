'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Plus,
  ChevronRight,
  Star,
  TrendingUp,
  Calendar,
  PhilippinePeso,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  X,
  Globe
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { getMyVenues, createVenue } from '@/app/actions/court-admin-actions'
import { createClient } from '@/lib/supabase/client'

const LocationPicker = dynamic(
  () => import('@/components/map/location-picker'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
)

import { VenuePhotoUpload } from '@/components/court-admin/venue-photo-upload'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'

interface Venue {
  id: string
  name: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  is_active: boolean
  is_verified: boolean
  courts?: Array<{ count: number }>
}

export function VenueList() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: 'Zamboanga City',
    phone: '',
    email: '',
    website: '',
    latitude: '',
    longitude: '',
    image_urls: [] as string[]
  })
  const [showMapPicker, setShowMapPicker] = useState(false)


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

      // Fetch user profile to prefill venue contact info
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single()

        setFormData(prev => ({
          ...prev,
          email: user.email || '',
          phone: profile?.phone || ''
        }))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load venues')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Venue name is required')
      return
    }

    setIsCreating(true)
    try {
      // Prepare venue data with proper types
      const venueData: Record<string, any> = {
        name: formData.name,
        description: formData.description || undefined,
        address: formData.address || undefined,
        city: formData.city || 'Zamboanga City',
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        website: formData.website || undefined,
        image_url: formData.image_urls.length > 0 ? formData.image_urls[0] : undefined,
        metadata: { images: formData.image_urls }
      }

      // Add coordinates if provided
      if (formData.latitude) {
        venueData.latitude = parseFloat(formData.latitude)
      }
      if (formData.longitude) {
        venueData.longitude = parseFloat(formData.longitude)
      }

      const result = await createVenue(venueData as any)
      if (!result.success) {
        throw new Error(result.error)
      }
      // Reload venues and reset form safely keeping pre-filled info
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      let userPhone = ''
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
        userPhone = profile?.phone || ''
      }
      setFormData({
        name: '',
        description: '',
        address: '',
        city: 'Zamboanga City',
        phone: userPhone,
        email: user?.email || '',
        website: '',
        latitude: '',
        longitude: '',
        image_urls: []
      })
      setShowCreateModal(false)
      // Reload venues
      await loadVenues()
    } catch (err: any) {
      alert(err.message || 'Failed to create venue')
    } finally {
      setIsCreating(false)
    }
  }

  const totalCourts = venues.reduce((acc, v) => (v.courts?.[0]?.count || 0) + acc, 0)

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Venues</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadVenues}
              className="mt-3 text-sm text-red-700 underline hover:text-red-900"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Venues</h1>
            <p className="text-gray-600">Manage your badminton court venues</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Add Venue</span>
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Venues</p>
                <p className="text-2xl font-bold text-gray-900">{venues.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Courts</p>
                <p className="text-2xl font-bold text-gray-900">{totalCourts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Verified</p>
                <p className="text-2xl font-bold text-gray-900">{venues.filter(v => v.is_verified).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold text-gray-900">{venues.filter(v => !v.is_verified && v.is_active).length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Venues Grid */}
      {venues.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 text-xl">No Venues Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create your first venue to start managing courts and accepting reservations.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create First Venue</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/court-admin/venues/${venue.id}`}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all group"
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
                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
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
                      <p className={`text-sm font-medium ${venue.is_active ? 'text-primary' : 'text-gray-400'
                        }`}>
                        {venue.is_active ? 'Active' : 'Inactive'}
                      </p>
                      <p className={`text-xs font-medium ${venue.is_verified ? 'text-primary' : !venue.is_active ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                        {venue.is_verified ? 'Verified' : !venue.is_active ? 'Not Approved' : 'Pending Verification'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Status</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${venue.is_active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-700'
                    }`}>
                    {venue.is_active ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>Inactive</span>
                      </>
                    )}
                  </span>
                  <span className="text-sm text-primary font-medium group-hover:underline">
                    View Details →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Venue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  Create New Venue
                </h2>
                <p className="text-sm text-gray-600 mt-2 ml-13">Add a new badminton court venue to your portfolio</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateVenue} className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Cover Image Upload */}
              <VenuePhotoUpload
                venueId="new-venue"
                currentImages={formData.image_urls}
                onImagesChange={(urls) => setFormData({ ...formData, image_urls: urls })}
              />

              {/* Venue Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Venue Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sunrise Sports Complex"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your venue facilities, features, and amenities..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none resize-none"
                />
              </div>

              {/* Address with Autocomplete */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(address) => setFormData({ ...formData, address })}
                  onPlaceSelect={(place) => {
                    setFormData({
                      ...formData,
                      address: place.address,
                      city: place.city || formData.city,
                      latitude: place.latitude.toString(),
                      longitude: place.longitude.toString()
                    })
                  }}
                  placeholder="Search for an address..."
                  className="rounded-xl"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Select from suggestions to auto-fill city and coordinates
                </p>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Zamboanga City"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      Phone
                    </div>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+63 912 345 6789"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      Email
                    </div>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@venue.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    Website (Optional)
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.yourwebsite.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                />
              </div>

              {/* Coordinates */}
              {/* Coordinates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">Venue Location</div>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-dark hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    Pick on Map
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="e.g., 6.9214"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="e.g., 122.0790"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !formData.name.trim()}
                  className="inline-flex items-center gap-2 px-8 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create Venue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker Modal - Z-index higher than Create Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full h-[600px] overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-gray-200">
            <LocationPicker
              initialLatitude={formData.latitude ? parseFloat(formData.latitude) : undefined}
              initialLongitude={formData.longitude ? parseFloat(formData.longitude) : undefined}
              onConfirm={(lat, lng, address) => {
                setFormData({
                  ...formData,
                  latitude: lat.toString(),
                  longitude: lng.toString(),
                  address: address || formData.address // Use fetched address if available
                })
                setShowMapPicker(false)
              }}
              onCancel={() => setShowMapPicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
