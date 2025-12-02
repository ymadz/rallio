'use client'

import { useState, useEffect } from 'react'
import { Users, Star } from 'lucide-react'
import { PlayerRatingModal } from './player-rating-modal'
import { getPlayerRatings } from '@/app/actions/rating-actions'

interface Player {
  id: string
  name: string
  avatar?: string | null
}

interface RateOpponentsCardProps {
  matchId: string
  currentUserId: string
  opponents: Player[]
  onAllRated?: () => void
}

export function RateOpponentsCard({
  matchId,
  currentUserId,
  opponents,
  onAllRated,
}: RateOpponentsCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [ratedPlayers, setRatedPlayers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadExistingRatings()
  }, [matchId, currentUserId])

  const loadExistingRatings = async () => {
    setIsLoading(true)
    try {
      const result = await getPlayerRatings({ matchId, raterId: currentUserId })
      if (result.success && result.ratings) {
        const rated = new Set(result.ratings.map((r: any) => r.ratee_id))
        setRatedPlayers(rated)
        
        // Check if all opponents are rated
        if (rated.size === opponents.length) {
          onAllRated?.()
        }
      }
    } catch (error) {
      console.error('Error loading ratings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRatingSuccess = () => {
    if (selectedPlayer) {
      const newRated = new Set(ratedPlayers)
      newRated.add(selectedPlayer.id)
      setRatedPlayers(newRated)
      
      // Check if all opponents are now rated
      if (newRated.size === opponents.length) {
        onAllRated?.()
      }
    }
  }

  const unratedOpponents = opponents.filter((opp) => !ratedPlayers.has(opp.id))

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Don't show if all opponents are rated
  if (unratedOpponents.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Star className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Rate Your Opponents</h3>
            <p className="text-sm text-gray-600">
              Help the community by rating {unratedOpponents.length} player{unratedOpponents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Opponents List */}
        <div className="space-y-3">
          {unratedOpponents.map((opponent) => (
            <button
              key={opponent.id}
              onClick={() => setSelectedPlayer(opponent)}
              className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3">
                {opponent.avatar ? (
                  <img
                    src={opponent.avatar}
                    alt={opponent.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{opponent.name}</p>
                  <p className="text-sm text-gray-500">Tap to rate</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 text-gray-300" />
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Progress */}
        {ratedPlayers.size > 0 && (
          <div className="mt-4 pt-4 border-t border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold text-primary">
                {ratedPlayers.size}/{opponents.length} rated
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(ratedPlayers.size / opponents.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {selectedPlayer && (
        <PlayerRatingModal
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          matchId={matchId}
          player={selectedPlayer}
          onSuccess={handleRatingSuccess}
        />
      )}
    </>
  )
}
