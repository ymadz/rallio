'use client'

import type { MatchWithDetails } from '@/app/actions/match-stats'
import { format } from 'date-fns'
import Image from 'next/image'

interface MatchCardProps {
  match: MatchWithDetails
}

const CONFETTI_PIECES = [
  { left: '10%', delay: '0s', duration: '2.4s', char: '🎊', size: 12 },
  { left: '25%', delay: '0.3s', duration: '2.8s', char: '✦', size: 10 },
  { left: '45%', delay: '0.7s', duration: '2.2s', char: '🎉', size: 11 },
  { left: '65%', delay: '0.1s', duration: '2.6s', char: '✦', size: 9 },
  { left: '80%', delay: '0.5s', duration: '2.5s', char: '🎊', size: 10 },
  { left: '35%', delay: '1.0s', duration: '2.3s', char: '●', size: 6 },
  { left: '55%', delay: '0.8s', duration: '2.7s', char: '●', size: 5 },
  { left: '90%', delay: '0.4s', duration: '2.1s', char: '✦', size: 8 },
  { left: '5%', delay: '1.2s', duration: '2.9s', char: '●', size: 7 },
  { left: '72%', delay: '0.6s', duration: '2.4s', char: '🎉', size: 10 },
]

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {CONFETTI_PIECES.map((piece, i) => (
        <span
          key={i}
          className="absolute animate-confetti-fall opacity-60"
          style={{
            left: piece.left,
            fontSize: piece.size,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        >
          {piece.char}
        </span>
      ))}
    </div>
  )
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-white"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-semibold border-2 border-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export function MatchCard({ match }: MatchCardProps) {
  const isWin = match.userWon === true
  const isLoss = match.userWon === false
  const isDraw = match.winner === 'draw'

  const userScore = match.userTeam === 'team_a' ? match.scoreA : match.scoreB
  const opponentScore = match.userTeam === 'team_a' ? match.scoreB : match.scoreA
  const hasScore = userScore !== null && opponentScore !== null

  const venueName = match.court?.venue?.name || match.queueSession?.court?.venue?.name || 'Queue Match'
  const courtName = match.court?.name || match.queueSession?.court?.name
  const dateStr = match.completedAt
    ? format(new Date(match.completedAt), 'MMM d, yyyy · h:mm a')
    : match.queueSession?.sessionDate
    ? format(new Date(match.queueSession.sessionDate), 'MMM d, yyyy')
    : 'Date unknown'

  // Build user team list (user first, then teammates)
  const userTeamPlayers = [
    { id: 'self', name: 'You', avatarUrl: match.userAvatarUrl },
    ...match.teammates,
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
      {/* Main VS layout — 1fr auto 1fr grid ensures true center alignment */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        {/* Your team side */}
        <div className={`relative flex-1 p-4 sm:p-5 overflow-hidden ${isWin ? 'bg-gradient-to-r from-primary/30 via-primary/10 to-transparent' : ''}`}>
          {isWin && <Confetti />}
          <p className="relative text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Your Team</p>
          <div className="relative space-y-3">
            {userTeamPlayers.map((player) => (
              <div key={player.id} className="flex items-center gap-3">
                <Avatar
                  src={player.avatarUrl}
                  name={player.name}
                  size={player.id === 'self' ? 44 : 38}
                />
                <div className="min-w-0">
                  <p className={`truncate ${player.id === 'self' ? 'text-base font-semibold text-gray-900' : 'text-sm font-medium text-gray-700'}`}>
                    {player.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center scoreboard */}
        <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-4 relative">
          {/* Result indicator */}
          {isWin && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1">Win</span>
          )}
          {isLoss && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Loss</span>
          )}
          {isDraw && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Draw</span>
          )}

          {hasScore ? (
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black tabular-nums ${isWin ? 'text-teal-600' : 'text-gray-800'}`}>
                {userScore}
              </span>
              <span className="text-sm font-medium text-gray-300">-</span>
              <span className={`text-2xl sm:text-3xl font-black tabular-nums ${isLoss ? 'text-red-500' : 'text-gray-400'}`}>
                {opponentScore}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-400">VS</span>
          )}

          {/* Game format tag */}
          <span className="mt-2 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {match.gameFormat === 'doubles' ? 'Doubles' : match.gameFormat === 'singles' ? 'Singles' : match.gameFormat}
          </span>
        </div>

        {/* Opponent side */}
        <div className={`relative flex-1 p-4 sm:p-5 overflow-hidden ${isLoss ? 'bg-red-50/30' : ''}`}>
          {isLoss && <Confetti />}
          <p className="relative text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 text-right">Opponents</p>
          <div className="relative space-y-3">
            {match.opponents.map((player) => (
              <div key={player.id} className="flex items-center gap-3 flex-row-reverse">
                <Avatar src={player.avatarUrl} name={player.name} size={38} />
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium text-gray-700 truncate">{player.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer: venue, court, date */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-gray-700 truncate">{venueName}</span>
          {courtName && (
            <>
              <span className="text-gray-300">·</span>
              <span className="truncate">{courtName}</span>
            </>
          )}
          {match.matchNumber && (
            <>
              <span className="text-gray-300">·</span>
              <span>Game #{match.matchNumber}</span>
            </>
          )}
        </div>
        <span className="shrink-0 text-gray-400">{dateStr}</span>
      </div>
    </div>
  )
}
