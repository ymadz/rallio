'use client'

import { useEffect, useState } from 'react'
import { differenceInSeconds } from 'date-fns'
import { Timer } from 'lucide-react'

interface MatchTimerProps {
  startedAt: Date | string | null
  completedAt?: Date | string | null
  className?: string
  showIcon?: boolean
}

export function MatchTimer({
  startedAt,
  completedAt,
  className = '',
  showIcon = true
}: MatchTimerProps) {
  const [elapsedTime, setElapsedTime] = useState<string>('00:00')

  useEffect(() => {
    // If no start time, don't show timer
    if (!startedAt) return

    const startDate = new Date(startedAt)
    const endDate = completedAt ? new Date(completedAt) : null

    // If match is completed, show final duration (static)
    if (endDate) {
      setElapsedTime(formatDuration(startDate, endDate))
      return
    }

    // For in-progress matches, update timer every second
    const updateTimer = () => {
      setElapsedTime(formatDuration(startDate, new Date()))
    }

    // Initial update
    updateTimer()

    // Set up interval for live updates
    const interval = setInterval(updateTimer, 1000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [startedAt, completedAt])

  // Don't render if no start time
  if (!startedAt) return null

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showIcon && <Timer className="w-4 h-4" />}
      <span className="font-mono text-sm font-medium">
        {elapsedTime}
      </span>
    </div>
  )
}

/**
 * Format duration between two dates as HH:MM:SS or MM:SS
 */
function formatDuration(startedAt: Date, endedAt: Date): string {
  const seconds = Math.max(0, differenceInSeconds(endedAt, startedAt))

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  // If over 1 hour, show HH:MM:SS
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Otherwise show MM:SS
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
