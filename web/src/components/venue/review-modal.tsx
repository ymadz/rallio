'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { SubmitReviewForm } from './submit-review-form'
import { canUserReviewCourt } from '@/app/actions/review-actions'

interface ReviewModalProps {
  courtId: string
  courtName: string
  venueName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ReviewModal({
  courtId,
  courtName,
  venueName,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [canReview, setCanReview] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  const checkEligibility = async () => {
    setIsLoading(true)
    const result = await canUserReviewCourt(courtId)
    setCanReview(result.canReview)
    setReason(result.reason || '')
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      checkEligibility()
    }
  }, [isOpen, courtId])

  const handleSuccess = () => {
    onSuccess?.()
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  if (!isOpen) return null

  const getMessage = () => {
    switch (reason) {
      case 'not_authenticated':
        return 'Please log in to submit a review.'
      case 'no_bookings':
        return 'You can only review courts where you have confirmed bookings.'
      case 'already_reviewed':
        return 'You have already submitted a review for this court.'
      case 'error':
        return 'Unable to verify review eligibility. Please try again.'
      default:
        return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Submit Review</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-gray-600 mt-4">Checking eligibility...</p>
            </div>
          ) : canReview ? (
            <SubmitReviewForm
              courtId={courtId}
              courtName={courtName}
              venueName={venueName}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cannot Submit Review</h3>
              <p className="text-gray-600">{getMessage()}</p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
