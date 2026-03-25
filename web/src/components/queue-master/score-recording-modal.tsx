'use client'

import { useState, useEffect } from 'react'
import { recordMatchScore } from '@/app/actions/match-actions'
import { X, Trophy, Users, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { MatchTimer } from './match-timer'

interface ScoreRecordingModalProps {
  isOpen: boolean
  onClose: () => void
  match: {
    id: string
    matchNumber: number
    gameFormat: string
    status?: string
    started_at?: Date | string | null
    completed_at?: Date | string | null
    teamAPlayers: Array<{ id: string; name: string; avatarUrl?: string }>
    teamBPlayers: Array<{ id: string; name: string; avatarUrl?: string }>
  }
  sessionId: string
  onSuccess?: () => void
}

export function ScoreRecordingModal({
  isOpen,
  onClose,
  match,
  sessionId,
  onSuccess,
}: ScoreRecordingModalProps) {
  const [selectedWinner, setSelectedWinner] = useState<'team_a' | 'team_b' | 'draw' | null>(null)
  const [isForfeit, setIsForfeit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedWinner(null)
      setIsForfeit(false)
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedWinner) {
      setError('Please select a match result.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await recordMatchScore(match.id, {
        winner: selectedWinner,
        metadata: {
          isForfeit,
          recordedAt: new Date().toISOString()
        }
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to record match result')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/90 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Record Match Result</h2>
                <div className="flex items-center gap-3">
                  <p className="text-white/80 text-sm">Match #{match.matchNumber} - {match.gameFormat}</p>
                  {match.started_at && (
                    <div className="text-white/90 text-sm flex items-center gap-1.5">
                      <span>•</span>
                      <MatchTimer
                        startedAt={match.started_at}
                        completedAt={match.completed_at}
                        className="text-white/90"
                        showIcon={true}
                      />
                    </div>
                  )}
                </div>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Match Result Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Team A Option */}
              <button
                type="button"
                onClick={() => setSelectedWinner('team_a')}
                className={`p-6 border-2 rounded-xl transition-all text-left ${
                  selectedWinner === 'team_a'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg mb-2">Team A Wins</h4>
                    <div className="space-y-1">
                      {match.teamAPlayers.map((player) => (
                        <div key={player.id} className="flex items-center gap-2">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-gray-700">{player.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedWinner === 'team_a' && (
                    <Trophy className="w-8 h-8 text-green-600" />
                  )}
                </div>
              </button>

              {/* Team B Option */}
              <button
                type="button"
                onClick={() => setSelectedWinner('team_b')}
                className={`p-6 border-2 rounded-xl transition-all text-left ${
                  selectedWinner === 'team_b'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg mb-2">Team B Wins</h4>
                    <div className="space-y-1">
                      {match.teamBPlayers.map((player) => (
                        <div key={player.id} className="flex items-center gap-2">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center text-xs font-medium text-orange-700">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-gray-700">{player.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedWinner === 'team_b' && (
                    <Trophy className="w-8 h-8 text-green-600" />
                  )}
                </div>
              </button>

              {/* Draw Option */}
              <button
                type="button"
                onClick={() => setSelectedWinner('draw')}
                className={`p-4 border-2 rounded-xl transition-all text-center ${
                  selectedWinner === 'draw'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">=</span>
                  </div>
                  <span className="font-semibold text-gray-900">Draw / Tie</span>
                  {selectedWinner === 'draw' && (
                    <CheckCircle className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Default/Forfeit Toggle */}
          {selectedWinner && selectedWinner !== 'draw' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={isForfeit}
                    onChange={(e) => setIsForfeit(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${isForfeit ? 'text-amber-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${isForfeit ? 'text-amber-900' : 'text-gray-600'}`}>
                    Record as Default / Forfeit
                  </span>
                </div>
              </label>
              {isForfeit && (
                <p className="mt-2 text-[11px] text-amber-700 font-medium leading-relaxed">
                  The {selectedWinner === 'team_a' ? 'Team B' : 'Team A'} players left or defaulted. 
                  Win is awarded to {selectedWinner === 'team_a' ? 'Team A' : 'Team B'}.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedWinner || isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Record Result</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
