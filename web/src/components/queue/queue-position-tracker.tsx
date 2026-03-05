'use client'

import { Users, Clock, CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { differenceInSeconds, format } from 'date-fns'

interface QueuePositionTrackerProps {
  position: number
  totalPlayers: number
  gamesPlayed: number
  status: 'waiting' | 'playing' | 'completed'
  sessionStartTime?: Date | string
  isSessionLive?: boolean
}

function useCountdown(targetDate?: Date | string) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!targetDate) return

    const update = () => {
      const diff = differenceInSeconds(new Date(targetDate), new Date())
      setSeconds(Math.max(0, diff))
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return { seconds, h, m, s }
}

export function QueuePositionTracker({
  position,
  totalPlayers,
  gamesPlayed,
  status,
  sessionStartTime,
  isSessionLive = true,
}: QueuePositionTrackerProps) {
  const progressPercentage = totalPlayers > 0 ? ((totalPlayers - position + 1) / totalPlayers) * 100 : 0
  const countdown = useCountdown(!isSessionLive ? sessionStartTime : undefined)

  const statusColors = {
    waiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    playing: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  // Pre-session state: user is registered but session hasn't started
  const isPreSession = !isSessionLive && status === 'waiting'

  // Badge to show
  const badgeClass = isPreSession
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : statusColors[status]

  const badgeLabel = isPreSession ? 'Spot Reserved' : status === 'waiting'
    ? 'Waiting in Queue'
    : status === 'playing'
      ? 'Currently Playing'
      : 'Session Complete'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-4 ${badgeClass}`}>
        {isPreSession && <CalendarClock className="w-4 h-4" />}
        <span className="font-semibold text-sm">{badgeLabel}</span>
      </div>

      {/* Pre-session countdown block */}
      {isPreSession && sessionStartTime && (
        <div className="mb-6 p-4 bg-sky-50 border border-sky-100 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-0.5">Queue session hasn't started yet</p>
              <p className="text-sm text-sky-700">
                Starts at <span className="font-semibold">{format(new Date(sessionStartTime), 'h:mm a')}</span>
                {' '}on{' '}
                <span className="font-semibold">{format(new Date(sessionStartTime), 'EEEE, MMM d')}</span>
              </p>

              {countdown.seconds > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-sky-600 font-medium uppercase tracking-wider">Starts in</span>
                  <div className="flex items-center gap-1">
                    {countdown.h > 0 && (
                      <>
                        <span className="text-lg font-bold text-sky-800 tabular-nums">{String(countdown.h).padStart(2, '0')}</span>
                        <span className="text-sky-500 font-medium">h</span>
                      </>
                    )}
                    <span className="text-lg font-bold text-sky-800 tabular-nums">{String(countdown.m).padStart(2, '0')}</span>
                    <span className="text-sky-500 font-medium">m</span>
                    <span className="text-lg font-bold text-sky-800 tabular-nums">{String(countdown.s).padStart(2, '0')}</span>
                    <span className="text-sky-500 font-medium">s</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Position display — shown whether pre-session or live, as long as waiting */}
      {status === 'waiting' && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Your Position</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">#{position}</div>
                <div className="text-xs text-gray-500">of {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md transition-all duration-500"
                style={{ left: `calc(${Math.min(progressPercentage, 100)}% - 10px)` }}
              />
            </div>
          </div>

          {/* Tip — different message depending on session state */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-700">💡 Tip:</span>{' '}
              {isPreSession
                ? "Your spot is secured! Show up before the session starts so you're ready to play."
                : "Stay ready! You'll be notified when it's your turn to play."}
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
