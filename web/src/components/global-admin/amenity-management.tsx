'use client'

import { useState, useEffect } from 'react'
import {
  getAllAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity
} from '@/app/actions/global-admin-venue-actions'
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Search
} from 'lucide-react'
import { toast } from 'sonner'

interface Amenity {
  id: string
  name: string
  icon?: string
  description?: string
}

export function AmenityManagement() {
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null)
  const [amenityToDelete, setAmenityToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadAmenities()
  }, [])

  const loadAmenities = async () => {
    setIsLoading(true)
    try {
      const result = await getAllAmenities()
      if (!result.success) {
        throw new Error((result as any).error)
      }
      setAmenities((result as any).amenities || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load amenities')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAmenity = async () => {
    if (!amenityToDelete) return

    const result = await deleteAmenity(amenityToDelete)
    if (result.success) {
      toast.success((result as any).message)
      loadAmenities()
      setShowDeleteModal(false)
      setAmenityToDelete(null)
    } else {
      toast.error((result as any).error)
    }
  }

  const filteredAmenities = amenities.filter(amenity =>
    amenity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    amenity.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Amenity Management</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage court amenities available on the platform
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Amenity
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search amenities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Amenities Grid */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filteredAmenities.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              {searchQuery ? 'No amenities found' : 'No amenities yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {searchQuery ? 'Try adjusting your search' : 'Create your first amenity to get started'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAmenities.map((amenity) => (
                <div
                  key={amenity.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {amenity.icon && (
                        <div className="text-2xl">{amenity.icon}</div>
                      )}
                      <h3 className="font-semibold text-gray-900">{amenity.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedAmenity(amenity)
                          setShowEditModal(true)
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => {
                          setAmenityToDelete(amenity.id)
                          setShowDeleteModal(true)
                        }}
                        className="p-1 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                  {amenity.description && (
                    <p className="text-sm text-gray-600">{amenity.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <AmenityFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadAmenities()
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAmenity && (
        <AmenityFormModal
          amenity={selectedAmenity}
          onClose={() => {
            setShowEditModal(false)
            setSelectedAmenity(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setSelectedAmenity(null)
            loadAmenities()
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Amenity</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this amenity? This will remove it from all courts that currently have it.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setAmenityToDelete(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAmenity}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Amenity Form Modal
function AmenityFormModal({ amenity, onClose, onSuccess }: {
  amenity?: Amenity
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: amenity?.name || '',
    icon: amenity?.icon || '',
    description: amenity?.description || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = amenity
        ? await updateAmenity(amenity.id, formData)
        : await createAmenity(formData)

      if (!result.success) {
        throw new Error((result as any).error)
      }

      toast.success((result as any).message)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save amenity')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {amenity ? 'Edit Amenity' : 'Add New Amenity'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amenity Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Parking, WiFi, Lockers"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon (optional)
            </label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="Emoji or icon identifier"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can use emoji (e.g., 🚗 🚿 💡) or Lucide React icon name
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this amenity..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
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
              {amenity ? 'Update Amenity' : 'Create Amenity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
