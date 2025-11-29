'use client'

import { useState, useEffect } from 'react'
import { assignMatchFromQueue } from '@/app/actions/match-actions'
import { X, Users, TrendingUp, Loader2, CheckCircle, Shuffle, Target } from 'lucide-react'

interface MatchAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  waitingPlayers: Array<{
    id: string
    userId: string
    playerName: string
    avatarUrl?: string
    skillLevel: number
    gamesPlayed: number
  }>
  gameFormat: 'singles' | 'doubles' | 'mixed'
  onSuccess?: () => void
}

export function MatchAssignmentModal({
  isOpen,
  onClose,
  sessionId,
  waitingPlayers,
  gameFormat,
  onSuccess,
}: MatchAssignmentModalProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [teamA, setTeamA] = useState<string[]>([])
  const [teamB, setTeamB] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playersNeeded = gameFormat === 'singles' ? 2 : 4

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayers([])
      setTeamA([])
      setTeamB([])
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const togglePlayerSelection = (userId: string) => {
    if (selectedPlayers.includes(userId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== userId))
      setTeamA(teamA.filter(id => id !== userId))
      setTeamB(teamB.filter(id => id !== userId))
    } else if (selectedPlayers.length < playersNeeded) {
      setSelectedPlayers([...selectedPlayers, userId])
    }
  }

  const moveToTeamA = (userId: string) => {
    const playersPerTeam = gameFormat === 'singles' ? 1 : 2
    if (teamA.length < playersPerTeam && !teamA.includes(userId)) {
      setTeamA([...teamA, userId])
      setTeamB(teamB.filter(id => id !== userId))
    }
  }

  const moveToTeamB = (userId: string) => {
    const playersPerTeam = gameFormat === 'singles' ? 1 : 2
    if (teamB.length < playersPerTeam && !teamB.includes(userId)) {
      setTeamB([...teamB, userId])
      setTeamA(teamA.filter(id => id !== userId))
    }
  }

  const autoBalance = () => {
    if (selectedPlayers.length !== playersNeeded) return

    // Sort by skill level for balanced teams
    const sorted = [...selectedPlayers].sort((a, b) => {
      const playerA = waitingPlayers.find(p => p.userId === a)
      const playerB = waitingPlayers.find(p => p.userId === b)
      return (playerB?.skillLevel || 0) - (playerA?.skillLevel || 0)
    })

    if (gameFormat === 'singles') {
      setTeamA([sorted[0]])
      setTeamB([sorted[1]])
    } else {
      // For doubles, alternate high/low skill players
      setTeamA([sorted[0], sorted[3]])
      setTeamB([sorted[1], sorted[2]])
    }
  }

  const handleSubmit = async () => {
    setError(null)

    const playersPerTeam = gameFormat === 'singles' ? 1 : 2
    
    if (teamA.length !== playersPerTeam || teamB.length !== playersPerTeam) {
      setError(`Each team needs ${playersPerTeam} player${playersPerTeam > 1 ? 's' : ''}`)
      return
    }

    setIsSubmitting(true)

    try {
      const result = await assignMatchFromQueue(sessionId, playersNeeded)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create match')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPlayerById = (userId: string) => 
    waitingPlayers.find(p => p.userId === userId)

  const playersPerTeam = gameFormat === 'singles' ? 1 : 2
  const teamsReady = teamA.length === playersPerTeam && teamB.length === playersPerTeam

  // Calculate team balance
  const teamAAvgSkill = teamA.length > 0
    ? teamA.reduce((sum, id) => sum + (getPlayerById(id)?.skillLevel || 0), 0) / teamA.length
    : 0
  const teamBAvgSkill = teamB.length > 0
    ? teamB.reduce((sum, id) => sum + (getPlayerById(id)?.skillLevel || 0), 0) / teamB.length
    : 0
  const skillDifference = Math.abs(teamAAvgSkill - teamBAvgSkill)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create Match</h2>
                <p className="text-white/80 text-sm capitalize">{gameFormat} - Select {playersNeeded} players</p>
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
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* No Players Warning */}
          {waitingPlayers.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-center">
              No players in the waiting queue
            </div>
          )}

          {/* Waiting Players Selection */}
          {waitingPlayers.length > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    Select Players ({selectedPlayers.length}/{playersNeeded})
                  </h3>
                  {selectedPlayers.length === playersNeeded && (
                    <button
                      onClick={autoBalance}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <Shuffle className="w-4 h-4" />
                      Auto Balance
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2">
                  {waitingPlayers.map((player) => {
                    const isSelected = selectedPlayers.includes(player.userId)
                    const inTeamA = teamA.includes(player.userId)
                    const inTeamB = teamB.includes(player.userId)

                    return (
                      <button
                        key={player.userId}
                        onClick={() => togglePlayerSelection(player.userId)}
                        disabled={!isSelected && selectedPlayers.length >= playersNeeded}
                        className={`p-3 border-2 rounded-lg text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          inTeamA
                            ? 'border-blue-500 bg-blue-50'
                            : inTeamB
                            ? 'border-orange-500 bg-orange-50'
                            : isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.playerName}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                              {player.playerName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {player.playerName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Skill: {player.skillLevel}</span>
                          <span className="text-gray-600">{player.gamesPlayed} games</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Team Assignment */}
              {selectedPlayers.length === playersNeeded && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Assign Teams</h3>
                    {teamsReady && (
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          Balance: {skillDifference < 1 ? (
                            <span className="text-green-600 font-medium">Excellent</span>
                          ) : skillDifference < 2 ? (
                            <span className="text-blue-600 font-medium">Good</span>
                          ) : (
                            <span className="text-orange-600 font-medium">Fair</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team A */}
                    <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-blue-900">Team A</h4>
                        <span className="text-sm text-blue-700">
                          Avg Skill: {teamAAvgSkill.toFixed(1)}
                        </span>
                      </div>
                      <div className="space-y-2 min-h-[100px]">
                        {selectedPlayers.map((userId) => {
                          if (!teamA.includes(userId)) {
                            return (
                              <button
                                key={userId}
                                onClick={() => moveToTeamA(userId)}
                                disabled={teamA.length >= playersPerTeam}
                                className="w-full p-2 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors text-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Click to add
                              </button>
                            )
                          }
                          const player = getPlayerById(userId)
                          if (!player) return null
                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 p-2 bg-white border border-blue-200 rounded-lg"
                            >
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.playerName}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
                                  {player.playerName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {player.playerName}
                                </p>
                                <p className="text-xs text-gray-600">Skill: {player.skillLevel}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Team B */}
                    <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-orange-900">Team B</h4>
                        <span className="text-sm text-orange-700">
                          Avg Skill: {teamBAvgSkill.toFixed(1)}
                        </span>
                      </div>
                      <div className="space-y-2 min-h-[100px]">
                        {selectedPlayers.map((userId) => {
                          if (!teamB.includes(userId)) {
                            return (
                              <button
                                key={userId}
                                onClick={() => moveToTeamB(userId)}
                                disabled={teamB.length >= playersPerTeam}
                                className="w-full p-2 border-2 border-dashed border-orange-300 rounded-lg hover:bg-orange-100 transition-colors text-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Click to add
                              </button>
                            )
                          }
                          const player = getPlayerById(userId)
                          if (!player) return null
                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 p-2 bg-white border border-orange-200 rounded-lg"
                            >
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.playerName}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center text-xs font-medium text-orange-700">
                                  {player.playerName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {player.playerName}
                                </p>
                                <p className="text-xs text-gray-600">Skill: {player.skillLevel}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !teamsReady || waitingPlayers.length === 0}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Match...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Create Match
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
