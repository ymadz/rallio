'use client'

import { Users, Clock } from 'lucide-react'

/* ── Glassmorphism progress bar styles ── */
const qptStyles = `
  .qpt-progress-track {
    position: relative;
    height: 0.625rem;
    border-radius: 9999px;
    background: rgba(13, 148, 136, 0.08);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(13, 148, 136, 0.12);
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
  }

  .qpt-progress-fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, #14b8a6 0%, #0d9488 40%, #2dd4bf 100%);
    box-shadow: 0 0 8px rgba(20, 184, 166, 0.35), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: width 0.5s ease;
    position: relative;
    overflow: hidden;
  }

  .qpt-progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.3) 50%,
      transparent 100%
    );
    animation: qpt-bar-shine 2.5s ease-in-out infinite;
  }

  @keyframes qpt-bar-shine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`

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
    waiting: 'bg-teal-500/10 text-teal-700 border-teal-400/30 shadow-[0_0_8px_rgba(20,184,166,0.12)]',
    playing: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30 shadow-[0_0_8px_rgba(16,185,129,0.12)]',
    completed: 'bg-sky-500/10 text-sky-700 border-sky-400/30 shadow-[0_0_8px_rgba(14,165,233,0.12)]',
  }

  // Pre-session state: user is registered but session hasn't started
  const isPreSession = !isSessionLive && status === 'waiting'

  // Badge to show
  const badgeClass = isPreSession
    ? 'bg-sky-500/10 text-sky-700 border-sky-400/30 shadow-[0_0_8px_rgba(14,165,233,0.12)]'
    : statusColors[status]

  const badgeLabel = isPreSession ? 'Spot Reserved' : status === 'waiting'
    ? 'Waiting in Queue'
    : status === 'playing'
      ? 'Currently Playing'
      : 'Session Complete'
  const statusLabels = {
    waiting: 'Waiting in Queue',
    playing: 'Currently Playing',
    completed: 'Session Complete',
  }

  const badgeIcon = isPreSession
    ? <CalendarClock className="w-3.5 h-3.5" />
    : status === 'waiting'
      ? <Clock className="w-3.5 h-3.5" />
      : status === 'playing'
        ? <Users className="w-3.5 h-3.5" />
        : null

  return (
    <>
      <style>{qptStyles}</style>
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border backdrop-blur-sm mb-4 ${badgeClass}`}>
        {badgeIcon}
        {status === 'waiting' && !isPreSession && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
          </span>
        )}
        <span className="font-semibold text-xs uppercase tracking-wider">{badgeLabel}</span>
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">
                Position {position} of {totalPlayers}
              </p>
              <p className="text-xs font-semibold text-teal-600">
                {Math.round(progressPercentage)}%
              </p>
            </div>
            <div className="qpt-progress-track">
              <div
                className="qpt-progress-fill"
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
          <div className="pt-4 border-t border-gray-100">
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
    </>
  )
}
