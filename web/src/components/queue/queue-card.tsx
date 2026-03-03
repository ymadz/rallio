'use client'

import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { QueueStatusBadge } from './queue-status-badge'
import { Users, Clock, MapPin, ChevronRight, Timer, Zap } from 'lucide-react'
import { subHours, isBefore, format, differenceInSeconds } from 'date-fns'
import { useEffect, useState } from 'react'
import { useServerTime } from '@/hooks/use-server-time'

interface QueueCardProps {
  queue: QueueSession
  variant?: 'active' | 'available'
}

/** Overlapping circular avatar stack — shows up to 4, then a +N pill */
function AvatarStack({ players, max = 4 }: { players: QueueSession['players']; max?: number }) {
  const visible = players.slice(0, max)
  const overflow = players.length - max

  if (players.length === 0) return null

  return (
    <div className="flex items-center">
      {visible.map((p, i) => (
        <div
          key={p.id}
          className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center overflow-hidden"
          style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: max - i }}
          title={p.name}
        >
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold leading-none">
                {p.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500"
          style={{ marginLeft: '-8px', zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

export function QueueCard({ queue, variant = 'available' }: QueueCardProps) {
  const { date: serverDate } = useServerTime()
  const isUserInQueue = queue.userPosition !== null
  const startTime = queue.startTime ? new Date(queue.startTime) : new Date()
  const endTime = queue.endTime
    ? new Date(queue.endTime)
    : queue.startTime
      ? new Date(new Date(queue.startTime).getTime() + 2 * 60 * 60 * 1000)
      : new Date()
  const openTime = subHours(startTime, 12)
  const now = serverDate || new Date()
  const isLive = startTime <= now && endTime > now
  const displayStatus = queue.status === 'completed' ? 'completed' : isLive ? 'live' : 'open'
  const [timeUntilOpen, setTimeUntilOpen] = useState<number>(0)
  const [isJoinable, setIsJoinable] = useState(false)

  useEffect(() => {
    const check = () => {
      const t = serverDate || new Date()
      if (isBefore(t, openTime)) {
        setTimeUntilOpen(differenceInSeconds(openTime, t))
        setIsJoinable(false)
      } else {
        setTimeUntilOpen(0)
        setIsJoinable(true)
      }
    }
    check()
    const timer = setInterval(check, 1000)
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

  /* ── Available variant ── sleek, airy, modern card ─────────────── */
  if (variant === 'available') {
    return (
      <Link
        href={`/queue/${queue.courtId}`}
        className="group block bg-white rounded-xl p-5 border border-gray-200 hover:border-teal-200 transition-all duration-300"
      >
        {/* Row 1 — Status badge (left) + Avatar stack (right) */}
        <div className="flex items-center justify-between mb-4">
          {/* Blue-tinted status pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-600 text-xs font-semibold">
            {isLive ? (
              <Zap className="w-3 h-3 fill-teal-500 text-teal-500" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            <span>{isLive ? 'Live Now' : !isJoinable && timeUntilOpen > 0 ? `Opens ${formatCountdown(timeUntilOpen)}` : 'Open'}</span>
          </div>

          {/* Player avatar stack */}
          <AvatarStack players={queue.players} />
        </div>

        {/* Row 2 — Primary: court name */}
        <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight mb-1 group-hover:text-teal-600 transition-colors duration-200">
          {queue.courtName}
        </h3>

        {/* Row 3 — Secondary: venue */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{queue.venueName}</span>
        </div>

        {/* Row 4 — Metadata + CTA */}
        <div className="flex items-end justify-between">
          {/* Inline meta — time + players */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">
              {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
            </span>
            <span className="text-xs text-gray-400">
              {queue.currentPlayers || 0}/{queue.maxPlayers} in queue
              {queue.estimatedWaitTime != null && ` · ~${queue.estimatedWaitTime}m wait`}
            </span>
          </div>

          {/* Pill CTA */}
          {!isJoinable && timeUntilOpen > 0 ? (
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
              <Timer className="w-3.5 h-3.5" />
              <span className="font-mono">{formatCountdown(timeUntilOpen)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white text-xs font-bold shadow-sm group-hover:scale-105 transition-all duration-200">
              <span>Join Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </Link>
    )
  }

  /* ── Active variant — same card shell, active-specific content ── */
  return (
    <Link
      href={`/queue/${queue.courtId}`}
      className="group block bg-white rounded-xl p-5 border border-gray-200 hover:border-primary/40 transition-all duration-300"
    >
      {/* Row 1 — Status badge (left) + Avatar stack (right) */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-600 text-xs font-semibold">
          {isLive ? (
            <Zap className="w-3 h-3 fill-teal-500 text-teal-500" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          <span>{isLive ? 'Live Now' : displayStatus === 'completed' ? 'Completed' : 'Open'}</span>
        </div>
        <AvatarStack players={queue.players} />
      </div>

      {/* Court name */}
      <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight mb-1 group-hover:text-teal-600 transition-colors duration-200">
        {queue.courtName}
      </h3>

      {/* Venue */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{queue.venueName}</span>
      </div>

      {/* User position block — teal pill */}
      {isUserInQueue && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 mb-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-0.5">Your Position</p>
            <p className="text-2xl font-bold text-primary leading-none">#{queue.userPosition}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-0.5">Players Ahead</p>
            <p className="text-2xl font-bold text-gray-700 leading-none">{queue.userPosition! - 1}</p>
          </div>
        </div>
      )}

      {/* Outstanding balance */}
      {queue.userAmountOwed && queue.userAmountOwed > 0 && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-3">
          <div>
            <p className="text-[10px] text-orange-600 uppercase tracking-wider font-medium mb-0.5">Balance Due</p>
            <p className="text-sm text-orange-600">{queue.userGamesPlayed || 0} games played</p>
          </div>
          <p className="text-lg font-bold text-orange-600">₱{queue.userAmountOwed.toFixed(2)}</p>
        </div>
      )}

      {/* Row — time + players + CTA */}
      <div className="flex items-end justify-between mt-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium">
            {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
          </span>
          <span className="text-xs text-gray-400">
            {queue.currentPlayers || 0}/{queue.maxPlayers} in queue
            {queue.estimatedWaitTime != null && ` · ~${queue.estimatedWaitTime}m wait`}
          </span>
        </div>

        {/* Pill CTA */}
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white text-xs font-bold shadow-sm group-hover:scale-105 transition-all duration-200">
          <span>View Queue</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  )
}

