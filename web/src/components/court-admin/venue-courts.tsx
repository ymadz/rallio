'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit,
  Eye,
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react'
import Link from 'next/link'
import { getVenueCourts, createCourt, getAvailableAmenities } from '@/app/actions/court-admin-court-actions'

interface Court {
  id: string
  name: string
  surface_type?: string
  court_type?: string
  hourly_rate: number
  is_active: boolean
}

interface VenueCourtsProps {
  venueId: string
}

export function VenueCourts({ venueId }: VenueCourtsProps) {
  const [courts, setCourts] = useState<Court[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [amenities, setAmenities] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    court_type: 'indoor' as 'indoor' | 'outdoor',
    surface_type: 'hardcourt',
    capacity: 4,
    hourly_rate: 500,
    amenities: [] as string[]
  })

  useEffect(() => {
    loadCourts()
    loadAmenities()
  }, [venueId])

  const loadCourts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getVenueCourts(venueId)
      if (!result.success) {
        throw new Error(result.error)
      }
      setCourts(result.courts || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load courts')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAmenities = async () => {
    const result = await getAvailableAmenities()
    if (result.success) {
      setAmenities(result.amenities || [])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await createCourt(venueId, formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadCourts()
      setShowAddModal(false)
      setFormData({
        name: '',
        description: '',
        court_type: 'indoor',
        surface_type: 'hardcourt',
        capacity: 4,
        hourly_rate: 500,
        amenities: []
      })
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900 mb-1">Error Loading Courts</h3>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadCourts}
            className="mt-3 text-sm text-red-700 hover:text-red-900 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Courts</h2>
          <p className="text-sm text-gray-500 mt-1">{courts.length} courts in this venue</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Court</span>
        </button>
      </div>

      {/* Courts Grid */}
      {courts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <h3 className="font-semibold text-gray-900 mb-2">No Courts Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add courts to this venue to start accepting reservations
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Court</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courts.map((court) => (
            <div
              key={court.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">{court.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{court.court_type} Court</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  court.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {court.is_active ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Inactive
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Surface:</span>
                  <span className="font-medium text-gray-900 capitalize">{court.surface_type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Base Rate:</span>
                  <span className="font-semibold text-gray-900">₱{court.hourly_rate}/hr</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <Link
                  href={`/courts/${court.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Court Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Court</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Court 1, Center Court"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Brief description of the court..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court Type *</label>
                  <select
                    required
                    value={formData.court_type}
                    onChange={(e) => setFormData({ ...formData, court_type: e.target.value as 'indoor' | 'outdoor' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type</label>
                  <select
                    value={formData.surface_type}
                    onChange={(e) => setFormData({ ...formData, surface_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="hardcourt">Hardcourt</option>
                    <option value="clay">Clay</option>
                    <option value="grass">Grass</option>
                    <option value="synthetic">Synthetic</option>
                    <option value="rubber">Rubber</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (₱) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Amenities Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Court Amenities
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select amenities available at this court
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {amenities.map((amenity) => (
                    <label
                      key={amenity.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(amenity.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              amenities: [...formData.amenities, amenity.id]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              amenities: formData.amenities.filter(id => id !== amenity.id)
                            })
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{amenity.name}</span>
                    </label>
                  ))}
                  {amenities.length === 0 && (
                    <p className="col-span-2 text-sm text-gray-500 text-center py-4">
                      No amenities available
                    </p>
                  )}
                </div>
                {formData.amenities.length > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    {formData.amenities.length} amenity{formData.amenities.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : 'Create Court'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
