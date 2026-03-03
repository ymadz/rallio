'use client'

import Link from 'next/link'
import { useNearbyQueues } from '@/hooks/use-queue'
import { Spinner } from '@/components/ui/spinner'

export function NearbyQueues() {
  const { queues, isLoading } = useNearbyQueues()

  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-center">
        <Spinner className="text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading active queues...</span>
      </div>
    )
  }

  // empty state — section still renders, shows a "no queues nearby" message

  return (
    <section className="mb-8">
      {/* Scoped styles for queue glass cards */}
      <style>{`
        /* ── Nearby Queue Card: Gradient Glass Surface ── */
        @keyframes nq-shimmer {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .nq-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.25rem;
          padding: 0;
          display: flex;
          align-items: stretch;
          text-decoration: none;
          /* Studio-lighting gradient applied per-card via inline style prop */
          border: 1px solid rgba(153,246,228,0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.14),
            inset 0 -1px 0 rgba(0,0,0,0.08);
          transition:
            transform 0.36s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.36s ease,
            border-color 0.36s ease;
        }
        .nq-card:hover {
          transform: translateY(-3px) scale(1.012);
          border-color: rgba(153,246,228,0.32);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.06),
            0 4px 16px rgba(13,148,136,0.22),
            0 20px 48px rgba(8,70,64,0.28);
        }
        .nq-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='nq'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23nq)' opacity='1'/%3E%3C/svg%3E");
          background-size: 150px 150px;
          mix-blend-mode: overlay;
        }
        .nq-highlight {
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
        .nq-shimmer {
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
        .nq-card:hover .nq-shimmer {
          animation: nq-shimmer 2.4s ease-in-out infinite;
        }
        .nq-body {
          position: relative;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          width: 100%;
        }
        /* Left icon circle */
        .nq-icon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: inset 0 1px 4px rgba(0,0,0,0.12), 0 0 0 3px rgba(255,255,255,0.04);
          transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nq-card:hover .nq-icon {
          border-color: rgba(255,255,255,0.30);
          box-shadow: inset 0 1px 4px rgba(0,0,0,0.08), 0 0 0 4px rgba(153,246,228,0.10);
          transform: scale(1.06);
        }
        .nq-info {
          flex: 1;
          min-width: 0;
        }
        .nq-court {
          color: #fff;
          font-weight: 600;
          font-size: 0.875rem;
          letter-spacing: -0.01em;
          line-height: 1.3;
          text-shadow: 0 1px 4px rgba(0,0,0,0.22);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nq-venue {
          color: rgba(204,251,241,0.68);
          font-size: 0.8125rem;
          line-height: 1.4;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nq-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .nq-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12);
          color: #ccfbf1;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .nq-status-live {
          background: rgba(20,184,166,0.25);
          border-color: rgba(153,246,228,0.30);
          color: #99f6e4;
        }
        .nq-status-open {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.14);
          color: rgba(204,251,241,0.85);
        }
        .nq-match {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.08);
          color: rgba(204,251,241,0.55);
          font-size: 0.6875rem;
        }
        .nq-arrow {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nq-card:hover .nq-arrow {
          background: rgba(255,255,255,0.16);
          transform: translateX(2px);
        }
        @keyframes nq-ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        .nq-empty-ping {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid #9ca3af;
          animation: nq-ping 2.4s cubic-bezier(0,0,0.2,1) infinite;
        }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Active Queues Nearby</h2>
          <p className="text-xs text-gray-500 mt-0.5">Join a game in progress</p>
        </div>
        <Link href="/queue" className="text-sm font-medium text-primary hover:text-primary/80">
          See all
        </Link>
      </div>

      {queues.length === 0 ? (
        /* ── Standard empty state ── */
        <div style={{
          border: '1.5px dashed #d1d5db',
          borderRadius: '0.875rem',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.375rem',
          textAlign: 'center',
        }}>
          {/* Pulsing icon */}
          <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <div className="nq-empty-ping" />
            <svg style={{ position: 'relative', zIndex: 1, width: 22, height: 22, color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>No active queues nearby</p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Check back later or browse all queues.</p>
          <Link href="/queue" style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#0d9488', textDecoration: 'none' }}>
            Browse queues →
          </Link>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {queues.map((queue, idx) => {
          // ── Per-card radial gradient presets ──────────────────────────
          const NQ_GRADIENTS: string[][] = [
            // 0 · Spotlight: top-left → shadow: bottom-right
            [
              'radial-gradient(ellipse 115% 95% at 5% 8%,   rgba(153,246,228,0.44) 0%, transparent 50%)',
              'radial-gradient(ellipse 80%  70% at 88% 92%, rgba(5,80,60,0.58)     0%, transparent 52%)',
              'radial-gradient(ellipse 55%  50% at 48% 52%, rgba(20,184,166,0.10)  0%, transparent 62%)',
              'linear-gradient(135deg, #0f766e 0%, #09564e 42%, #073d37 100%)',
            ],
            // 1 · Spotlight: top-right → shadow: bottom-left
            [
              'radial-gradient(ellipse 110% 90% at 95% 6%,  rgba(153,246,228,0.40) 0%, transparent 50%)',
              'radial-gradient(ellipse 85%  72% at 6%  90%, rgba(5,80,60,0.52)     0%, transparent 54%)',
              'radial-gradient(ellipse 50%  55% at 52% 50%, rgba(20,184,166,0.09)  0%, transparent 65%)',
              'linear-gradient(225deg, #0f766e 0%, #0a5a52 40%, #073d37 100%)',
            ],
            // 2 · Spotlight: bottom-left → shadow: top-right
            [
              'radial-gradient(ellipse 100% 105% at 4% 94%, rgba(153,246,228,0.38) 0%, transparent 52%)',
              'radial-gradient(ellipse 78%  65%  at 92% 8%, rgba(4,70,52,0.60)     0%, transparent 50%)',
              'radial-gradient(ellipse 60%  50%  at 50% 55%,rgba(20,184,166,0.11)  0%, transparent 60%)',
              'linear-gradient(315deg, #0d9488 0%, #0a5c55 45%, #052e29 100%)',
            ],
            // 3 · Spotlight: bottom-right → shadow: top-left
            [
              'radial-gradient(ellipse 105% 95% at 96% 95%, rgba(153,246,228,0.40) 0%, transparent 50%)',
              'radial-gradient(ellipse 80%  68% at 8%  5%,  rgba(4,70,52,0.58)     0%, transparent 52%)',
              'radial-gradient(ellipse 52%  52% at 50% 48%, rgba(20,184,166,0.10)  0%, transparent 64%)',
              'linear-gradient(315deg, #0f766e 0%, #084640 50%, #052e29 100%)',
            ],
            // 4 · Spotlight: top-center crown → dark sides
            [
              'radial-gradient(ellipse 90%  80% at 50% 4%,  rgba(153,246,228,0.42) 0%, transparent 50%)',
              'radial-gradient(ellipse 68%  80% at 5%  80%, rgba(5,80,60,0.40)     0%, transparent 54%)',
              'radial-gradient(ellipse 68%  80% at 95% 78%, rgba(4,70,52,0.36)     0%, transparent 54%)',
              'linear-gradient(180deg, #0d9488 0%, #085e55 40%, #052e29 100%)',
            ],
            // 5 · Spotlight: left-edge glancing → right shadow
            [
              'radial-gradient(ellipse 72%  125% at 2% 50%,  rgba(153,246,228,0.40) 0%, transparent 52%)',
              'radial-gradient(ellipse 62%  90%  at 98% 48%, rgba(4,70,52,0.58)     0%, transparent 50%)',
              'radial-gradient(ellipse 50%  55%  at 50% 50%, rgba(20,184,166,0.10)  0%, transparent 65%)',
              'linear-gradient(90deg, #0f766e 0%, #0a5a52 42%, #073d37 100%)',
            ],
          ]
          const queueBg = NQ_GRADIENTS[idx % NQ_GRADIENTS.length].join(', ')
          const isLive = queue.status === 'active'
          return (
            <Link
              key={queue.id}
              href={`/queue/${queue.courtId}`}
              className="nq-card"
              style={{ background: queueBg }}
            >

              {/* Texture layers */}
              <div className="nq-noise" />
              <div className="nq-highlight" />
              <div className="nq-shimmer" />

              <div className="nq-body">
                {/* Queue icon */}
                <div className="nq-icon">
                  <svg style={{ width: 20, height: 20, color: 'rgba(153,246,228,0.85)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>

                {/* Info block */}
                <div className="nq-info">
                  <div className="nq-court">{queue.courtName}</div>
                  <div className="nq-venue">{queue.venueName}</div>

                  <div className="nq-meta">
                    {/* Status pill */}
                    <span className={`nq-pill ${isLive ? 'nq-status-live' : 'nq-status-open'}`}>
                      {isLive ? (
                        <svg style={{ width: 10, height: 10 }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {isLive ? 'Live' : queue.status === 'waiting' ? 'Open' : 'Completed'}
                    </span>

                    {/* Players pill */}
                    <span className="nq-pill">
                      <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      {queue.currentPlayers || 0} waiting
                    </span>

                    {/* Wait time pill */}
                    {queue.estimatedWaitTime != null && (
                      <span className="nq-pill">
                        <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ~{queue.estimatedWaitTime}m
                      </span>
                    )}
                  </div>

                  {/* Current match */}
                  {queue.currentMatch && (
                    <div className="nq-match">
                      Now playing: {queue.currentMatch.players.join(' vs ')}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="nq-arrow">
                  <svg style={{ width: 16, height: 16, color: 'rgba(204,251,241,0.8)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      )}
    </section>
  )
}
