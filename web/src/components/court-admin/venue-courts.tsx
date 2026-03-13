'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  X,
  Image as ImageIcon
} from 'lucide-react'
import NextImage from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getVenueCourts, createCourt, updateCourt, addCourtImages, deleteCourtImage } from '@/app/actions/court-admin-court-actions'

interface CourtImage {
  id: string
  url: string
  alt_text?: string
  is_primary: boolean
  display_order: number
}

interface Court {
  id: string
  name: string
  description?: string
  surface_type?: string
  court_type?: string
  capacity?: number
  hourly_rate: number
  is_active: boolean
  is_verified: boolean
  court_images?: CourtImage[]
}

interface VenueCourtsProps {
  venueId: string
  onCourtChange?: () => void
}

export function VenueCourts({ venueId, onCourtChange }: VenueCourtsProps) {
  const [courts, setCourts] = useState<Court[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    court_type: 'indoor' as 'indoor' | 'outdoor',
    surface_type: 'hardcourt',
    capacity: 4,
    hourly_rate: 500
  })
  const [editImages, setEditImages] = useState<CourtImage[]>([])
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([])
  const [pendingImagePreviews, setPendingImagePreviews] = useState<string[]>([])
  const [isImageUploading, setIsImageUploading] = useState(false)

  useEffect(() => {
    loadCourts()
  }, [venueId])

  const loadCourts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getVenueCourts(venueId)
      if (!result.success) {
        throw new Error(result.error)
      }

      // Map DB response to Court interface
      const mappedCourts = (result.courts || []).map((c: any) => ({
        ...c
      }))

      setCourts(mappedCourts)
    } catch (err: any) {
      setError(err.message || 'Failed to load courts')
    } finally {
      setIsLoading(false)
    }
  }


  const handleAddPendingImage = (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please upload image files only'); return }
    if (file.size > 5 * 1024 * 1024) { alert('File size must be less than 5MB'); return }
    const preview = URL.createObjectURL(file)
    setPendingImageFiles(prev => [...prev, file])
    setPendingImagePreviews(prev => [...prev, preview])
  }

  const handleRemovePendingImage = (index: number) => {
    URL.revokeObjectURL(pendingImagePreviews[index])
    setPendingImageFiles(prev => prev.filter((_, i) => i !== index))
    setPendingImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadCourtImages = async (courtId: string, files: File[], existingImageCount = 0) => {
    if (files.length === 0) {
      return { success: true, createdImages: [] as CourtImage[] }
    }

    const supabase = createClient()
    const uploaded: Array<{ url: string; displayOrder: number; isPrimary: boolean }> = []

    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      if (!file.type.startsWith('image/')) {
        continue
      }

      const fileExt = file.name.split('.').pop() || 'jpg'
      const unique = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`
      const fileName = `courts/${courtId}-${unique}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('venue-images').upload(fileName, file)
      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data: { publicUrl } } = supabase.storage.from('venue-images').getPublicUrl(fileName)
      uploaded.push({
        url: publicUrl,
        displayOrder: existingImageCount + index,
        isPrimary: existingImageCount === 0 && index === 0,
      })
    }

    if (uploaded.length === 0) {
      return { success: true, createdImages: [] as CourtImage[] }
    }

    const saveResult = await addCourtImages(
      courtId,
      uploaded.map((image) => ({
        url: image.url,
        displayOrder: image.displayOrder,
        isPrimary: image.isPrimary,
      }))
    )

    if (!saveResult.success) {
      throw new Error(saveResult.error)
    }

    return { success: true, createdImages: (saveResult.images || []) as CourtImage[] }
  }

  const handleDeleteEditImage = async (image: CourtImage) => {
    if (!editingCourt || !confirm('Remove this photo?')) return
    try {
      const result = await deleteCourtImage(image.id, editingCourt.id)
      if (!result.success) throw new Error(result.error)
      setEditImages(prev => prev.filter(img => img.id !== image.id))
    } catch (err: any) {
      alert('Failed to remove image: ' + err.message)
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
      // Upload any pending images for the new court
      if (pendingImageFiles.length > 0 && result.court) {
        await uploadCourtImages(result.court.id, pendingImageFiles)
        pendingImagePreviews.forEach(url => URL.revokeObjectURL(url))
        setPendingImageFiles([])
        setPendingImagePreviews([])
      }
      await loadCourts()
      onCourtChange?.()
      setShowAddModal(false)
      setFormData({
        name: '',
        description: '',
        court_type: 'indoor',
        surface_type: 'hardcourt',
        capacity: 4,
        hourly_rate: 500
      })
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = (court: Court) => {
    setEditingCourt(court)
    setEditImages(court.court_images || [])
    setFormData({
      name: court.name,
      description: court.description || '',
      court_type: (court.court_type as 'indoor' | 'outdoor') || 'indoor',
      surface_type: court.surface_type || 'hardcourt',
      capacity: court.capacity || 4,
      hourly_rate: court.hourly_rate
    })
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCourt) return

    setIsSubmitting(true)
    try {
      const result = await updateCourt(editingCourt.id, formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadCourts()
      onCourtChange?.()
      setShowEditModal(false)
      setEditingCourt(null)
      setFormData({
        name: '',
        description: '',
        court_type: 'indoor',
        surface_type: 'hardcourt',
        capacity: 4,
        hourly_rate: 500
      })
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!editingCourt) return

    setIsSubmitting(true)
    try {
      const newStatus = !editingCourt.is_active
      const result = await updateCourt(editingCourt.id, { is_active: newStatus })
      if (!result.success) {
        throw new Error(result.error)
      }

      // Update local state for editingCourt to reflect change immediately if modal stays open
      setEditingCourt({ ...editingCourt, is_active: newStatus })

      await loadCourts()
      onCourtChange?.()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
                <div className="flex gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${court.is_verified
                    ? 'bg-primary/10 text-primary'
                    : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {court.is_verified ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        Pending
                      </>
                    )}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${court.is_active
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
                <button
                  onClick={() => handleEditClick(court)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <Link
                  href={`/courts/${court.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
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
                onClick={() => {
                  setShowAddModal(false)
                  pendingImagePreviews.forEach(url => URL.revokeObjectURL(url))
                  setPendingImageFiles([])
                  setPendingImagePreviews([])
                }}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Court 1, Center Court"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Court Photos */}
              

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    pendingImagePreviews.forEach(url => URL.revokeObjectURL(url))
                    setPendingImageFiles([])
                    setPendingImagePreviews([])
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Edit Court Modal */}
      {showEditModal && editingCourt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Court</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingCourt(null)
                  setEditImages([])
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Court 1, Center Court"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Court Photos */}
              

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingCourt(null)
                    setEditImages([])
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`flex-1 px-4 py-2 border rounded-lg transition-colors flex items-center justify-center gap-2 ${editingCourt.is_active
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    editingCourt.is_active ? 'Deactivate' : 'Activate'
                  )}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </span>
                  ) : 'Update Court'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
