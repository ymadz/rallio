'use client'

import { useState } from 'react'
import { autoAssignMatches } from '@/app/actions/match-actions'
import { X, Users, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface AutoAssignModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  waitingPlayersCount: number
  gameFormat: 'singles' | 'doubles' | 'any'
  onSuccess?: () => void
}

export function AutoAssignModal({
  isOpen,
  onClose,
  sessionId,
  waitingPlayersCount,
  gameFormat,
  onSuccess,
}: AutoAssignModalProps) {
  const [chosenFormat, setChosenFormat] = useState<'singles' | 'doubles'>(
    gameFormat === 'any' ? 'doubles' : gameFormat as 'singles' | 'doubles'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const playersNeeded = chosenFormat === 'singles' ? 2 : 4
  const possibleMatches = Math.floor(waitingPlayersCount / playersNeeded)

  const handleSubmit = async () => {
    setError(null)
    if (possibleMatches === 0) {
      setError(`Need at least ${playersNeeded} players to form a ${chosenFormat} match.`)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await autoAssignMatches(sessionId, chosenFormat)

      if (!result.success) {
        throw new Error(result.error || 'Failed to auto-assign matches')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Auto-Assign Players</h2>
                <p className="text-teal-50/80 text-xs font-medium">Generate matches automatically</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Card */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3">
            <Users className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-teal-900 font-semibold">{waitingPlayersCount} Players Waiting</p>
              <p className="text-xs text-teal-700/80 mt-0.5">
                Matches will be created based on queue order and balanced by skill level.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Format Selection for 'Any' Mode */}
          {gameFormat === 'any' && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 px-1">Choose Match Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChosenFormat('singles')}
                  className={`p-4 border-2 rounded-xl transition-all text-left group ${
                    chosenFormat === 'singles'
                      ? 'border-teal-500 bg-teal-50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                    chosenFormat === 'singles' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <p className={`font-bold text-sm ${chosenFormat === 'singles' ? 'text-teal-900' : 'text-gray-900'}`}>1v1 Singles</p>
                  <p className="text-[10px] text-gray-500 font-medium">Needs 2 players</p>
                </button>
                <button
                  onClick={() => setChosenFormat('doubles')}
                  className={`p-4 border-2 rounded-xl transition-all text-left group ${
                    chosenFormat === 'doubles'
                      ? 'border-teal-500 bg-teal-50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                    chosenFormat === 'doubles' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <p className={`font-bold text-sm ${chosenFormat === 'doubles' ? 'text-teal-900' : 'text-gray-900'}`}>2v2 Doubles</p>
                  <p className="text-[10px] text-gray-500 font-medium">Needs 4 players</p>
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Summary</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                possibleMatches > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {possibleMatches > 0 ? 'Ready to assign' : 'Insufficient players'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Matches to create</span>
                <span className="font-bold text-gray-900">{possibleMatches}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Players assigned</span>
                <span className="font-bold text-gray-900">{possibleMatches * playersNeeded}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-amber-600 pt-2 border-t border-gray-200/60 font-medium">
                <span className="text-xs">Left in queue</span>
                <span className="text-xs">{waitingPlayersCount - (possibleMatches * playersNeeded)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || possibleMatches === 0}
              className="flex-[2] px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 active:scale-95 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm Auto-Assign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
