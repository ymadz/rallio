'use client'

import { useState } from 'react'
import { Star, Send, Loader2, CheckCircle, X } from 'lucide-react'
import { submitMultipleRatings } from '@/app/actions/rating-actions'

interface Player {
  id: string
  name: string
  avatar_url?: string
}

interface PostMatchRatingProps {
  matchId: string
  opponents: Player[]
  onClose: () => void
  onComplete: () => void
}

export function PostMatchRating({ matchId, opponents, onClose, onComplete }: PostMatchRatingProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStarClick = (playerId: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [playerId]: rating }))
  }

  const handleSubmit = async () => {
    // Validate at least one rating is provided
    if (Object.keys(ratings).length === 0) {
      setError('Please rate at least one opponent')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Build ratings array for server action
      const ratingsToSubmit = Object.entries(ratings).map(([rateeId, rating]) => ({
        matchId,
        rateeId,
        rating,
        feedback: comments[rateeId] || undefined,
      }))

      // Submit all ratings via server action
      const result = await submitMultipleRatings(ratingsToSubmit)

      if (!result.success) {
        setError(result.error || 'Failed to submit ratings')
        return
      }

      // Check if any submissions failed
      if ((result.failCount ?? 0) > 0) {
        const failedRatings = result.results?.filter((r) => !r.success) || []
        const errorMessages = failedRatings
          .map((r) => r.error)
          .filter(Boolean)
          .join(', ')

        setError(`Some ratings failed: ${errorMessages}`)

        // If all failed, don't show completion
        if ((result.successCount ?? 0) === 0) {
          return
        }
      }

      setIsCompleted(true)

      // Close after 2 seconds
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (err: any) {
      console.error('Error submitting ratings:', err)
      setError(err.message || 'Failed to submit ratings')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">Your ratings have been submitted successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rate Your Opponents</h2>
            <p className="text-sm text-gray-600 mt-1">
              Help improve the community by rating your opponents (optional but appreciated)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Ratings */}
        <div className="p-6 space-y-6">
          {opponents.map((opponent) => (
            <div key={opponent.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              {/* Player Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary">
                  {opponent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{opponent.name}</p>
                  <p className="text-xs text-gray-500">Rate their sportsmanship and skill</p>
                </div>
              </div>

              {/* Star Rating */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(opponent.id, star)}
                      className="group transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          ratings[opponent.id] && star <= ratings[opponent.id]
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 group-hover:text-yellow-200'
                        }`}
                      />
                    </button>
                  ))}
                  {ratings[opponent.id] && (
                    <span className="ml-2 text-sm font-semibold text-gray-700">
                      {ratings[opponent.id]} / 5
                    </span>
                  )}
                </div>
              </div>

              {/* Optional Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={comments[opponent.id] || ''}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [opponent.id]: e.target.value }))
                  }
                  placeholder="Share your thoughts about this player..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                />
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">💡 Note:</span> Your ratings are anonymous and help
              maintain fair matchmaking and a positive community.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Skip for Now
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(ratings).length === 0}
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Ratings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
