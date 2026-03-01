'use client'

import { useState, useEffect } from 'react'
import {
  getPendingQueueApprovals,
  approveQueueSession,
  rejectQueueSession
} from '@/app/actions/court-admin-approval-actions'
import {
  Clock,
  User,
  MapPin,
  Calendar,
  Users,
  PhilippinePeso,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Hourglass,
  TrendingUp,
  MessageSquare,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface QueueApproval {
  id: string
  courtId: string
  courtName: string
  venueId: string
  venueName: string
  organizerId: string
  organizerName: string
  organizerAvatar?: string
  organizerSkillLevel?: string
  organizerRating?: number
  startTime: string
  endTime: string
  mode: string
  gameFormat: string
  maxPlayers: number
  costPerGame: number
  approvalExpiresAt?: string
  createdAt: string
}

export function QueueApprovalsManagement() {
  const { toast } = useToast()
  const [approvals, setApprovals] = useState<QueueApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<QueueApproval | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    loadApprovals()
  }, [])

  const loadApprovals = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getPendingQueueApprovals()
      if (!result.success) {
        throw new Error(result.error)
      }
      setApprovals(result.approvals || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load approvals')
    } finally {
      setIsLoading(false)
    }
  }

  const openApproveModal = (approval: QueueApproval) => {
    setSelectedSession(approval)
    setApprovalNotes('')
    setShowApproveModal(true)
  }

  const openRejectModal = (approval: QueueApproval) => {
    setSelectedSession(approval)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleApprove = async () => {
    if (!selectedSession) return
    
    setProcessingId(selectedSession.id)
    try {
      const result = await approveQueueSession(selectedSession.id, approvalNotes || undefined)
      if (!result.success) {
        throw new Error(result.error)
      }
      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== selectedSession.id))
      toast({
        title: 'Session Approved',
        description: `Queue session at ${selectedSession.courtName} has been approved. The organizer has been notified.`,
      })
      setShowApproveModal(false)
    } catch (err: any) {
      toast({
        title: 'Approval Failed',
        description: err.message || 'Failed to approve session',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!selectedSession || !rejectionReason.trim()) {
      toast({
        title: 'Rejection Reason Required',
        description: 'Please provide a reason for rejecting this session.',
        variant: 'destructive',
      })
      return
    }

    setProcessingId(selectedSession.id)
    try {
      const result = await rejectQueueSession(selectedSession.id, rejectionReason)
      if (!result.success) {
        throw new Error(result.error)
      }
      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== selectedSession.id))
      toast({
        title: 'Session Rejected',
        description: `Queue session at ${selectedSession.courtName} has been rejected. The organizer has been notified.`,
      })
      setShowRejectModal(false)
    } catch (err: any) {
      toast({
        title: 'Rejection Failed',
        description: err.message || 'Failed to reject session',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Queue Session Approvals</h1>
        <p className="text-gray-600">Review and approve queue session requests from Queue Masters</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={loadApprovals}
                className="mt-2 text-sm text-red-700 underline hover:text-red-900"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">No pending queue session approvals at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const startDate = new Date(approval.startTime)
            const endDate = new Date(approval.endTime)
            const hoursUntilExpiration = approval.approvalExpiresAt 
              ? (new Date(approval.approvalExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
              : 48
            const isUrgent = hoursUntilExpiration <= 12

            return (
              <div
                key={approval.id}
                className={`bg-white border rounded-xl p-6 ${
                  isUrgent ? 'border-orange-300 shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {approval.venueName} - {approval.courtName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <User className="w-4 h-4" />
                      <span>
                        Organized by: <strong>{approval.organizerName}</strong>
                      </span>
                      {approval.organizerSkillLevel && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {approval.organizerSkillLevel}
                        </span>
                      )}
                      {approval.organizerRating && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          <TrendingUp className="w-3 h-3" />
                          {approval.organizerRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isUrgent && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0">
                      <Hourglass className="w-3 h-3" />
                      Expires in {Math.floor(hoursUntilExpiration)}h
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {startDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {startDate.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} - {endDate.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">Max {approval.maxPlayers} players</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <PhilippinePeso className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">₱{approval.costPerGame}/game</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                    {approval.mode}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {approval.gameFormat}
                  </span>
                  <span className="text-xs text-gray-500">
                    Requested {new Date(approval.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openApproveModal(approval)}
                    disabled={processingId === approval.id}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Session
                  </button>
                  <button
                    onClick={() => openRejectModal(approval)}
                    disabled={processingId === approval.id}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Session
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Approve Queue Session</h3>
                <p className="text-sm text-gray-600">
                  {selectedSession.venueName} - {selectedSession.courtName}
                </p>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-900 mb-1">
                    This will make the session live and visible to players
                  </p>
                  <p className="text-sm text-green-700">
                    The organizer will be notified immediately and players can start joining the queue.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Approval Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g., Please arrive 10 minutes early for setup..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                These notes will be sent to the organizer
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={processingId === selectedSession.id}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === selectedSession.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Reject Queue Session</h3>
                <p className="text-sm text-gray-600">
                  {selectedSession.venueName} - {selectedSession.courtName}
                </p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900 mb-1">
                    This will cancel the session request
                  </p>
                  <p className="text-sm text-red-700">
                    The organizer will be notified with your rejection reason. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Court maintenance scheduled, conflicts with existing booking..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be sent to the organizer
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processingId === selectedSession.id || !rejectionReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === selectedSession.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
