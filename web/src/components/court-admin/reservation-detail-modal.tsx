'use client'

import { useState, useEffect, useRef } from 'react'
import { approveReservation, rejectReservation, markReservationAsPaid, approveReschedule, rejectReschedule, markReservationAsNoShow } from '@/app/actions/court-admin-actions'
import {
  X,
  CheckCircle,
  XCircle,
  UserMinus,
  Clock,
  User,
  MapPin,
  Calendar,
  Banknote,
  Users,
  FileText,
  Loader2,
  CalendarCheck,
  History
} from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
    cancelled_at?: string | null
    cancellation_reason?: string | null
    cash_payment_deadline?: string | null
    metadata?: any
    queue_session?: Array<{
      id: string
      status: string
      organizer_id: string
    }>
  }
}

export function ReservationDetailModal({
  isOpen,
  onClose,
  reservation
}: ReservationDetailModalProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isApprovingReschedule, setIsApprovingReschedule] = useState(false)
  const [isRejectingReschedule, setIsRejectingReschedule] = useState(false)
  const [isMarkingNoShow, setIsMarkingNoShow] = useState(false)
  const [showNoShowModal, setShowNoShowModal] = useState(false)
  const [showRescheduleRejectForm, setShowRescheduleRejectForm] = useState(false)
  const [rescheduleRejectReason, setRescheduleRejectReason] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())

  const rejectFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showRejectForm && rejectFormRef.current) {
      setTimeout(() => {
        rejectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [showRejectForm])

  const paymentMethod = reservation.metadata?.intended_payment_method || reservation.metadata?.payment_method
  const cashDeadline = reservation.cash_payment_deadline || reservation.metadata?.cash_payment_deadline || null
  const shouldShowCashTimer = reservation.status === 'pending_payment' && paymentMethod === 'cash' && !!cashDeadline
  const cancellationReason = reservation.cancellation_reason || reservation.metadata?.cancellation_reason || ''
  const isNoShowReservation =
    reservation.status === 'no_show' ||
    reservation.metadata?.no_show === true ||
    /no[\s-]?show/i.test(cancellationReason)
  const noShowReason = reservation.metadata?.no_show_reason || cancellationReason || 'User did not arrive for the reservation.'
  const noShowMarkedAt = reservation.metadata?.no_show_marked_at || reservation.cancelled_at || null
  const canMarkNoShow = reservation.status === 'partially_paid' || Number(reservation.metadata?.down_payment_amount || 0) > 0
  const pendingPaymentActionCols = canMarkNoShow ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  useEffect(() => {
    if (!shouldShowCashTimer) return

    const timerId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [shouldShowCashTimer])

  useEffect(() => {
    if (!isOpen) {
      setShowNoShowModal(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const customerName = reservation.user?.display_name ||
    `${reservation.user?.first_name || ''} ${reservation.user?.last_name || ''}`.trim() ||
    'Unknown Customer'

  const duration = (new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / (1000 * 60 * 60)
  const remainingMs = shouldShowCashTimer ? new Date(cashDeadline as string).getTime() - nowMs : 0
  const isCashDeadlineExpired = shouldShowCashTimer && remainingMs <= 0

  const formatCountdown = (msRemaining: number) => {
    if (msRemaining <= 0) return '00:00:00'

    const totalSeconds = Math.floor(msRemaining / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')

    if (days > 0) return `${days}d ${hh}:${mm}:${ss}`
    return `${hh}:${mm}:${ss}`
  }

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

  const handleMarkAsPaid = async () => {
    setIsMarkingPaid(true)
    try {
      const result = await markReservationAsPaid(reservation.id)
      if (result.success) {
        onClose()
      } else {
        alert(result.error || 'Failed to mark as paid')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to mark as paid')
    } finally {
      setIsMarkingPaid(false)
    }
  }

  const handleMarkAsNoShow = async () => {
    setIsMarkingNoShow(true)
    try {
      const result = await markReservationAsNoShow(reservation.id)
      if (result.success) {
        setShowNoShowModal(false)
        onClose()
      } else {
        alert(result.error || 'Failed to mark no show')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to mark no show')
    } finally {
      setIsMarkingNoShow(false)
    }
  }

  // Helper to determine display status
  const getDisplayStatus = () => {
    if (isNoShowReservation) {
      return 'no_show'
    }

    // Check for cancelled reservation with reason (implies rejection)
    if (reservation.status === 'cancelled' && cancellationReason) {
      return 'rejected'
    }
    return reservation.status
  }

  const getDisplayStatusLabel = () => {
    const displayStatus = getDisplayStatus()
    if (displayStatus === 'pending_payment' && paymentMethod === 'cash') {
      return 'awaiting cash payment'
    }
    return displayStatus.replace(/_/g, ' ')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'pending_payment': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'partially_paid': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'no_show': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'cancelled':
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'pending_refund': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'refunded': return 'bg-purple-100 text-purple-700 border-purple-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  // Helper to check if approval is needed
  const isPendingApproval = () => {
    // Approval flow is removed — only check for legacy 'pending' status
    if (reservation.status === 'pending_payment') return false
    if (reservation.status === 'pending') return true
    return false
  }

  // Helper to check if reschedule request is pending
  const hasPendingReschedule = () => {
    return reservation.metadata?.reschedule_request?.status === 'pending'
  }

  const handleApproveReschedule = async () => {
    setIsApprovingReschedule(true)
    try {
      const result = await approveReschedule(reservation.id)
      if (result.success) {
        onClose()
      } else {
        alert(result.error || 'Failed to approve reschedule')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to approve reschedule')
    } finally {
      setIsApprovingReschedule(false)
    }
  }

  const handleRejectReschedule = async () => {
    if (!rescheduleRejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    setIsRejectingReschedule(true)
    try {
      const result = await rejectReschedule(reservation.id, rescheduleRejectReason)
      if (result.success) {
        onClose()
      } else {
        alert(result.error || 'Failed to reject reschedule')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to reject reschedule')
    } finally {
      setIsRejectingReschedule(false)
    }
  }

  // Helper to check if payment is pending (includes partially_paid — admin can collect remaining balance)
  const isPendingPayment = () => {
    return reservation.status === 'pending_payment' || reservation.status === 'partially_paid'
  }



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
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
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${getStatusColor(getDisplayStatus())}`}>
                {getDisplayStatus() === 'confirmed' && <CheckCircle className="w-4 h-4" />}
                {(getDisplayStatus() === 'pending' || getDisplayStatus() === 'pending_payment' || getDisplayStatus() === 'partially_paid') && <Clock className="w-4 h-4" />}
                {getDisplayStatus() === 'no_show' && <UserMinus className="w-4 h-4" />}
                {(getDisplayStatus() === 'cancelled' || getDisplayStatus() === 'rejected') && <XCircle className="w-4 h-4" />}
                {getDisplayStatus() === 'pending_refund' && <Clock className="w-4 h-4" />}
                {getDisplayStatus() === 'refunded' && <Banknote className="w-4 h-4" />}
                <span className="capitalize">{getDisplayStatusLabel()}</span>
              </span>
              {reservation.metadata?.is_queue_session_reservation && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-green-50 text-green-700 border border-green-200 text-sm font-medium">
                  Queue
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              Booked {new Date(reservation.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          {isNoShowReservation && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserMinus className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-orange-900">No Show Details</h3>
              </div>
              <p className="text-sm text-orange-800">{noShowReason}</p>
              {noShowMarkedAt && (
                <p className="text-xs text-orange-700 mt-2">
                  Marked at {new Date(noShowMarkedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          )}

          {shouldShowCashTimer && (
            <div
              className={`rounded-xl p-4 border ${isCashDeadlineExpired ? 'border-red-200' : 'border-amber-200'}`}
              style={{
                background: isCashDeadlineExpired
                  ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.45) 0%, rgba(254, 242, 242, 0.45) 100%)'
                  : 'linear-gradient(135deg, rgba(254, 243, 199, 0.45) 0%, rgba(255, 251, 235, 0.45) 100%)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isCashDeadlineExpired ? 'text-red-700' : 'text-amber-700'}`}>
                    Cash Payment Deadline
                  </p>
                  <p className={`text-xs mt-1 ${isCashDeadlineExpired ? 'text-red-600' : 'text-amber-700'}`}>
                    {isCashDeadlineExpired
                      ? 'Deadline passed. This booking will be cancelled if still unpaid.'
                      : `Pay cash at venue before ${new Date(cashDeadline as string).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}`}
                  </p>
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm font-bold tabular-nums ${isCashDeadlineExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                  {formatCountdown(remainingMs)}
                </div>
              </div>
            </div>
          )}

          {/* Pending Reschedule Request — shown at top for visibility */}
          {hasPendingReschedule() && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Reschedule Request</h3>
                <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">Action Needed</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700">Proposed Date:</span>
                  <span className="font-medium text-amber-900">
                    {new Date(reservation.metadata.reschedule_request.proposed_start_time).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700">Proposed Time:</span>
                  <span className="font-medium text-amber-900">
                    {new Date(reservation.metadata.reschedule_request.proposed_start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                    {' - '}
                    {new Date(reservation.metadata.reschedule_request.proposed_end_time).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-200">
                  <span className="text-amber-600">Requested:</span>
                  <span className="text-amber-700">
                    {new Date(reservation.metadata.reschedule_request.requested_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Reschedule Reject Form */}
              {showRescheduleRejectForm && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <textarea
                    value={rescheduleRejectReason}
                    onChange={(e) => setRescheduleRejectReason(e.target.value)}
                    placeholder="Reason for rejecting this reschedule..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-sm"
                    rows={2}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleRejectReschedule}
                      disabled={isRejectingReschedule || !rescheduleRejectReason.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isRejectingReschedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{isRejectingReschedule ? 'Rejecting...' : 'Confirm Reject'}</span>
                    </button>
                    <button
                      onClick={() => { setShowRescheduleRejectForm(false); setRescheduleRejectReason('') }}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reschedule Action Buttons */}
              {!showRescheduleRejectForm && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200">
                  <button
                    onClick={handleApproveReschedule}
                    disabled={isApprovingReschedule}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isApprovingReschedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>{isApprovingReschedule ? 'Approving...' : 'Approve Reschedule'}</span>
                  </button>
                  <button
                    onClick={() => setShowRescheduleRejectForm(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-red-600 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Customer Information</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border border-gray-200">
                  <AvatarImage src={reservation.user?.avatar_url || ''} alt={customerName} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-lg">
                    {customerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Amount Breakdown</h3>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Total Amount:</span>
              <span className="text-xl font-bold text-gray-900">₱{parseFloat(reservation.total_amount).toFixed(2)}</span>
            </div>
            {parseFloat(reservation.amount_paid) > 0 && reservation.status !== 'partially_paid' && (
              <div className="flex justify-between items-center text-sm text-green-600">
                <span>Total Paid:</span>
                <span className="font-medium">₱{parseFloat(reservation.amount_paid).toFixed(2)}</span>
              </div>
            )}

            {reservation.status === 'partially_paid' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-amber-800">Down Payment ({reservation.metadata?.down_payment_percentage || 20}%)</span>
                  <span className="text-amber-700">₱{parseFloat(reservation.metadata?.down_payment_amount || reservation.amount_paid).toFixed(2)} (Paid)</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-amber-200/50">
                  <span className="text-amber-900">Remaining Balance:</span>
                  <span className="text-amber-900">₱{(parseFloat(reservation.total_amount) - parseFloat(reservation.amount_paid || '0')).toFixed(2)}</span>
                </div>
              </div>
            )}

            {reservation.metadata?.payment_method && (
              <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200 capitalize flex justify-between">
                <span>Payment Method:</span>
                <span className="font-medium">{reservation.metadata.payment_method === 'gcash' ? 'GCash' : reservation.metadata.payment_method === 'paymaya' ? 'Maya' : reservation.metadata.payment_method.replace('_', ' ')}</span>
              </div>
            )}
            {!reservation.metadata?.payment_method && reservation.status === 'pending_payment' && (
              <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200 flex justify-between">
                <span>Payment Method:</span>
                <span className="font-medium">Cash (Unpaid)</span>
              </div>
            )}
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

          {/* Reschedule History */}
          {reservation.metadata?.rescheduled === true && reservation.metadata?.rescheduled_from && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-blue-900">Reschedule History</h3>
              </div>
              <div className="relative pl-4 border-l-2 border-blue-200 space-y-4">
                {/* Approved event */}
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                  <div className="text-sm">
                    <span className="font-medium text-green-700">Reschedule Approved</span>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(reservation.metadata.rescheduled_from.rescheduled_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}{' at '}
                      {new Date(reservation.metadata.rescheduled_from.rescheduled_at).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                    </p>
                  </div>
                </div>
                {/* Original schedule */}
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-gray-400 ring-2 ring-white" />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Original Schedule</span>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(reservation.metadata.rescheduled_from.start_time).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      })}{', '}
                      {new Date(reservation.metadata.rescheduled_from.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                      {' - '}
                      {new Date(reservation.metadata.rescheduled_from.end_time).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Reschedule Rejection */}
          {reservation.metadata?.last_reschedule_rejection && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-red-900">Last Reschedule Rejected</h3>
              </div>
              <div className="relative pl-4 border-l-2 border-red-200 space-y-2">
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                  <div className="text-sm">
                    <span className="font-medium text-red-700">Rejected</span>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(reservation.metadata.last_reschedule_rejection.rejected_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}{' at '}
                      {new Date(reservation.metadata.last_reschedule_rejection.rejected_at).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                    </p>
                    <p className="text-red-600 text-xs mt-1 italic">
                      Reason: {reservation.metadata.last_reschedule_rejection.reason}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Refund Info Section */}
          {(reservation.status === 'pending_refund' || reservation.status === 'refunded') && (
            <div className={`border rounded-lg p-4 ${reservation.status === 'pending_refund' ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Banknote className={`w-5 h-5 ${reservation.status === 'pending_refund' ? 'text-orange-500' : 'text-purple-500'}`} />
                <h3 className={`font-semibold ${reservation.status === 'pending_refund' ? 'text-orange-900' : 'text-purple-900'}`}>
                  {reservation.status === 'pending_refund' ? 'Refund Requested' : 'Refund Completed'}
                </h3>
                {reservation.status === 'pending_refund' && (
                  <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 animate-pulse">
                    Action Needed
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={reservation.status === 'pending_refund' ? 'text-orange-700' : 'text-purple-700'}>Amount Paid:</span>
                  <span className="font-medium text-gray-900">₱{parseFloat(reservation.amount_paid).toFixed(2)}</span>
                </div>
                <p className={`text-xs ${reservation.status === 'pending_refund' ? 'text-orange-600' : 'text-purple-600'}`}>
                  {reservation.status === 'pending_refund'
                    ? 'Go to Refund Requests tab to review and process this refund.'
                    : 'This reservation has been refunded.'}
                </p>
              </div>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (isPendingApproval() || isPendingPayment()) && (
            <div ref={rejectFormRef} className="bg-red-50 border border-red-200 rounded-lg p-4">
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
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        {isPendingApproval() && !showRejectForm && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              <span>Reject</span>
            </button>
          </div>
        )}

        {/* Pending Payment Actions */}
        {isPendingPayment() && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3">
            <div className={`grid grid-cols-1 ${pendingPaymentActionCols} gap-2.5`}>
            <button
              onClick={handleMarkAsPaid}
              disabled={isMarkingPaid}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMarkingPaid ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="whitespace-nowrap">Processing...</span>
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" />
                  <span className="whitespace-nowrap">{reservation.status === 'partially_paid' ? 'Collect Remaining Balance' : 'Mark as Paid (Cash Received)'}</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span className="whitespace-nowrap">Reject</span>
            </button>
            {canMarkNoShow && (
              <button
                onClick={() => setShowNoShowModal(true)}
                disabled={isMarkingNoShow}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMarkingNoShow ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="whitespace-nowrap">Marking...</span>
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    <span className="whitespace-nowrap">No Show</span>
                  </>
                )}
              </button>
            )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNoShowModal} onOpenChange={setShowNoShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark user as No Show?</DialogTitle>
            <DialogDescription>
              This will cancel the booking and flag the user in admin users list.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNoShowModal(false)}
              disabled={isMarkingNoShow}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMarkAsNoShow}
              disabled={isMarkingNoShow}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {isMarkingNoShow ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Marking...</span>
                </>
              ) : (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>Confirm No Show</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
