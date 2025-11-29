'use client'

import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { QueueStatusBadge } from './queue-status-badge'
import { Users, Clock, MapPin, ChevronRight } from 'lucide-react'

interface QueueCardProps {
  queue: QueueSession
  variant?: 'active' | 'available'
}

export function QueueCard({ queue, variant = 'available' }: QueueCardProps) {
  const isUserInQueue = queue.userPosition !== null

  return (
    <Link 
      href={`/queue/${queue.courtId}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">
              {queue.courtName}
            </h3>
            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              #{queue.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin className="w-4 h-4" />
            <span>{queue.venueName}</span>
          </div>
        </div>
        <QueueStatusBadge status={queue.status} size="sm" />
      </div>

      {/* Queue Info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Players</p>
            <p className="font-semibold text-gray-900">
              {queue.players.length}/{queue.maxPlayers}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Wait Time</p>
            <p className="font-semibold text-gray-900">
              ~{queue.estimatedWaitTime}m
            </p>
          </div>
        </div>
      </div>

      {/* User Position (if in queue) */}
      {variant === 'active' && isUserInQueue && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Your Position</p>
              <p className="text-2xl font-bold text-primary">#{queue.userPosition}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-0.5">Players Ahead</p>
              <p className="text-lg font-semibold text-gray-900">
                {queue.userPosition! - 1}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className={`text-sm font-medium ${isUserInQueue ? 'text-primary' : 'text-gray-600'}`}>
          {variant === 'active' ? 'View Queue' : 'Join Queue'}
        </span>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </Link>
  )
}
