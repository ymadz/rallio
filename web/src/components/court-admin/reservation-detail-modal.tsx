'use client'

import { useState } from 'react'
import { approveReservation, rejectReservation } from '@/app/actions/court-admin-actions'
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Loader2
} from 'lucide-react'

interface ReservationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: {
    id: string
    court: {
      id: string
      name: string
      venue: {
        id: string
        name: string
      }
    }
    user: {
      id: string
      display_name?: string
      first_name?: string
      last_name?: string
      avatar_url?: string
      phone?: string
    }
    start_time: string
    end_time: string
    status: string
    total_amount: string
    amount_paid: string
    num_players: number
    notes?: string
    created_at: string
  }
}

export function ReservationDetailModal({
  isOpen,
  onClose,
  reservation
}: ReservationDetailModalProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  if (!isOpen) return null

  const customerName = reservation.user?.display_name ||
    `${reservation.user?.first_name || ''} ${reservation.user?.last_name || ''}`.trim() ||
    'Unknown Customer'

  const duration = (new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / (1000 * 60 * 60)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const result = await approveReservation(reservation.id)
      if (result.success) {
        onClose()
      } else {
        alert(result.error || 'Failed to approve reservation')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to approve reservation')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    setIsRejecting(true)
    try {
      const result = await rejectReservation(reservation.id, rejectReason)
      if (result.success) {
        onClose()
      } else {
        alert(result.error || 'Failed to reject reservation')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to reject reservation')
    } finally {
      setIsRejecting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reservation Details</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {reservation.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${getStatusColor(reservation.status)}`}>
              {reservation.status === 'confirmed' && <CheckCircle className="w-4 h-4" />}
              {reservation.status === 'pending' && <Clock className="w-4 h-4" />}
              {reservation.status === 'cancelled' && <XCircle className="w-4 h-4" />}
              <span className="capitalize">{reservation.status}</span>
            </span>
            <span className="text-sm text-gray-500">
              Booked {new Date(reservation.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Customer Information</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{customerName}</div>
                  {reservation.user?.phone && (
                    <div className="text-sm text-gray-500">{reservation.user.phone}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Court & Venue Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Court & Venue</h3>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-gray-900">{reservation.court?.name}</div>
              <div className="text-sm text-gray-500">{reservation.court?.venue?.name}</div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Date & Time</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(reservation.start_time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Start Time:</span>
                <span className="font-medium text-gray-900">
                  {new Date(reservation.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">End Time:</span>
                <span className="font-medium text-gray-900">
                  {new Date(reservation.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">{duration} hour{duration !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Players</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">{reservation.num_players}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Amount</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ₱{parseFloat(reservation.total_amount).toFixed(2)}
              </div>
              {parseFloat(reservation.amount_paid) > 0 && (
                <div className="text-sm text-green-600 mt-1">
                  Paid: ₱{parseFloat(reservation.amount_paid).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {reservation.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Notes</h3>
              </div>
              <p className="text-sm text-gray-700">{reservation.notes}</p>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && reservation.status === 'pending' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Reason for Rejection</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this reservation..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleReject}
                  disabled={isRejecting || !rejectReason.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRejecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {reservation.status === 'pending' && !showRejectForm && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Approve Reservation</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              <span>Reject</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
