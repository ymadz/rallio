'use client'

import { useState, useEffect } from 'react'
import { recordMatchScore } from '@/app/actions/match-actions'
import { X, Trophy, Users, Loader2, CheckCircle, Plus, Minus } from 'lucide-react'
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

interface Set {
  teamA: number
  teamB: number
  winner: 'team_a' | 'team_b' | null
}

export function ScoreRecordingModal({
  isOpen,
  onClose,
  match,
  sessionId,
  onSuccess,
}: ScoreRecordingModalProps) {
  const [sets, setSets] = useState<Set[]>([
    { teamA: 0, teamB: 0, winner: null },
    { teamA: 0, teamB: 0, winner: null },
    { teamA: 0, teamB: 0, winner: null },
  ])
  const [currentSet, setCurrentSet] = useState(0)
  const [matchWinner, setMatchWinner] = useState<'team_a' | 'team_b' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSets([
        { teamA: 0, teamB: 0, winner: null },
        { teamA: 0, teamB: 0, winner: null },
        { teamA: 0, teamB: 0, winner: null },
      ])
      setCurrentSet(0)
      setMatchWinner(null)
      setError(null)
    }
  }, [isOpen])

  // Calculate match winner based on sets won
  useEffect(() => {
    const teamASets = sets.filter(s => s.winner === 'team_a').length
    const teamBSets = sets.filter(s => s.winner === 'team_b').length

    if (teamASets === 2) {
      setMatchWinner('team_a')
    } else if (teamBSets === 2) {
      setMatchWinner('team_b')
    } else {
      setMatchWinner(null)
    }
  }, [sets])

  if (!isOpen) return null

  const handleScoreChange = (setIndex: number, team: 'teamA' | 'teamB', value: number) => {
    // Don't allow changes to completed sets
    if (sets[setIndex].winner) return

    // Ensure score is valid (0-99)
    const newValue = Math.max(0, Math.min(99, value))

    const newSets = [...sets]
    newSets[setIndex] = {
      ...newSets[setIndex],
      [team]: newValue,
    }

    // Determine set winner (first to 21 with 2-point lead)
    const teamAScore = team === 'teamA' ? newValue : newSets[setIndex].teamA
    const teamBScore = team === 'teamB' ? newValue : newSets[setIndex].teamB

    if (teamAScore >= 21 || teamBScore >= 21) {
      const diff = Math.abs(teamAScore - teamBScore)
      if (diff >= 2) {
        newSets[setIndex].winner = teamAScore > teamBScore ? 'team_a' : 'team_b'

        // Auto-advance to next set if match not over
        const teamASets = newSets.filter(s => s.winner === 'team_a').length
        const teamBSets = newSets.filter(s => s.winner === 'team_b').length

        if (teamASets < 2 && teamBSets < 2 && setIndex < 2) {
          setCurrentSet(setIndex + 1)
        }
      }
    }

    setSets(newSets)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!matchWinner) {
      setError('Match is not complete. A team must win 2 out of 3 sets.')
      return
    }

    setIsSubmitting(true)

    try {
      // Calculate total points across all sets
      const totalScoreA = sets.reduce((sum, set) => sum + set.teamA, 0)
      const totalScoreB = sets.reduce((sum, set) => sum + set.teamB, 0)

      // Create set details for metadata
      const setDetails = sets
        .filter(s => s.winner !== null)
        .map((s, i) => ({
          set: i + 1,
          teamA: s.teamA,
          teamB: s.teamB,
          winner: s.winner,
        }))

      const result = await recordMatchScore(match.id, {
        teamAScore: totalScoreA,
        teamBScore: totalScoreB,
        winner: matchWinner,
        metadata: {
          sets: setDetails,
          setsWon: {
            teamA: sets.filter(s => s.winner === 'team_a').length,
            teamB: sets.filter(s => s.winner === 'team_b').length,
          },
        },
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to record score')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const teamASetsWon = sets.filter(s => s.winner === 'team_a').length
  const teamBSetsWon = sets.filter(s => s.winner === 'team_b').length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/90 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Record Match Score</h2>
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

          {/* Sets Won Counter */}
          <div className="flex items-center justify-center gap-6 pb-4 border-b border-gray-200">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Team A Sets</div>
              <div className={`text-3xl font-bold ${teamASetsWon === 2 ? 'text-green-600' : 'text-gray-900'}`}>
                {teamASetsWon}
              </div>
            </div>
            <div className="text-2xl text-gray-400 font-light">-</div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Team B Sets</div>
              <div className={`text-3xl font-bold ${teamBSetsWon === 2 ? 'text-green-600' : 'text-gray-900'}`}>
                {teamBSetsWon}
              </div>
            </div>
          </div>

          {/* Set Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {sets.map((set, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentSet(index)}
                disabled={index > 0 && !sets[index - 1].winner}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  currentSet === index
                    ? 'text-primary border-b-2 border-primary'
                    : set.winner
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400'
                } disabled:cursor-not-allowed`}
              >
                Set {index + 1}
                {set.winner && (
                  <CheckCircle className="w-4 h-4 text-green-600 absolute top-1 right-1" />
                )}
              </button>
            ))}
          </div>

          {/* Current Set Score */}
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              {sets[currentSet].winner
                ? `Set ${currentSet + 1} Complete`
                : `Set ${currentSet + 1} - First to 21 points (2-point lead required)`}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Team A */}
              <div className={`border-2 rounded-xl p-6 transition-all ${
                sets[currentSet].winner === 'team_a'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Team A</h3>
                  {sets[currentSet].winner === 'team_a' && (
                    <Trophy className="w-5 h-5 text-green-600 ml-auto" />
                  )}
                </div>

                {/* Players */}
                <div className="space-y-2 mb-4">
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

                {/* Score Input */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleScoreChange(currentSet, 'teamA', sets[currentSet].teamA - 1)}
                    disabled={sets[currentSet].winner !== null || sets[currentSet].teamA === 0}
                    className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={sets[currentSet].teamA}
                    onChange={(e) => handleScoreChange(currentSet, 'teamA', parseInt(e.target.value) || 0)}
                    disabled={sets[currentSet].winner !== null}
                    className="w-20 h-16 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleScoreChange(currentSet, 'teamA', sets[currentSet].teamA + 1)}
                    disabled={sets[currentSet].winner !== null}
                    className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Team B */}
              <div className={`border-2 rounded-xl p-6 transition-all ${
                sets[currentSet].winner === 'team_b'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Team B</h3>
                  {sets[currentSet].winner === 'team_b' && (
                    <Trophy className="w-5 h-5 text-green-600 ml-auto" />
                  )}
                </div>

                {/* Players */}
                <div className="space-y-2 mb-4">
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

                {/* Score Input */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleScoreChange(currentSet, 'teamB', sets[currentSet].teamB - 1)}
                    disabled={sets[currentSet].winner !== null || sets[currentSet].teamB === 0}
                    className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={sets[currentSet].teamB}
                    onChange={(e) => handleScoreChange(currentSet, 'teamB', parseInt(e.target.value) || 0)}
                    disabled={sets[currentSet].winner !== null}
                    className="w-20 h-16 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleScoreChange(currentSet, 'teamB', sets[currentSet].teamB + 1)}
                    disabled={sets[currentSet].winner !== null}
                    className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Set History */}
          {sets.some(s => s.winner) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Set History</h4>
              <div className="space-y-2">
                {sets.map((set, index) =>
                  set.winner ? (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Set {index + 1}</span>
                      <div className="flex items-center gap-4">
                        <span className={set.winner === 'team_a' ? 'font-bold text-green-600' : 'text-gray-600'}>
                          {set.teamA}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className={set.winner === 'team_b' ? 'font-bold text-green-600' : 'text-gray-600'}>
                          {set.teamB}
                        </span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Match Winner Display */}
          {matchWinner && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center justify-center gap-3">
              <Trophy className="w-6 h-6 text-green-600" />
              <span className="text-lg font-bold text-green-700">
                {matchWinner === 'team_a' ? 'Team A' : 'Team B'} Wins the Match!
              </span>
              <Trophy className="w-6 h-6 text-green-600" />
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
              disabled={!matchWinner || isSubmitting}
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
                  <span>Record Match Score</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
