'use client'

import type { PlayerStats } from '@/app/actions/match-stats'

interface MatchStatsCardProps {
  stats: PlayerStats
}

const statsCardStyles = `
  .msc-card {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  }

  .msc-header {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem 1.25rem 0 0;
  }

  .msc-header .msc-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.055;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='msc'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23msc)' opacity='1'/%3E%3C/svg%3E");
    background-size: 150px 150px;
    mix-blend-mode: overlay;
  }

  .msc-header .msc-highlight {
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

  .msc-header .msc-shimmer {
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
    animation: msc-shimmer 4s ease-in-out infinite;
  }

  @keyframes msc-shimmer {
    0%, 100% { opacity: 0; left: -60%; }
    50% { opacity: 1; left: 60%; }
  }
`

const headerBg = [
  'radial-gradient(ellipse 115% 95% at 5% 8%, rgba(153,246,228,0.50) 0%, transparent 55%)',
  'radial-gradient(ellipse 80% 70% at 88% 92%, rgba(13,148,136,0.32) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 48% 52%, rgba(20,184,166,0.14) 0%, transparent 62%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)',
].join(', ')

export function MatchStatsCard({ stats }: MatchStatsCardProps) {
  return (
    <>
      <style>{statsCardStyles}</style>
      <div className="msc-card">
        {/* Glass gradient header */}
        <div className="msc-header px-6 pt-6 pb-5" style={{ background: headerBg }}>
          <div className="msc-noise" />
          <div className="msc-highlight" />
          <div className="msc-shimmer" />

          <div className="relative z-[4]">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xl font-bold text-white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
              >
                Your Performance
              </h2>
              {stats.skillLevel && (
                <div className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/20">
                  <span className="text-sm font-semibold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    Skill Level: {stats.skillLevel}/10
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-black text-white mb-0.5" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  {stats.totalGames}
                </div>
                <div className="text-xs font-medium text-white/70 uppercase tracking-wider">Games</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-black text-teal-200 mb-0.5" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  {stats.wins}
                </div>
                <div className="text-xs font-medium text-white/70 uppercase tracking-wider">Wins</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-black text-red-300 mb-0.5" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  {stats.losses}
                </div>
                <div className="text-xs font-medium text-white/70 uppercase tracking-wider">Losses</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-black text-white mb-0.5" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  {stats.winRate}%
                </div>
                <div className="text-xs font-medium text-white/70 uppercase tracking-wider">Win Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        {stats.gamesThisMonth > 0 && (
          <div className="px-6 py-3 bg-white border-t border-gray-100">
            <p className="text-sm text-gray-600">
              🔥 You&apos;ve played <span className="font-semibold text-gray-900">{stats.gamesThisMonth}</span> {stats.gamesThisMonth === 1 ? 'game' : 'games'} this month
            </p>
          </div>
        )}
      </div>
    </>
  )
}
