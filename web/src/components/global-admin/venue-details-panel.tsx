'use client'

import { useState, useEffect } from 'react'
import {
  getVenueDetails,
  createCourt,
  updateCourt,
  deleteCourt,
  toggleCourtActive,
  toggleCourtVerified,
  getAllAmenities
} from '@/app/actions/global-admin-venue-actions'
import {
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  User,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Shield,
  Ban,
  Clock,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'

interface VenueDetailsPanelProps {
  venueId: string
  onClose: () => void
  onRefresh: () => void
  onEdit?: (venue: any) => void
}

interface Court {
  id: string
  name: string
  description?: string
  surface_type?: string
  court_type: 'indoor' | 'outdoor'
  capacity: number
  hourly_rate: number
  is_active: boolean
  is_verified: boolean
  amenities: Array<{ id: string; name: string; icon?: string }>
  images: any[]
  created_at: string
}

interface Amenity {
  id: string
  name: string
  icon?: string
  description?: string
}

export function VenueDetailsPanel({ venueId, onClose, onRefresh, onEdit }: VenueDetailsPanelProps) {
  const [venue, setVenue] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Court modals
  const [showCreateCourtModal, setShowCreateCourtModal] = useState(false)
  const [showEditCourtModal, setShowEditCourtModal] = useState(false)
  const [showDeleteCourtModal, setShowDeleteCourtModal] = useState(false)
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [courtToDelete, setCourtToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadVenueDetails()
  }, [venueId])

  const loadVenueDetails = async () => {
    setIsLoading(true)
    try {
      const result = await getVenueDetails(venueId)
      if (!result.success) {
        throw new Error((result as any).error)
      }
      setVenue((result as any).venue)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load venue details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleCourtActive = async (courtId: string, isActive: boolean) => {
    const result = await toggleCourtActive(courtId, !isActive)
    if (result.success) {
      toast.success((result as any).message)
      loadVenueDetails()
      onRefresh()
    } else {
      toast.error((result as any).error)
    }
    setOpenDropdown(null)
  }

  const handleToggleCourtVerified = async (courtId: string, isVerified: boolean) => {
    const result = await toggleCourtVerified(courtId, !isVerified)
    if (result.success) {
      toast.success((result as any).message)
      loadVenueDetails()
      onRefresh()
    } else {
      toast.error((result as any).error)
    }
    setOpenDropdown(null)
  }

  const handleDeleteCourt = async () => {
    if (!courtToDelete) return

    const result = await deleteCourt(courtToDelete)
    if (result.success) {
      toast.success((result as any).message)
      loadVenueDetails()
      onRefresh()
      setShowDeleteCourtModal(false)
      setCourtToDelete(null)
    } else {
      toast.error((result as any).error)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  if (!venue) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{venue.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {venue.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                )}
                {!venue.is_active && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    <Ban className="w-3 h-3" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(venue)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Edit Venue
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Venue Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Venue Information</h3>
                  <div className="space-y-3">
                    {venue.description && (
                      <div>
                        <p className="text-sm text-gray-600">{venue.description}</p>
                      </div>
                    )}

                    {venue.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Address</div>
                          <div className="text-sm text-gray-500">{venue.address}</div>
                          <div className="text-sm text-gray-500">{venue.city}</div>
                        </div>
                      </div>
                    )}

                    {venue.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Phone</div>
                          <div className="text-sm text-gray-500">{venue.phone}</div>
                        </div>
                      </div>
                    )}

                    {venue.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Email</div>
                          <div className="text-sm text-gray-500">{venue.email}</div>
                        </div>
                      </div>
                    )}

                    {venue.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Website</div>
                          <a
                            href={venue.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {venue.website}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owner Info */}
                {venue.owner && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Owner Information</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{venue.owner.display_name}</div>
                          <div className="text-sm text-gray-500">{venue.owner.email}</div>
                          {venue.owner.phone && (
                            <div className="text-sm text-gray-500">{venue.owner.phone}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Statistics</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <div className="text-sm font-medium text-blue-900">Total Courts</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{venue.courts?.length || 0}</div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-green-600" />
                      <div className="text-sm font-medium text-green-900">Total Bookings</div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{venue.stats?.totalBookings || 0}</div>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-purple-600" />
                      <div className="text-sm font-medium text-purple-900">Total Revenue</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      ₱{venue.stats?.totalRevenue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Courts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Courts</h3>
                <button
                  onClick={() => setShowCreateCourtModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Court
                </button>
              </div>

              {venue.courts && venue.courts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {venue.courts.map((court: Court) => (
                    <div key={court.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{court.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 capitalize">{court.court_type}</span>
                            {court.surface_type && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-500 capitalize">{court.surface_type}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === court.id ? null : court.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>

                          {openDropdown === court.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenDropdown(null)}
                              />
                              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                                <button
                                  onClick={() => {
                                    setSelectedCourt(court)
                                    setShowEditCourtModal(true)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleCourtActive(court.id, court.is_active)}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {court.is_active ? (
                                    <>
                                      <Ban className="w-3 h-3" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      Activate
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleToggleCourtVerified(court.id, court.is_verified)}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {court.is_verified ? (
                                    <>
                                      <XCircle className="w-3 h-3" />
                                      Unverify
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-3 h-3" />
                                      Verify
                                    </>
                                  )}
                                </button>
                                <div className="border-t border-gray-200" />
                                <button
                                  onClick={() => {
                                    setCourtToDelete(court.id)
                                    setShowDeleteCourtModal(true)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {court.description && (
                        <p className="text-sm text-gray-600 mb-3">{court.description}</p>
                      )}

                      <div className="flex items-center gap-2 mb-3">
                        {court.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            Pending Verification
                          </span>
                        )}
                        {!court.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            <Ban className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-600">
                          Capacity: <span className="font-medium text-gray-900">{court.capacity} players</span>
                        </div>
                        <div className="text-sm font-semibold text-blue-600">
                          ₱{court.hourly_rate}/hr
                        </div>
                      </div>

                      {court.amenities && court.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {court.amenities.map((amenity) => (
                            <span
                              key={amenity.id}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {amenity.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {!court.is_active && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          <Ban className="w-3 h-3" />
                          Inactive
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-gray-200 rounded-lg">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No courts yet</p>
                  <button
                    onClick={() => setShowCreateCourtModal(true)}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Add your first court
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Court Modal */}
      {showCreateCourtModal && (
        <CourtFormModal
          venueId={venueId}
          onClose={() => setShowCreateCourtModal(false)}
          onSuccess={() => {
            setShowCreateCourtModal(false)
            loadVenueDetails()
            onRefresh()
          }}
        />
      )}

      {/* Edit Court Modal */}
      {showEditCourtModal && selectedCourt && (
        <CourtFormModal
          venueId={venueId}
          court={selectedCourt}
          onClose={() => {
            setShowEditCourtModal(false)
            setSelectedCourt(null)
          }}
          onSuccess={() => {
            setShowEditCourtModal(false)
            setSelectedCourt(null)
            loadVenueDetails()
            onRefresh()
          }}
        />
      )}

      {/* Delete Court Confirmation */}
      {showDeleteCourtModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Court</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this court? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteCourtModal(false)
                  setCourtToDelete(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourt}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Court Form Modal Component
function CourtFormModal({ venueId, court, onClose, onSuccess }: {
  venueId: string
  court?: Court
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: court?.name || '',
    description: court?.description || '',
    surface_type: court?.surface_type || '',
    court_type: court?.court_type || 'indoor',
    capacity: court?.capacity || 4,
    hourly_rate: court?.hourly_rate || 0,
    amenity_ids: court?.amenities?.map(a => a.id) || []
  })
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadAmenities()
  }, [])

  const loadAmenities = async () => {
    const result = await getAllAmenities()
    if (result.success) {
      setAmenities((result as any).amenities || [])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = court
        ? await updateCourt(court.id, formData)
        : await createCourt({ ...formData, venue_id: venueId })

      if (!result.success) {
        throw new Error((result as any).error)
      }

      toast.success((result as any).message)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save court')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAmenity = (amenityId: string) => {
    setFormData(prev => ({
      ...prev,
      amenity_ids: prev.amenity_ids.includes(amenityId)
        ? prev.amenity_ids.filter(id => id !== amenityId)
        : [...prev.amenity_ids, amenityId]
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {court ? 'Edit Court' : 'Add New Court'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Court Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Court Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Court 1, Court A"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional court description..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Court Type & Surface */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Court Type *
              </label>
              <select
                value={formData.court_type}
                onChange={(e) => setFormData({ ...formData, court_type: e.target.value as 'indoor' | 'outdoor' })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Surface Type
              </label>
              <input
                type="text"
                value={formData.surface_type}
                onChange={(e) => setFormData({ ...formData, surface_type: e.target.value })}
                placeholder="e.g., Wood, Synthetic"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Capacity & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity (players) *
              </label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                min="1"
                max="10"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hourly Rate (₱) *
              </label>
              <input
                type="number"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amenities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {amenities.map((amenity) => (
                <label
                  key={amenity.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.amenity_ids.includes(amenity.id)}
                    onChange={() => toggleAmenity(amenity.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{amenity.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {court ? 'Update Court' : 'Create Court'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
