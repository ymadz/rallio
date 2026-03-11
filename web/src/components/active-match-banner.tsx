'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, X } from 'lucide-react'
import Link from 'next/link'

interface ActiveMatchInfo {
    id: string
    matchNumber: number
    courtId: string
    courtName: string
    status: string
}

/**
 * Global banner that appears on ALL pages when the user has an active match.
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
        queue_sessions!inner (
          court_id,
          courts ( name )
        )
      `)
            .in('status', ['scheduled', 'in_progress'])
            .or(`team_a_players.cs.{${userId}},team_b_players.cs.{${userId}}`)
            .order('created_at', { ascending: false })
            .limit(1)

        if (matches && matches.length > 0) {
            const m = matches[0] as any
            setMatch({
                id: m.id,
                matchNumber: m.match_number,
                courtId: m.queue_sessions?.court_id,
                courtName: m.queue_sessions?.courts?.name || 'Court',
                status: m.status,
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
                    fetchRef.current()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    // Don't show if no match, loading, or dismissed
    if (!match || dismissed === match.id) return null

    const isInProgress = match.status === 'in_progress'

    return (
        <div className="sticky top-0 z-40 w-full">
            <div className="bg-white border-b border-green-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isInProgress
                                    ? 'bg-green-500 animate-pulse'
                                    : 'bg-green-100'
                                }`}>
                                <Activity className={`w-4.5 h-4.5 ${isInProgress ? 'text-white' : 'text-green-600'}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">
                                    {isInProgress ? 'Match In Progress' : 'You Have an Active Match'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    Match #{match.matchNumber} • {match.courtName}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                                href={`/queue/${match.courtId}/match/${match.id}`}
                                className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                            >
                                View Match
                            </Link>
                            <button
                                onClick={() => setDismissed(match.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
