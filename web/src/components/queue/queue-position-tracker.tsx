'use client'

import { Users, Clock, TrendingUp } from 'lucide-react'

interface QueuePositionTrackerProps {
  position: number
  totalPlayers: number
  estimatedWaitTime: number // in minutes
  gamesPlayed: number
  status: 'waiting' | 'playing' | 'completed'
}

export function QueuePositionTracker({
  position,
  totalPlayers,
  estimatedWaitTime,
  gamesPlayed,
  status,
}: QueuePositionTrackerProps) {
  // Calculate progress percentage
  const progressPercentage = totalPlayers > 0 ? ((totalPlayers - position + 1) / totalPlayers) * 100 : 0

  // Status colors
  const statusColors = {
    waiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    playing: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  const statusLabels = {
    waiting: '⏳ Waiting in Queue',
    playing: '🎮 Currently Playing',
    completed: '✅ Session Complete',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-4 ${statusColors[status]}`}>
        <span className="font-semibold text-sm">{statusLabels[status]}</span>
      </div>

      {status === 'waiting' && (
        <>
          {/* Position Display */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Your Position</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">#{position}</div>
                <div className="text-xs text-gray-500">of {totalPlayers} players</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
              {/* Position Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md transition-all duration-500"
                style={{ left: `calc(${Math.min(progressPercentage, 100)}% - 10px)` }}
              />
            </div>
          </div>

          {/* Estimated Wait Time */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Est. Wait Time</p>
                <p className="font-semibold text-gray-900">
                  {estimatedWaitTime > 0 ? `~${estimatedWaitTime} min` : 'Soon'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Games Played</p>
                <p className="font-semibold text-gray-900">{gamesPlayed}</p>
              </div>
            </div>
          </div>

          {/* Queue Tips */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-700">💡 Tip:</span> Stay ready! You'll be notified when it's your turn to play.
            </p>
          </div>
        </>
      )}

      {status === 'playing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-2xl">🏸</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">You're on the court!</p>
              <p className="text-sm text-gray-600">Give it your best and have fun!</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Games Played Today</span>
            <span className="font-bold text-gray-900">{gamesPlayed}</span>
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🎉</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Great session!</p>
              <p className="text-sm text-gray-600">You played {gamesPlayed} {gamesPlayed === 1 ? 'game' : 'games'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
