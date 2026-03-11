'use client'

import { QueuePlayer } from '@/hooks/use-queue'
import { User } from 'lucide-react'

interface PlayerCardProps {
  player: QueuePlayer
  isCurrentUser?: boolean
}

const skillColors = {
  beginner: 'bg-gray-100 text-gray-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
  expert: 'bg-orange-100 text-orange-700',
}

export function PlayerCard({ player, isCurrentUser }: PlayerCardProps) {
  return (
    <div
      className={`
        relative bg-white border rounded-xl p-4 transition-all duration-300
        ${isCurrentUser
          ? 'border-primary shadow-lg scale-105 ring-2 ring-primary/20'
          : 'border-gray-200 hover:shadow-md'
        }
      `}
    >
      {/* Position Badge */}
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
        #{player.position}
      </div>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`
          w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
          ${isCurrentUser ? 'bg-primary' : 'bg-gray-200'}
        `}>
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt={player.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <User className={`w-6 h-6 ${isCurrentUser ? 'text-white' : 'text-gray-500'}`} />
          )}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">
              {player.name}
            </h4>
            {isCurrentUser && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                You
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${skillColors[player.skillTier || 'beginner']}`}>
              {player.skillLevel ? `Lvl ${player.skillLevel} · ` : ''}{player.skillTier || player.skillLevel}
            </span>
            {player.rating && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-semibold rounded-full border border-gray-200">
                {player.rating} ELO
              </span>
            )}
            <span className="text-xs text-gray-500 flex-shrink-0">
              {getTimeAgo(player.joinedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
