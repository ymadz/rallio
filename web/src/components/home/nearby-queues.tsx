'use client';

import Link from 'next/link';
import { useNearbyQueues } from '@/hooks/use-queue';
import { Spinner } from '@/components/ui/spinner';

function formatQueueDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatQueueTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

const AVATAR_COLORS = [
  'bg-teal-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-indigo-400',
  'bg-violet-400',
];

export function NearbyQueues() {
  const { queues, isLoading } = useNearbyQueues();

  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-center">
        <Spinner className="text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading active queues...</span>
      </div>
    );
  }

  return (
    <section className="mb-8">
      <style>{`
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
        <div
          style={{
            border: '1.5px dashed #d1d5db',
            borderRadius: '0.875rem',
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.375rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <div className="nq-empty-ping" />
            <svg
              style={{ position: 'relative', zIndex: 1, width: 22, height: 22, color: '#9ca3af' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.4}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
            No active queues nearby
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Check back later or browse all queues.
          </p>
          <Link
            href="/queue"
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#0d9488',
              textDecoration: 'none',
            }}
          >
            Browse queues →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {queues.map((queue) => {
            const isLive = queue.status === 'active';
            const isOpen = queue.status === 'waiting';
            const startDate = new Date(queue.startTime);
            const endDate = new Date(queue.endTime);
            const avatarCount = Math.min(queue.players?.length || queue.currentPlayers || 0, 4);
            const totalPlayers = queue.players?.length || queue.currentPlayers || 0;
            const overflow = totalPlayers - avatarCount;

            return (
              <div
                key={queue.id}
                className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* ── Top: Info Section (Glass Gradient) ── */}
                <div
                  className="relative px-5 pt-8 pb-7 overflow-hidden"
                  style={{
                    background: [
                      'radial-gradient(ellipse 110% 90% at 10% 10%, rgba(153,246,228,0.45) 0%, transparent 50%)',
                      'radial-gradient(ellipse 80% 70% at 90% 90%, rgba(5,80,60,0.50) 0%, transparent 52%)',
                      'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #084640 100%)',
                    ].join(', '),
                  }}
                >
                  {/* Noise texture */}
                  <div
                    className="absolute inset-0 pointer-events-none z-[1] opacity-[0.045] mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
                      backgroundSize: '150px 150px',
                    }}
                  />
                  {/* Highlight sweep */}
                  <div
                    className="absolute inset-0 pointer-events-none z-[2]"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(204,251,241,0.18) 0%, rgba(153,246,228,0.06) 30%, transparent 55%, rgba(0,0,0,0.04) 100%)',
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-[3] flex flex-col gap-2.5">
                    {/* Row 1: Date & Time */}
                    <div className="flex items-center gap-1 text-[11px] text-white/50 leading-none">
                      <svg
                        className="w-3 h-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{formatQueueDate(startDate)}</span>
                      <span className="text-white/30">|</span>
                      <svg
                        className="w-3 h-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="truncate">
                        {formatQueueTime(startDate)} – {formatQueueTime(endDate)}
                      </span>
                    </div>

                    {/* Row 2: Title */}
                    <h3
                      className="text-base font-bold text-white leading-tight truncate uppercase"
                      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.22)' }}
                    >
                      {queue.courtName}
                    </h3>

                    {/* Row 3: Venue + Mode */}
                    <div className="flex items-center gap-1 text-xs text-teal-100/70">
                      <svg
                        className="w-3 h-3 text-teal-200/50 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate">{queue.venueName}</span>
                      <svg
                        className="w-2.5 h-2.5 text-teal-200/40 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="capitalize">{queue.mode}</span>
                    </div>
                  </div>
                </div>

                {/* ── Bottom: Action Section ── */}
                <div className="px-5 py-3.5 flex flex-col gap-3">
                  {/* Row: avatars + ratio + status */}
                  <div className="flex items-center gap-2">
                    {/* Avatar stack */}
                    <div className="flex items-center flex-shrink-0">
                      <div className="flex -space-x-1.5">
                        {queue.players?.slice(0, 4).map((player, i) => (
                          <div
                            key={i}
                            className={`w-[22px] h-[22px] rounded-full ${!player.avatarUrl ? AVATAR_COLORS[i % AVATAR_COLORS.length] : ''} border-[1.5px] border-white flex items-center justify-center overflow-hidden`}
                          >
                            {player.avatarUrl ? (
                              <img
                                src={player.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <svg
                                className="w-2.5 h-2.5 text-white/90"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                      {overflow > 0 && (
                        <span className="ml-1 text-[10px] font-semibold text-gray-500">
                          +{overflow}
                        </span>
                      )}
                    </div>

                    {/* Registration ratio */}
                    <span className="text-xs font-bold text-gray-800">
                      {queue.currentPlayers || 0}/{queue.maxPlayers}
                    </span>

                    <div className="flex-1" />

                    {/* Status badge */}
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        Live
                      </span>
                    ) : isOpen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                        Ended
                      </span>
                    )}
                  </div>

                  {/* Glass CTA button - full width */}
                  <Link
                    href={`/queue/${queue.courtId}`}
                    className="flex items-center justify-center gap-1 w-full py-1.5 rounded-full text-[11px] font-bold text-white border border-white/20 backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:shadow-lg hover:shadow-teal-700/20"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(13,148,136,0.85) 0%, rgba(15,118,110,0.9) 50%, rgba(8,70,64,0.85) 100%)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    {isLive ? 'Watch' : 'Join Queue'}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
