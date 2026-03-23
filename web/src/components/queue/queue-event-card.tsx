'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import { useState, useEffect } from 'react'

interface QueueEventCardProps {
  queue: QueueSession
  onBack?: () => void
  children?: ReactNode
  /** Rendered on the right side of the details row (date/time/spots) */
  actionSlot?: ReactNode
}

const modeLabel = (mode: string) =>
  mode === 'competitive' ? 'Competitive' : 'Open Play'

const skillBadgeLabel = (mode: string, min?: number | null, max?: number | null) => {
  if (min != null || max != null) {
    const low = min ?? 1
    const high = max ?? 10
    if (low === 1 && high === 3) return 'Beginner Only'
    if (low === 4 && high === 6) return 'Intermediate Only'
    if (low === 7 && high === 8) return 'Advanced Only'
    if (low === 9 && high === 10) return 'Elite Only'
    return `Skill ${low}-${high}`
  }
  return mode === 'competitive' ? 'Competitive (No Bracket Set)' : 'Open to All'
}

/* ── Glass-gradient styles (matches "Your Performance" card) ── */
const qecStyles = `
  .qec-card {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  }

  .qec-header {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem 1.25rem 0 0;
  }

  .qec-header .qec-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.055;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='qec'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23qec)' opacity='1'/%3E%3C/svg%3E");
    background-size: 150px 150px;
    mix-blend-mode: overlay;
  }

  .qec-header .qec-highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background: linear-gradient(
      135deg,
      rgba(204,251,241,0.18) 0%,
      rgba(153,246,228,0.06) 30%,
      transparent 55%,
      rgba(0,0,0,0.04) 100%
    );
  }

  .qec-header .qec-shimmer {
    position: absolute;
    top: -20%;
    left: -60%;
    width: 80%;
    height: 140%;
    pointer-events: none;
    z-index: 3;
    background: linear-gradient(
      125deg,
      transparent 30%,
      rgba(255,255,255,0.05) 48%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.05) 52%,
      transparent 70%
    );
    transform: rotate(-15deg);
    animation: qec-shimmer 4s ease-in-out infinite;
  }

  @keyframes qec-shimmer {
    0%, 100% { opacity: 0; left: -60%; }
    50% { opacity: 1; left: 60%; }
  }

  /* ── Glassmorphism progress bar ── */
  .qec-progress-track {
    position: relative;
    height: 0.625rem;
    border-radius: 9999px;
    background: rgba(13, 148, 136, 0.08);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(13, 148, 136, 0.12);
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
  }

  .qec-progress-fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, #14b8a6 0%, #0d9488 40%, #2dd4bf 100%);
    box-shadow: 0 0 8px rgba(20, 184, 166, 0.35), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: width 0.5s ease;
    position: relative;
    overflow: hidden;
  }

  .qec-progress-fill::after {
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
    animation: qec-bar-shine 2.5s ease-in-out infinite;
  }

  @keyframes qec-bar-shine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`

const headerBg = [
  'radial-gradient(ellipse 115% 95% at 5% 8%, rgba(153,246,228,0.50) 0%, transparent 55%)',
  'radial-gradient(ellipse 80% 70% at 88% 92%, rgba(13,148,136,0.32) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 48% 52%, rgba(20,184,166,0.14) 0%, transparent 62%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)',
].join(', ')

export function QueueEventCard({ queue, onBack, children, actionSlot }: QueueEventCardProps) {
  const startTime = queue.startTime ? new Date(queue.startTime) : new Date()
  const endTime = queue.endTime
    ? new Date(queue.endTime)
    : new Date(startTime.getTime() + 2 * 60 * 60 * 1000)

  const currentPlayers = queue.currentPlayers || 0
  const spotsLeft = Math.max(0, queue.maxPlayers - currentPlayers)
  const fillPercent = queue.maxPlayers > 0 ? (currentPlayers / queue.maxPlayers) * 100 : 0
  const price = queue.costPerGame ?? 0
  const host = queue.organizerName || 'Unknown Host'
  const mode = queue.mode || 'casual'

  // Countdown timer to start
  const [countdown, setCountdown] = useState({ days: 0, hrs: 0, min: 0 })
  const [hasStarted, setHasStarted] = useState(false)

  const startTimeMs = startTime.getTime()

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const diff = startTimeMs - now.getTime()
      if (diff <= 0) {
        setHasStarted(true)
        return
      }
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hrs: Math.floor((diff % 86_400_000) / 3_600_000),
        min: Math.floor((diff % 3_600_000) / 60_000),
      })
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [startTimeMs])

  return (
    <>
      <style>{qecStyles}</style>
      <div className="qec-card">
        {/* ── Glass gradient header ── */}
        <div className="qec-header px-6 pt-5 pb-6" style={{ background: headerBg }}>
          <div className="qec-noise" />
          <div className="qec-highlight" />
          <div className="qec-shimmer" />

          <div className="relative z-[4] space-y-3">
            {/* Top row: Back + Countdown */}
            <div className="flex items-center justify-between">
              {onBack ? (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <Link
                  href="/queue"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
              )}
              {!hasStarted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/20 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {countdown.days > 0 && `${countdown.days}d `}
                  {countdown.hrs}h {countdown.min}m
                </span>
              )}
            </div>

            {/* Optional extra content (e.g. queue-master controls) */}
            {children}

            {/* Eyebrow */}
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">
              {modeLabel(mode)}
            </p>

            {/* Title + Pricing */}
            <div className="flex items-baseline justify-between gap-4">
              <h2
                className="text-2xl font-bold text-white leading-tight truncate"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
              >
                {queue.courtName}
              </h2>
              <div className="flex-shrink-0 text-right">
                <span
                  className="text-3xl font-extrabold text-white"
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                >
                  ₱{price > 0 ? price.toFixed(0) : '0'}
                </span>
                <span className="ml-1 text-sm text-white/60">/ player</span>
              </div>
            </div>

            {/* Host & Location */}
            <p className="text-sm text-white/70 flex items-center gap-1.5 flex-wrap">
              <span>
                by <span className="font-medium text-white/90">{host}</span>
              </span>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1 text-white/70">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {queue.venueName}
              </span>
            </p>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/20">
                {skillBadgeLabel(mode, queue.minSkillLevel, queue.maxSkillLevel)}
              </span>
            </div>

            {/* Details Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-5 flex-wrap text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-white/50" />
                  {format(startTime, 'MMM d, yyyy')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-white/50" />
                  {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-white/50" />
                  {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                </span>
              </div>
              {actionSlot && (
                <div className="flex-shrink-0">
                  {actionSlot}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── White footer: Registration Progress ── */}
        <div className="px-6 py-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">
              {currentPlayers}/{queue.maxPlayers} registered
            </p>
            <p className="text-xs font-semibold text-teal-600">
              {Math.round(fillPercent)}%
            </p>
          </div>
          <div className="qec-progress-track">
            <div
              className="qec-progress-fill"
              style={{ width: `${Math.min(fillPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
