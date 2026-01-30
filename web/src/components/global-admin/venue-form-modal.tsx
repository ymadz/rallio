'use client'

import { useState, useEffect } from 'react'
import {
  createVenue,
  updateVenue
} from '@/app/actions/global-admin-venue-actions'
import { getAllUsers } from '@/app/actions/global-admin-user-actions'
import {
  X,
  Loader2,
  Search,
  Phone,
  Mail,
  Globe,
  User
} from 'lucide-react'
import { toast } from 'sonner'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'

interface VenueFormModalProps {
  venue?: any
  onClose: () => void
  onSuccess: () => void
}

export function VenueFormModal({ venue, onClose, onSuccess }: VenueFormModalProps) {
  const [formData, setFormData] = useState({
    owner_id: venue?.owner?.id || '',
    name: venue?.name || '',
    description: venue?.description || '',
    address: venue?.address || '',
    city: venue?.city || 'Zamboanga City',
    phone: venue?.phone || '',
    email: venue?.email || '',
    website: venue?.website || '',
    latitude: venue?.latitude || '',
    longitude: venue?.longitude || ''
  })

  const [users, setUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (showUserDropdown) {
      loadUsers()
    }
  }, [userSearch, showUserDropdown])

  const loadUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const result = await getAllUsers({
        page: 1,
        pageSize: 20,
        search: userSearch || undefined,
        roleFilter: 'court_admin'
      })
      if (result.success) {
        setUsers((result as any).users || [])
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const selectedUser = users.find(u => u.id === formData.owner_id) ||
    (venue?.owner ? { id: venue.owner.id, display_name: venue.owner.display_name, email: venue.owner.email } : null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const submitData = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude as any) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude as any) : undefined
      }

      const result = venue
        ? await updateVenue(venue.id, submitData)
        : await createVenue(submitData)

      if (!result.success) {
        throw new Error((result as any).error)
      }

      toast.success((result as any).message)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save venue')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {venue ? 'Edit Venue' : 'Add New Venue'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Owner Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Owner *
            </label>
            <div className="relative">
              <div
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
              >
                {selectedUser ? (
                  <div>
                    <div className="font-medium text-gray-900">{selectedUser.display_name}</div>
                    <div className="text-sm text-gray-500">{selectedUser.email}</div>
                  </div>
                ) : (
                  <div className="text-gray-500">Select an owner...</div>
                )}
              </div>

              {showUserDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserDropdown(false)}
                  />
                  <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search users..."
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {/* User List */}
                    <div className="overflow-y-auto max-h-48">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                      ) : users.length === 0 ? (
                        <div className="text-center py-4 text-sm text-gray-500">
                          No users found
                        </div>
                      ) : (
                        users.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, owner_id: user.id })
                              setShowUserDropdown(false)
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{user.display_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Venue Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sunrise Sports Complex"
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
              placeholder="Describe the venue, facilities, and features..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Address with Autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
            />
            <p className="mt-1 text-xs text-gray-500">
              Select from suggestions to auto-fill city and coordinates
            </p>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="e.g., 6.9214"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="e.g., 122.0790"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
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
              disabled={isSubmitting || !formData.owner_id}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {venue ? 'Update Venue' : 'Create Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
