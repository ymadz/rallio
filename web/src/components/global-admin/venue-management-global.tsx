'use client'

import { useState, useEffect } from 'react'
import {
  getAllVenues,
  getVenueDetails,
  createVenue,
  updateVenue,
  deleteVenue,
  toggleVenueActive,
  toggleVenueVerified,
  getVenueCities,
  batchUpdateVenues
} from '@/app/actions/global-admin-venue-actions'
import {
  Building2,
  MapPin,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  MoreVertical,
  Phone,
  Mail,
  Globe,
  User,
  Eye,
  Ban,
  Shield,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { VenueDetailsPanel } from './venue-details-panel'
import { VenueFormModal } from './venue-form-modal'

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
  created_at: string
  court_count: number
  owner?: {
    id: string
    email: string
    display_name: string
  }
}

const statusFilters = [
  { id: 'all', label: 'All Status' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'verified', label: 'Verified' },
  { id: 'unverified', label: 'Unverified' },
]

export function VenueManagementGlobal() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'verified' | 'unverified'>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [cities, setCities] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Batch selection
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set())

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [venueToDelete, setVenueToDelete] = useState<string | null>(null)

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadVenues()
    }, 300)

    return () => clearTimeout(debounce)
  }, [currentPage, searchQuery, statusFilter, cityFilter])

  useEffect(() => {
    loadCities()
  }, [])

  const loadVenues = async () => {
    setLoading(true)
    try {
      const result = await getAllVenues({
        page: currentPage,
        pageSize: 20,
        search: searchQuery || undefined,
        statusFilter,
        cityFilter: cityFilter && cityFilter !== 'all' ? cityFilter : undefined
      })

      if (!result.success) {
        throw new Error((result as any).error)
      }

      setVenues((result as any).venues || [])
      setTotalPages((result as any).totalPages || 1)
      setTotalCount((result as any).total || 0)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load venues')
    } finally {
      setLoading(false)
    }
  }

  const loadCities = async () => {
    const result = await getVenueCities()
    if (result.success) {
      setCities((result as any).cities || [])
    }
  }

  const loadVenueDetails = async (venueId: string) => {
    const result = await getVenueDetails(venueId)
    if (result.success) {
      setSelectedVenue((result as any).venue)
    }
  }

  const handleToggleActive = async (venueId: string, isActive: boolean) => {
    const result = await toggleVenueActive(venueId, !isActive)
    if (result.success) {
      toast.success((result as any).message)
      loadVenues()
      if (selectedVenue?.id === venueId) {
        loadVenueDetails(venueId)
      }
    } else {
      toast.error((result as any).error)
    }
    setOpenDropdown(null)
  }

  const handleToggleVerified = async (venueId: string, isVerified: boolean) => {
    const result = await toggleVenueVerified(venueId, !isVerified)
    if (result.success) {
      toast.success((result as any).message)
      loadVenues()
      if (selectedVenue?.id === venueId) {
        loadVenueDetails(venueId)
      }
    } else {
      toast.error((result as any).error)
    }
    setOpenDropdown(null)
  }

  const handleDeleteVenue = async () => {
    if (!venueToDelete) return

    const result = await deleteVenue(venueToDelete)
    if (result.success) {
      toast.success((result as any).message)
      loadVenues()
      if (selectedVenue?.id === venueToDelete) {
        setSelectedVenue(null)
      }
      setShowDeleteModal(false)
      setVenueToDelete(null)
    } else {
      toast.error((result as any).error)
    }
  }

  const toggleVenueSelection = (venueId: string) => {
    const newSelected = new Set(selectedVenues)
    if (newSelected.has(venueId)) {
      newSelected.delete(venueId)
    } else {
      newSelected.add(venueId)
    }
    setSelectedVenues(newSelected)
  }

  const toggleAllVenues = () => {
    if (selectedVenues.size === venues.length) {
      setSelectedVenues(new Set())
    } else {
      setSelectedVenues(new Set(venues.map(v => v.id)))
    }
  }

  const handleBatchAction = async (action: 'activate' | 'deactivate' | 'verify' | 'unverify' | 'delete') => {
    if (selectedVenues.size === 0) {
      toast.error('No venues selected')
      return
    }

    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${selectedVenues.size} venue(s)?`)) return
    }

    const result = await batchUpdateVenues(Array.from(selectedVenues), action)
    if (result.success) {
      toast.success((result as any).message)
      setSelectedVenues(new Set())
      loadVenues()
    } else {
      toast.error((result as any).error)
    }
  }

  const handleRowClick = (venue: Venue) => {
    loadVenueDetails(venue.id)
  }

  const getStatusBadge = (venue: Venue) => {
    if (!venue.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          <Ban className="w-3 h-3" />
          Inactive
        </span>
      )
    }
    if (venue.is_verified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <Shield className="w-3 h-3" />
          Verified
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        <Clock className="w-3 h-3" />
        Unverified
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venue Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            {selectedVenues.size > 0
              ? `${selectedVenues.size} venue(s) selected`
              : 'Manage all venues and courts on the platform'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedVenues.size > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <button
                onClick={() => handleBatchAction('activate')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-green-700 hover:bg-green-50 rounded"
                title="Activate selected"
              >
                <CheckCircle className="w-4 h-4" />
                Activate
              </button>
              <button
                onClick={() => handleBatchAction('deactivate')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded"
                title="Deactivate selected"
              >
                <Ban className="w-4 h-4" />
                Deactivate
              </button>
              <button
                onClick={() => handleBatchAction('verify')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-700 hover:bg-blue-50 rounded"
                title="Verify selected"
              >
                <Shield className="w-4 h-4" />
                Verify
              </button>
              <button
                onClick={() => handleBatchAction('delete')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Venue
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setStatusFilter('all')
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${statusFilter === 'all'
              ? 'bg-purple-50 text-purple-700 border-2 border-purple-200'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Building2 className="w-4 h-4" />
            All Venues
          </button>
          <button
            onClick={() => {
              setStatusFilter('active')
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${statusFilter === 'active'
              ? 'bg-purple-50 text-purple-700 border-2 border-purple-200'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <CheckCircle className="w-4 h-4" />
            Active
          </button>
          <button
            onClick={() => {
              setStatusFilter('inactive')
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${statusFilter === 'inactive'
              ? 'bg-purple-50 text-purple-700 border-2 border-purple-200'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Ban className="w-4 h-4" />
            Inactive
          </button>
          <button
            onClick={() => {
              setStatusFilter('verified')
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${statusFilter === 'verified'
              ? 'bg-purple-50 text-purple-700 border-2 border-purple-200'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Shield className="w-4 h-4" />
            Verified
          </button>
          <button
            onClick={() => {
              setStatusFilter('unverified')
              setCurrentPage(1)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${statusFilter === 'unverified'
              ? 'bg-purple-50 text-purple-700 border-2 border-purple-200'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Clock className="w-4 h-4" />
            Unverified
          </button>
        </div>

        {/* City Dropdown */}
        <div className="relative">
          <select
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white cursor-pointer min-w-[140px]"
          >
            <option value="all">All Cities</option>
            {cities.map((filter) => (
              <option key={filter} value={filter}>
                {filter}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing {venues.length} of {totalCount} venues
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">No venues found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchQuery || statusFilter !== 'all' || cityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first venue to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedVenues.size === venues.length && venues.length > 0}
                        onChange={toggleAllVenues}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {venues.map((venue, index) => (
                    <tr key={venue.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedVenues.has(venue.id)}
                          onChange={() => toggleVenueSelection(venue.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-6 py-4" onClick={() => handleRowClick(venue)}>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{venue.name}</div>
                          {venue.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {venue.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={() => handleRowClick(venue)}>
                        {venue.owner ? (
                          <div>
                            <div className="text-sm text-gray-900">{venue.owner.display_name}</div>
                            <div className="text-xs text-gray-500">{venue.owner.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No owner</span>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={() => handleRowClick(venue)}>
                        <div className="text-sm text-gray-900">{venue.city || 'N/A'}</div>
                        {venue.address && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">{venue.address}</div>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={() => handleRowClick(venue)}>
                        <span className="text-sm text-gray-600">{venue.court_count} courts</span>
                      </td>
                      <td className="px-6 py-4" onClick={() => handleRowClick(venue)}>
                        {getStatusBadge(venue)}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === venue.id ? null : venue.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-400" />
                          </button>

                          {openDropdown === venue.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenDropdown(null)}
                              />
                              <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 ${index >= venues.length - 2 ? 'bottom-full mb-1' : 'mt-1'
                                }`}>
                                <button
                                  onClick={() => {
                                    loadVenueDetails(venue.id)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Details
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedVenue(venue)
                                    setShowEditModal(true)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit Venue
                                </button>
                                <button
                                  onClick={() => handleToggleActive(venue.id, venue.is_active)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {venue.is_active ? (
                                    <>
                                      <Ban className="w-4 h-4" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Activate
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleToggleVerified(venue.id, venue.is_verified)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {venue.is_verified ? (
                                    <>
                                      <XCircle className="w-4 h-4" />
                                      Unverify
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-4 h-4" />
                                      Verify
                                    </>
                                  )}
                                </button>
                                <div className="my-1 border-t border-gray-200" />
                                <button
                                  onClick={() => {
                                    setVenueToDelete(venue.id)
                                    setShowDeleteModal(true)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex-none border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{venues.length > 0 ? ((currentPage - 1) * 20) + 1 : 0}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * 20, totalCount)}</span> of{' '}
                  <span className="font-medium">{totalCount}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Venue Details Panel */}
      {selectedVenue && (
        <VenueDetailsPanel
          venueId={selectedVenue.id}
          onClose={() => setSelectedVenue(null)}
          onRefresh={loadVenues}
          onEdit={(venue) => {
            setSelectedVenue(venue)
            setShowEditModal(true)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Venue</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this venue? This action cannot be undone and will also delete all associated courts and bookings.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setVenueToDelete(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVenue}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Venue Modal */}
      {showCreateModal && (
        <VenueFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadVenues()
          }}
        />
      )}

      {/* Edit Venue Modal */}
      {showEditModal && selectedVenue && (
        <VenueFormModal
          venue={selectedVenue}
          onClose={() => {
            setShowEditModal(false)
            setSelectedVenue(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setSelectedVenue(null)
            loadVenues()
          }}
        />
      )}
    </div>
  )
}
