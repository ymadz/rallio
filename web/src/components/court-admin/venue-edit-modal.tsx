'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Phone, Mail, Globe, MapPin, Image as ImageIcon } from 'lucide-react'
import { updateVenue } from '@/app/actions/court-admin-actions'
import { useRouter } from 'next/navigation'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { VenuePhotoUpload } from './venue-photo-upload'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import dynamic from 'next/dynamic'

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

interface VenueEditModalProps {
  venue: {
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
    image_url?: string
    metadata?: any
  }
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function VenueEditModal({ venue, isOpen, onClose, onSuccess }: VenueEditModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [isGalleryUploading, setIsGalleryUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    latitude: '',
    longitude: '',
    image_url: ''
  })

  // Reset form when venue changes
  useEffect(() => {
    if (venue) {
      setFormData({
        name: venue.name || '',
        description: venue.description || '',
        address: venue.address || '',
        city: venue.city || '',
        phone: venue.phone || '',
        email: venue.email || '',
        website: venue.website || '',
        latitude: venue.latitude?.toString() || '',
        longitude: venue.longitude?.toString() || '',
        image_url: venue.image_url || ''
      })
      setGalleryImages(Array.isArray(venue.metadata?.gallery_images)
        ? venue.metadata.gallery_images.filter((image: unknown): image is string => typeof image === 'string' && image.length > 0)
        : [])
    }
  }, [venue])

  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    setIsGalleryUploading(true)
    try {
      const supabase = createClient()
      const uploadedUrls: string[] = []

      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file.type.startsWith('image/')) {
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          continue
        }

        const fileExt = file.name.split('.').pop() || 'jpg'
        const unique = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`
        const fileName = `venues/${venue.id}-${unique}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('venue-images')
          .upload(fileName, file)

        if (uploadError) {
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('venue-images')
          .getPublicUrl(fileName)

        uploadedUrls.push(publicUrl)
      }

      if (uploadedUrls.length > 0) {
        setGalleryImages((prev) => [...prev, ...uploadedUrls])
      }
    } catch (uploadError: any) {
      setError(uploadError.message || 'Failed to upload gallery images')
    } finally {
      setIsGalleryUploading(false)
    }
  }

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const updates: Record<string, any> = {
        name: formData.name,
        description: formData.description || null,
        address: formData.address || null,
        city: formData.city || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        image_url: formData.image_url || null,
        metadata: {
          ...(venue.metadata || {}),
          gallery_images: galleryImages,
        },
      }

      // Only add coordinates if provided
      if (formData.latitude) {
        updates.latitude = parseFloat(formData.latitude)
      }
      if (formData.longitude) {
        updates.longitude = parseFloat(formData.longitude)
      }

      const result = await updateVenue(venue.id, updates)

      if (!result.success) {
        throw new Error(result.error)
      }

      onSuccess?.()
      onClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update venue')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Edit Venue</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Cover Image Upload */}
          <VenuePhotoUpload
            venueId={venue.id}
            currentImage={formData.image_url}
            onImageChange={(url) => setFormData(prev => ({ ...prev, image_url: url || '' }))}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Carousel Images</label>
              {isGalleryUploading && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading...
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {galleryImages.map((imageUrl, index) => (
                <div key={`${imageUrl}-${index}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                  <Image src={imageUrl} alt="Venue gallery" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryImage(index)}
                    className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center transition-colors ${isGalleryUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                <ImageIcon className="w-5 h-5 text-gray-400 mb-0.5" />
                <span className="text-xs text-gray-500">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleGalleryFileSelect}
                  disabled={isGalleryUploading}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">You can add multiple images for the venue carousel. Max 5MB each.</p>
          </div>

          {/* Venue Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sunrise Sports Complex"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
              placeholder="Describe the venue, facilities, and features..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            />
          </div>

          {/* Venue Location Component Group */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Venue Location
              </label>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-dark hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Pick on Map
              </button>
            </div>
            {/* Address with Autocomplete */}
            <div>
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
              />
              <p className="mt-1 text-xs text-gray-500">
                Select from suggestions to auto-fill coordinates
              </p>
            </div>
            {/* Hidden Coordinates */}
            <input type="hidden" value={formData.latitude} />
            <input type="hidden" value={formData.longitude} />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </div>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Contact phone number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Contact email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website
              </div>
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
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
              disabled={isSubmitting || !formData.name}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Map Picker Modal - Z-index higher than Edit Modal */}
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
                  address: address || formData.address
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
