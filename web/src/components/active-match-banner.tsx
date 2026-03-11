'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, X, Trophy } from 'lucide-react'
import Link from 'next/link'
import { MatchTimer } from './queue-master/match-timer'

interface ActiveMatchInfo {
    id: string
    matchNumber: number
    courtId: string
    courtName: string
    status: string
    startedAt: string | null
    completedAt: string | null
    winner: string | null
    metadata: any
    teamAPlayers: string[]
    teamBPlayers: string[]
    opponentNames: string
}

/**
 * Global banner that appears on ALL pages when the user has an active match
 * or a recently completed match.
 * Dismissable with an X button, auto-refreshes via real-time subscription.
 */
export function ActiveMatchBanner() {
    const [match, setMatch] = useState<ActiveMatchInfo | null>(null)
    const [dismissed, setDismissed] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const supabase = createClient()
    const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve())

    // Check for active matches
    const checkActiveMatch = async () => {
        if (!userId) return

        const { data: matches } = await supabase
            .from('matches')
            .select(`
                id,
                match_number,
                status,
                started_at,
                completed_at,
                winner,
                metadata,
                team_a_players,
                team_b_players,
                queue_sessions!inner (
                  court_id,
                  courts ( name )
                )
            `)
            .or(`team_a_players.cs.{${userId}},team_b_players.cs.{${userId}}`)
            .order('created_at', { ascending: false })
            .limit(1)

        if (matches && matches.length > 0) {
            const m = matches[0] as any

            // If completed, check how long ago
            if (m.status === 'completed') {
                if (m.completed_at) {
                    const completedMinAgo = (new Date().getTime() - new Date(m.completed_at).getTime()) / 60000
                    if (completedMinAgo > 15) { // dismiss after 15 mins
                        setMatch(null)
                        return
                    }
                }
            }

            // Fetch opponent names
            let opponentNames = ''
            if (m.team_a_players && m.team_b_players) {
                const isTeamA = m.team_a_players.includes(userId)
                const opponentIds = isTeamA ? m.team_b_players : m.team_a_players

                if (opponentIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('first_name')
                        .in('id', opponentIds)

                    if (profiles && profiles.length > 0) {
                        opponentNames = profiles.map(p => p.first_name).join(' & ')
                    }
                }
            }

            setMatch({
                id: m.id,
                matchNumber: m.match_number,
                courtId: m.queue_sessions?.court_id,
                courtName: m.queue_sessions?.courts?.name || 'Court',
                status: m.status,
                startedAt: m.started_at,
                completedAt: m.completed_at,
                winner: m.winner,
                metadata: m.metadata,
                teamAPlayers: m.team_a_players,
                teamBPlayers: m.team_b_players,
                opponentNames,
            })
        } else {
            setMatch(null)
        }
    }

    // Get user ID
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id)
        })
    }, [])

    // Initial fetch when user ID is available
    useEffect(() => {
        if (userId) checkActiveMatch()
    }, [userId])

    // Keep ref up to date
    useEffect(() => {
        fetchRef.current = checkActiveMatch
    })

    // Real-time subscription for match changes
    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel(`global-match-banner-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'matches' },
                () => {
                    // Reset dismissed state when a new match event comes in
                    setDismissed(null)
                    setTimeout(() => fetchRef.current(), 500) // delay to allow triggers to finish
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    // Don't show if no match or dismissed
    if (!match || dismissed === match.id) return null

    const isInProgress = match.status === 'in_progress'
    const isCompleted = match.status === 'completed'
    const isTeamA = match.teamAPlayers?.includes(userId || '')
    const isTeamB = match.teamBPlayers?.includes(userId || '')
    const userWon = isCompleted && ((isTeamA && match.winner === 'team_a') || (isTeamB && match.winner === 'team_b'))
    const isDraw = isCompleted && match.winner === 'draw'

    let borderColor = 'border-blue-200'
    let iconColor = 'text-blue-600'
    let iconBg = 'bg-blue-100'
    let title = 'You Have an Active Match'
    let BannerIcon = Activity

    if (isInProgress) {
        borderColor = 'border-emerald-300'
        iconColor = 'text-white'
        iconBg = 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]'
        title = match.opponentNames ? `Match In Progress vs ${match.opponentNames}` : 'Match In Progress'
    } else if (isCompleted) {
        borderColor = userWon ? 'border-amber-300' : isDraw ? 'border-gray-200' : 'border-red-200'
        iconColor = userWon ? 'text-amber-500' : isDraw ? 'text-gray-500' : 'text-red-500'
        iconBg = userWon ? 'bg-amber-100' : isDraw ? 'bg-gray-100' : 'bg-red-50'
        title = userWon ? 'Victory!' : isDraw ? 'Draw' : 'Defeat'
        BannerIcon = Trophy
    }

    const ratingChange = isCompleted && userId && match.metadata?.ratingChanges?.[userId]

    return (
        <div className="sticky top-20 z-10 w-full animate-in slide-in-from-top-10 duration-300">
            <div className={`bg-white border-b ${borderColor} shadow-sm`}>
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Icon */}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                                <BannerIcon className={`w-4.5 h-4.5 ${iconColor}`} />
                            </div>

                            {/* Text Info */}
                            <div className="min-w-0 flex flex-col justify-center">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                        {title}
                                    </p>
                                    {isInProgress && match.startedAt && (
                                        <div className="hidden sm:flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <MatchTimer startedAt={match.startedAt} showIcon={false} />
                                        </div>
                                    )}
                                    {ratingChange && (
                                        <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${ratingChange.diff > 0 ? 'bg-green-50 text-green-600' :
                                            ratingChange.diff < 0 ? 'bg-red-50 text-red-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {ratingChange.diff > 0 ? '+' : ''}{ratingChange.diff} ELO
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 truncate mt-0.5">
                                    <span>Match #{match.matchNumber}</span>
                                    <span>•</span>
                                    <span>{match.courtName}</span>
                                    {!isCompleted && match.status === 'scheduled' && (
                                        <>
                                            <span>•</span>
                                            <span className="text-blue-600 font-medium tracking-wide">WAITING TO START</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isCompleted ? (
                                <Link
                                    href={`/queue/${match.courtId}`}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${userWon ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                                        isDraw ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' :
                                            'bg-red-50 text-red-700 hover:bg-red-100'
                                        }`}
                                >
                                    Queue Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href={`/queue/${match.courtId}/match/${match.id}`}
                                    className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    View Match
                                </Link>
                            )}

                            <button
                                onClick={() => setDismissed(match.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-1"
                                aria-label="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
