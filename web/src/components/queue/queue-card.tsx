import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { QueueStatusBadge } from './queue-status-badge'
import { Users, Clock, MapPin, ChevronRight, Calendar, Timer } from 'lucide-react'
import { subHours, isBefore, format, differenceInSeconds } from 'date-fns'
import { useEffect, useState } from 'react'
import { useServerTime } from '@/hooks/use-server-time'

interface QueueCardProps {
  queue: QueueSession
  variant?: 'active' | 'available'
}

export function QueueCard({ queue, variant = 'available' }: QueueCardProps) {
  const { date: serverDate } = useServerTime()
  const isUserInQueue = queue.userPosition !== null
  const startTime = queue.startTime ? new Date(queue.startTime) : new Date()
  const endTime = queue.endTime ? new Date(queue.endTime) : (queue.startTime ? new Date(new Date(queue.startTime).getTime() + 2 * 60 * 60 * 1000) : new Date())
  const openTime = subHours(startTime, 2)
  const [timeUntilOpen, setTimeUntilOpen] = useState<number>(0)
  const [isJoinable, setIsJoinable] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = serverDate || new Date()
      if (isBefore(now, openTime)) {
        setTimeUntilOpen(differenceInSeconds(openTime, now))
        setIsJoinable(false)
      } else {
        setTimeUntilOpen(0)
        setIsJoinable(true)
      }
    }, 1000)

    // Initial check
    const now = serverDate || new Date()
    if (isBefore(now, openTime)) {
      setTimeUntilOpen(differenceInSeconds(openTime, now))
      setIsJoinable(false)
    } else {
      setTimeUntilOpen(0)
      setIsJoinable(true)
    }

    return () => clearInterval(timer)
  }, [queue.startTime, serverDate])

  const formatTimeToken = (val: number) => val.toString().padStart(2, '0')
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return ''
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}:${formatTimeToken(m)}:${formatTimeToken(s)}`
  }

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
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{queue.venueName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {format(startTime, 'MMM d')} • {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <QueueStatusBadge status={queue.status} size="sm" />
          {!isJoinable && variant !== 'active' && timeUntilOpen > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
              <Timer className="w-3 h-3" />
              <span className="font-mono">{formatCountdown(timeUntilOpen)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Queue Info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Waiting</p>
            <p className="font-semibold text-gray-900">
              {queue.players.filter(p => p.status === 'waiting').length}/{queue.maxPlayers}
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

      {/* Outstanding Balance Warning (if applicable) */}
      {variant === 'active' && queue.userAmountOwed && queue.userAmountOwed > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs text-orange-700 font-medium">Payment Required</p>
                <p className="text-sm text-orange-600">{queue.userGamesPlayed || 0} games played</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-orange-700">₱{queue.userAmountOwed.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className={`text-sm font-medium ${isUserInQueue ? 'text-primary' : !isJoinable && variant !== 'active' ? 'text-gray-400' : 'text-gray-600'}`}>
          {!isJoinable && variant !== 'active' ? (
            `Opens at ${format(openTime, 'h:mm a')}`
          ) : (
            variant === 'active' ? 'View Queue' : 'Join Queue'
          )}
        </span>
        {!isJoinable && variant !== 'active' ? (
          <Clock className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </Link>
  )
}
