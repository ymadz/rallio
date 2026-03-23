'use client'

import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { MapPin, Calendar, Users, Clock } from 'lucide-react'
import { format, differenceInHours } from 'date-fns'

interface QueueCardProps {
  queue: QueueSession
  variant?: 'active' | 'available'
  userSkillLevel?: number | null
}

/* ── Gradient presets for visual variety (lighter teal tones) ── */
const CARD_GRADIENTS: string[][] = [
  [
    'radial-gradient(ellipse 115% 95% at 5% 8%, rgba(153,246,228,0.50) 0%, transparent 55%)',
    'radial-gradient(ellipse 80% 70% at 88% 92%, rgba(13,148,136,0.32) 0%, transparent 55%)',
    'radial-gradient(ellipse 55% 50% at 48% 52%, rgba(20,184,166,0.14) 0%, transparent 62%)',
    'linear-gradient(135deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)',
  ],
  [
    'radial-gradient(ellipse 110% 90% at 95% 6%, rgba(153,246,228,0.48) 0%, transparent 55%)',
    'radial-gradient(ellipse 85% 72% at 6% 90%, rgba(13,148,136,0.30) 0%, transparent 56%)',
    'radial-gradient(ellipse 50% 55% at 52% 50%, rgba(20,184,166,0.12) 0%, transparent 65%)',
    'linear-gradient(225deg, #14b8a6 0%, #0d9488 40%, #0f766e 100%)',
  ],
  [
    'radial-gradient(ellipse 100% 105% at 4% 94%, rgba(153,246,228,0.46) 0%, transparent 55%)',
    'radial-gradient(ellipse 78% 65% at 92% 8%, rgba(13,148,136,0.34) 0%, transparent 54%)',
    'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(20,184,166,0.14) 0%, transparent 60%)',
    'linear-gradient(315deg, #14b8a6 0%, #0d9488 45%, #0f766e 100%)',
  ],
  [
    'radial-gradient(ellipse 105% 95% at 96% 95%, rgba(153,246,228,0.48) 0%, transparent 55%)',
    'radial-gradient(ellipse 80% 68% at 8% 5%, rgba(13,148,136,0.32) 0%, transparent 55%)',
    'radial-gradient(ellipse 52% 52% at 50% 48%, rgba(20,184,166,0.13) 0%, transparent 64%)',
    'linear-gradient(315deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
  ],
  [
    'radial-gradient(ellipse 90% 80% at 50% 4%, rgba(153,246,228,0.50) 0%, transparent 55%)',
    'radial-gradient(ellipse 68% 80% at 5% 80%, rgba(13,148,136,0.26) 0%, transparent 56%)',
    'radial-gradient(ellipse 68% 80% at 95% 78%, rgba(13,148,136,0.22) 0%, transparent 56%)',
    'linear-gradient(180deg, #14b8a6 0%, #0d9488 40%, #0f766e 100%)',
  ],
  [
    'radial-gradient(ellipse 72% 125% at 2% 50%, rgba(153,246,228,0.48) 0%, transparent 55%)',
    'radial-gradient(ellipse 62% 90% at 98% 48%, rgba(13,148,136,0.32) 0%, transparent 54%)',
    'radial-gradient(ellipse 50% 55% at 50% 50%, rgba(20,184,166,0.13) 0%, transparent 65%)',
    'linear-gradient(90deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)',
  ],
]

const modeLabel = (mode: string) =>
  mode === 'competitive' ? 'Competitive' : 'Casual'

const modeColor = (mode: string) =>
  mode === 'competitive'
    ? 'bg-amber-400/20 border-amber-400/30 text-amber-200'
    : 'bg-white/10 border-white/15 text-teal-200'

let cardCounter = 0

export function QueueCard({ queue, variant = 'available', userSkillLevel = null }: QueueCardProps) {
  const startTime = queue.startTime ? new Date(queue.startTime) : new Date()
  const endTime = queue.endTime
    ? new Date(queue.endTime)
    : new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
  const remaining = Math.max(0, queue.maxPlayers - (queue.currentPlayers || 0))
  const price = queue.costPerGame ?? 0
  const mode = queue.mode || 'casual'
  const hasSkillRestriction = queue.minSkillLevel != null || queue.maxSkillLevel != null
  const requiredMinSkill = queue.minSkillLevel ?? 1
  const requiredMaxSkill = queue.maxSkillLevel ?? 10
  const requiredSkillLabel = hasSkillRestriction
    ? `Skill Required ${requiredMinSkill}-${requiredMaxSkill}`
    : 'Open to All Skills'
  const requiredSkillTierLabel = (() => {
    if (!hasSkillRestriction) return 'Open to All'
    if (requiredMinSkill === 1 && requiredMaxSkill === 3) return 'Beginner'
    if (requiredMinSkill === 4 && requiredMaxSkill === 6) return 'Intermediate'
    if (requiredMinSkill === 7 && requiredMaxSkill === 8) return 'Advanced'
    if (requiredMinSkill === 9 && requiredMaxSkill === 10) return 'Elite'
    return `Lvl ${requiredMinSkill}-${requiredMaxSkill}`
  })()
  const durationHrs = Math.round(differenceInHours(endTime, startTime))
  const isFull = remaining === 0

  // Extract court numbers from courtName (e.g. "Court 1" → "1")
  const courtNumbers = queue.courtName.match(/\d+/g) || ['1']

  // Stable gradient index
  const idx = cardCounter++
  const bg = CARD_GRADIENTS[idx % CARD_GRADIENTS.length].join(', ')

  const isActive = variant === 'active'
  const isOpen = queue.status === 'waiting' || queue.status === 'active'
  const isUpcoming = !isActive && !isOpen && startTime > new Date()
  const isSkillMismatch = hasSkillRestriction
    && userSkillLevel != null
    && (userSkillLevel < requiredMinSkill || userSkillLevel > requiredMaxSkill)

  return (
    <>
      <style>{qcStyles}</style>
      <Link
        href={`/queue/${queue.id}`}
        className="qc-card group block"
      >
        <div className="flex flex-col h-full">

          {/* ═══ 1. HEADER (gradient) ═══ */}
          <div className="qc-header relative overflow-hidden px-5 pt-5 pb-4" style={{ background: bg }}>
            <div className="qc-noise" />
            <div className="qc-highlight" />
            <div className="qc-shimmer" />

            <div className="relative z-[4] flex items-start justify-between gap-3">
              {/* Left: Title + badges */}
              <div className="min-w-0 flex-1">
                <h3
                  className="text-lg font-bold text-white leading-tight tracking-tight truncate"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                >
                  {queue.courtName}
                </h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${modeColor(mode)}`}>
                    {mode === 'competitive' && (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    )}
                    {modeLabel(mode)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${
                    hasSkillRestriction
                      ? 'bg-white/18 border-white/28 text-white'
                      : 'bg-white/10 border-white/15 text-teal-100'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasSkillRestriction ? 'bg-amber-200' : 'bg-teal-200'}`} />
                    {requiredSkillLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-teal-300/70">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[140px]">{queue.venueName}</span>
                  </span>
                </div>
              </div>

              {/* Right: Price */}
              {price > 0 && (
                <div className="flex-shrink-0 text-right">
                  <p
                    className="text-xl font-extrabold text-white leading-none"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                  >
                    ₱{price.toFixed(0)}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-teal-300/70 mt-0.5">
                    Per Player
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ 2. BODY (white) ═══ */}
          <div className="px-5 py-4 flex-1 space-y-3 bg-white">
            {/* Date & Time container */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">
                  {format(startTime, 'EEEE, MMM d, yyyy')}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}{durationHrs > 0 ? ` (${durationHrs}h)` : ''}
                </p>
              </div>
            </div>

            {/* Registration container */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {queue.currentPlayers || 0} / {queue.maxPlayers} <span className="font-normal text-gray-500">Registered</span>
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                isFull
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : remaining <= 3
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-teal-50 border-teal-200 text-teal-600'
              }`}>
                {isFull ? 'FULL' : `${remaining} LEFT`}
              </span>
            </div>

            {/* Courts row */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Courts:</span>
              {courtNumbers.map((num, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[11px] font-bold text-teal-700"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {/* ═══ 3. FOOTER ═══ */}
          <div className="px-5 pb-5 pt-1 bg-white rounded-b-[1.25rem]">
            {queue.status === 'pending_payment' ? (
              <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-100 text-orange-700 text-sm font-bold border border-orange-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Payment Required
              </div>
            ) : (
              <div className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                isUpcoming && queue.status !== 'waiting'
                  ? 'bg-gradient-to-r from-[#006666] to-[#008080] text-white group-hover:from-[#008080] group-hover:to-[#66b2b2] group-hover:shadow-[0_4px_14px_rgba(0,102,102,0.35)]'
                  : isSkillMismatch && !isActive
                    ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-600 to-teal-500 text-white group-hover:from-teal-500 group-hover:to-teal-400 group-hover:shadow-[0_4px_14px_rgba(13,148,136,0.35)]'
              }`}>
                {isUpcoming && queue.status !== 'waiting' ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>OPENING SOON</span>
                  </>
                ) : isSkillMismatch && !isActive ? (
                  <span>{requiredSkillTierLabel.toUpperCase()} ONLY</span>
                ) : (
                  <span>{isActive ? 'VIEW SESSION' : isFull ? 'JOIN WAITLIST' : 'JOIN NOW'}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </>
  )
}

/* ── Scoped glassmorphism styles ── */
const qcStyles = `
  @keyframes qc-shimmer {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }
  .qc-card {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    text-decoration: none;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    transition:
      transform 0.36s cubic-bezier(0.34,1.56,0.64,1),
      box-shadow 0.36s ease,
      border-color 0.36s ease;
    display: flex;
    flex-direction: column;
  }
  .qc-card:hover {
    transform: translateY(-3px) scale(1.012);
    border-color: rgba(153,246,228,0.40);
    box-shadow:
      0 4px 16px rgba(13,148,136,0.12),
      0 12px 32px rgba(0,0,0,0.08);
  }
  .qc-header {
    border-radius: 1.25rem 1.25rem 0 0;
  }
  .qc-header .qc-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.055;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='qc'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23qc)' opacity='1'/%3E%3C/svg%3E");
    background-size: 150px 150px;
    mix-blend-mode: overlay;
  }
  .qc-header .qc-highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background: linear-gradient(
      135deg,
      rgba(204,251,241,0.16) 0%,
      rgba(153,246,228,0.06) 30%,
      transparent 55%,
      rgba(0,0,0,0.04) 100%
    );
  }
  .qc-header .qc-shimmer {
    position: absolute;
    top: -20%;
    left: -30%;
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
    opacity: 0;
  }
  .qc-card:hover .qc-header .qc-shimmer {
    animation: qc-shimmer 2.4s ease-in-out infinite;
  }
`

