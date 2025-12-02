'use client'

import { useState, useEffect } from 'react'
import {
  getAllVenues,
  toggleVenueVerified,
  getVenueDetails
} from '@/app/actions/global-admin-venue-actions'
import { createNotification } from '@/app/actions/notification-actions'
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  Phone,
  Mail,
  Globe,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface PendingVenue {
  id: string
  name: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  website?: string
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

interface Props {
  onApprovalComplete?: () => void
}

export function PendingVenueApprovals({ onApprovalComplete }: Props) {
  const [venues, setVenues] = useState<PendingVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedVenue, setExpandedVenue] = useState<string | null>(null)
  const [venueDetails, setVenueDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  useEffect(() => {
    loadPendingVenues()
  }, [])

  const loadPendingVenues = async () => {
    setLoading(true)
    try {
      const result = await getAllVenues({
        statusFilter: 'unverified',
        pageSize: 50
      })

      if (!result.success) {
        throw new Error('error' in result ? result.error : 'Failed to load venues')
      }

      if ('venues' in result) {
        setVenues(result.venues || [])
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load pending venues')
    } finally {
      setLoading(false)
    }
  }

  const loadVenueDetails = async (venueId: string) => {
    if (expandedVenue === venueId) {
      setExpandedVenue(null)
      setVenueDetails(null)
      return
    }

    setExpandedVenue(venueId)
    setLoadingDetails(true)
    try {
      const result = await getVenueDetails(venueId)
      if (result.success && 'venue' in result) {
        setVenueDetails(result.venue)
      }
    } catch (error) {
      console.error('Failed to load venue details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleApprove = async (venue: PendingVenue) => {
    setProcessingId(venue.id)
    try {
      const result = await toggleVenueVerified(venue.id, true)
      if (result.success) {
        toast.success(`${venue.name} has been approved and is now visible to users!`)
        
        // Send notification to venue owner
        if (venue.owner?.id) {
          await createNotification({
            userId: venue.owner.id,
            type: 'system_announcement',
            title: '🎉 Venue Approved!',
            message: `Great news! Your venue "${venue.name}" has been verified and is now live on Rallio. Players can now discover and book your courts.`,
            actionUrl: '/court-admin/venues'
          })
        }
        
        loadPendingVenues()
        onApprovalComplete?.()
      } else {
        toast.error('error' in result ? result.error : 'Failed to approve venue')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve venue')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (venue: PendingVenue) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setProcessingId(venue.id)
    try {
      // For rejection, we keep is_verified as false and set is_active to false
      const result = await toggleVenueVerified(venue.id, false)
      if (result.success) {
        toast.success(`${venue.name} has been rejected`)
        
        // Send notification to venue owner
        if (venue.owner?.id) {
          await createNotification({
            userId: venue.owner.id,
            type: 'system_announcement',
            title: '❌ Venue Not Approved',
            message: `Your venue "${venue.name}" was not approved. Reason: ${rejectionReason}. Please update your venue details and resubmit for approval.`,
            actionUrl: '/court-admin/venues'
          })
        }
        
        setShowRejectModal(null)
        setRejectionReason('')
        loadPendingVenues()
        onApprovalComplete?.()
      } else {
        toast.error('error' in result ? result.error : 'Failed to reject venue')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject venue')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-2 text-xl">All Caught Up!</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          There are no venues pending approval at this time. New venue submissions will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pending Venue Approvals</h2>
          <p className="text-sm text-gray-600 mt-1">
            {venues.length} venue{venues.length !== 1 ? 's' : ''} awaiting your review
          </p>
        </div>
      </div>

      {/* Pending Venues List */}
      <div className="space-y-4">
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="bg-white border border-yellow-200 rounded-xl overflow-hidden shadow-sm"
          >
            {/* Venue Header */}
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{venue.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        Submitted {formatDistanceToNow(new Date(venue.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {/* Venue Info */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {venue.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {venue.address}, {venue.city}
                      </div>
                    )}
                    {venue.owner && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        {venue.owner.display_name || venue.owner.email}
                      </div>
                    )}
                    {venue.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {venue.phone}
                      </div>
                    )}
                    {venue.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {venue.email}
                      </div>
                    )}
                  </div>

                  {venue.description && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">{venue.description}</p>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {venue.court_count} court{venue.court_count !== 1 ? 's' : ''}
                    </span>
                    {venue.website && (
                      <a
                        href={venue.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(venue)}
                    disabled={processingId === venue.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {processingId === venue.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectModal(venue.id)}
                    disabled={processingId === venue.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => loadVenueDetails(venue.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {expandedVenue === venue.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    {expandedVenue === venue.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedVenue === venue.id && (
              <div className="border-t border-yellow-200 bg-yellow-50 p-6">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-yellow-600" />
                  </div>
                ) : venueDetails ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Courts ({venueDetails.courts?.length || 0})</h4>
                    {venueDetails.courts && venueDetails.courts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {venueDetails.courts.map((court: any) => (
                          <div key={court.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <h5 className="font-medium text-gray-900">{court.name}</h5>
                            <div className="mt-2 text-sm text-gray-600 space-y-1">
                              <p>Type: {court.court_type || 'N/A'}</p>
                              <p>Surface: {court.surface_type || 'N/A'}</p>
                              <p>Rate: ₱{court.hourly_rate}/hr</p>
                              <p>Capacity: {court.capacity} players</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No courts added yet</p>
                    )}

                    {/* Opening Hours */}
                    {venueDetails.opening_hours && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Opening Hours</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {Object.entries(venueDetails.opening_hours).map(([day, hours]: [string, any]) => (
                            <div key={day} className="bg-white p-2 rounded border border-gray-200">
                              <span className="font-medium capitalize">{day}:</span>{' '}
                              {hours?.open && hours?.close ? `${hours.open} - ${hours.close}` : 'Closed'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Failed to load details</p>
                )}
              </div>
            )}

            {/* Rejection Modal */}
            {showRejectModal === venue.id && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Reject Venue</h3>
                      <p className="text-sm text-gray-500">This will notify the owner</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please provide a reason for rejection..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowRejectModal(null)
                        setRejectionReason('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(venue)}
                      disabled={processingId === venue.id || !rejectionReason.trim()}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingId === venue.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
