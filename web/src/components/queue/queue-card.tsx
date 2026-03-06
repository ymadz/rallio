'use client'

import Link from 'next/link'
import { QueueSession } from '@/hooks/use-queue'
import { MapPin, Calendar, Users, ChevronRight, Clock } from 'lucide-react'
import { format } from 'date-fns'

interface QueueCardProps {
  queue: QueueSession
  variant?: 'active' | 'available'
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

const skillLabel = (mode: string) =>
  mode === 'competitive' ? 'Competitive' : 'All Levels'

const skillColor = (mode: string) =>
  mode === 'competitive'
    ? 'bg-amber-400/20 border-amber-400/30 text-amber-200'
    : 'bg-white/10 border-white/15 text-teal-200'

let cardCounter = 0

export function QueueCard({ queue, variant = 'available' }: QueueCardProps) {
  const startTime = queue.startTime ? new Date(queue.startTime) : new Date()
  const endTime = queue.endTime
    ? new Date(queue.endTime)
    : new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
  const remaining = Math.max(0, queue.maxPlayers - (queue.currentPlayers || 0))
  const price = queue.costPerGame ?? 0
  const host = queue.organizerName || 'Unknown Host'
  const mode = queue.mode || 'casual'

  // Extract court number from courtName (e.g. "Court 1" → "1")
  const courtNumbers = queue.courtName.match(/\d+/g) || ['1']

  // Stable gradient index
  const idx = cardCounter++
  const bg = CARD_GRADIENTS[idx % CARD_GRADIENTS.length].join(', ')

  const isActive = variant === 'active'
  const isUpcoming = !isActive && startTime > new Date()

  return (
    <>
      <style>{qcStyles}</style>
      <Link
        href={`/queue/${queue.courtId}`}
        className="qc-card group block"
      >
      {/* ─── CONTENT ─── */}
      <div className="flex flex-col h-full">

        {/* ═══ TOP HEADER (gradient) ═══ */}
        <div className="qc-header relative overflow-hidden px-5 pt-5 pb-3" style={{ background: bg }}>
          {/* Texture layers scoped to header */}
          <div className="qc-noise" />
          <div className="qc-highlight" />
          <div className="qc-shimmer" />

          <div className="relative z-[4]">
            {/* Title + Price row */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <h3 className="text-[1.1rem] font-bold text-white leading-tight tracking-tight truncate"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                {queue.courtName}
              </h3>
              {price > 0 && (
                <span className="flex-shrink-0 text-sm font-bold text-teal-200 whitespace-nowrap"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                  ₱{price.toFixed(0)}<span className="text-[10px] font-medium text-teal-300/60">/game</span>
                </span>
              )}
            </div>
            {/* Skill pill + Location */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${skillColor(mode)}`}>
                {mode === 'competitive' && (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                )}
                {skillLabel(mode)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-teal-300/70">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{queue.venueName}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ═══ MIDDLE BODY (white) ═══ */}
        <div className="px-5 py-4 flex-1 space-y-3 bg-white">
          {/* Date & Time container */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Schedule</p>
              <p className="text-sm font-semibold text-gray-800 truncate">
                {format(startTime, 'MMM d')} &middot; {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Registration stats container */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Registered</p>
                <p className="text-sm font-semibold text-gray-800">
                  {queue.currentPlayers || 0} / {queue.maxPlayers}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              remaining <= 3
                ? 'bg-amber-50 border-amber-200 text-amber-600'
                : 'bg-teal-50 border-teal-200 text-teal-600'
            }`}>
              {remaining} {remaining === 1 ? 'slot' : 'slots'} left
            </span>
          </div>

          {/* Court number indicators */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mr-1">Courts</span>
            {courtNumbers.map((num, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[11px] font-bold text-teal-700"
              >
                {num}
              </div>
            ))}
          </div>

          {/* Host */}
          <p className="text-[11px] text-gray-400 truncate">
            Hosted by <span className="text-gray-600 font-medium">{host}</span>
          </p>
        </div>

        {/* ═══ BOTTOM FOOTER (white) ═══ */}
        <div className="px-5 pb-5 pt-1 bg-white rounded-b-[1.25rem]">
          <div className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            isUpcoming
              ? 'bg-gradient-to-r from-[#006666] to-[#008080] text-white group-hover:from-[#008080] group-hover:to-[#66b2b2] group-hover:shadow-[0_4px_14px_rgba(0,102,102,0.35)]'
              : 'bg-gradient-to-r from-teal-600 to-teal-500 text-white group-hover:from-teal-500 group-hover:to-teal-400 group-hover:shadow-[0_4px_14px_rgba(13,148,136,0.35)]'
          }`}>
            {isUpcoming ? (
              <>
                <Clock className="w-4 h-4" />
                <span>OPENING SOON</span>
              </>
            ) : (
              <>
                <span>{isActive ? 'VIEW SESSION' : 'JOIN NOW'}</span>
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </>
            )}
          </div>
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

