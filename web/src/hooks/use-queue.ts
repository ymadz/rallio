'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getQueueDetails,
  joinQueue as joinQueueAction,
  leaveQueue as leaveQueueAction,
  getMyQueues as getMyQueuesAction,
  getNearbyQueues as getNearbyQueuesAction,
  getMyQueueHistory,
  getQueueMasterHistory,
} from '@/app/actions/queue-actions'

export interface QueuePlayer {
  id: string
  userId: string
  name: string
  avatarUrl?: string
  skillTier?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  skillLevel?: number
  rating?: number
  position: number
  joinedAt: Date
  gamesPlayed: number
  gamesWon: number
  status?: 'waiting' | 'playing' | 'completed' | 'left'
}

export interface QueueSession {
  id: string
  courtId: string
  courtName: string
  venueName: string
  venueId: string
  status: 'waiting' | 'active' | 'completed' | 'pending_payment'
  players: QueuePlayer[]
  userPosition: number | null
  maxPlayers: number
  currentPlayers: number
  startTime: Date  // Added startTime
  endTime: Date // Added endTime
  mode: 'casual' | 'competitive'
  gameFormat?: 'singles' | 'doubles' | 'any'
  joinWindowHours?: number | null
  organizerId?: string // Queue session organizer
  organizerName?: string // Queue session organizer display name
  costPerGame?: number // Cost per game in the queue
  userGamesPlayed?: number // Games played by current user
  userAmountOwed?: number // Amount owed by current user
  sessionSummary?: {
    totalGames: number
    totalRevenue: number
    totalParticipants: number
    unpaidBalances: number
    completedAt?: string
  }
  matchOutcomes?: Array<{
    matchNumber: number
    winnerNames: string[]
    loserNames: string[]
    score: string
    completedAt?: string
    result: 'team_a' | 'team_b' | 'draw'
  }>
  currentMatch?: {
    courtName: string
    players: string[]
    startTime: Date
    duration: number
  }
  minSkillLevel?: number | null
  maxSkillLevel?: number | null
}

/**
 * Map DB queue session status to player-facing UI status
 * - pending_payment: not shown to players (filtered out before this)
 * - open: session is open for joining -> 'waiting'
 * - active: session is live -> 'active'
 * - completed/cancelled: session ended -> 'completed'
 */
function mapQueueStatusForPlayer(dbStatus: string): 'waiting' | 'active' | 'completed' | 'pending_payment' {
  switch (dbStatus) {
    case 'open':
      return 'waiting'
    case 'active':
      return 'active'
    case 'pending_payment':
      return 'pending_payment'
    case 'completed':
    case 'cancelled':
    case 'closed': // legacy
    default:
      return 'completed'
  }
}

/**
 * Convert skill level number (1-10) to skill tier label
 */
function getSkillTier(skillLevel: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (skillLevel <= 3) return 'beginner'
  if (skillLevel <= 6) return 'intermediate'
  if (skillLevel <= 8) return 'advanced'
  return 'expert'
}

/**
 * Hook for queue state management with real-time updates
 */
export function useQueue(courtId: string) {
  const [queue, setQueue] = useState<QueueSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch queue data
  const fetchQueue = async () => {
    console.log('[useQueue] 🔍 Fetching queue for court:', courtId)

    try {
      const result = await getQueueDetails(courtId)

      if (!result.success) {
        // Use the specific error from the server if available
        setError(result.error || 'Failed to load queue details')
        setQueue(null)
        return
      }

      if (!result.queue) {
        // No active queue for this court
        setQueue(null)
        setError(null)
        return
      }

      const queueData = result.queue

      // Transform data to match UI interface
      const transformedQueue: QueueSession = {
        id: queueData.id,
        courtId: queueData.courtId,
        courtName: queueData.courtName,
        venueName: queueData.venueName,
        venueId: queueData.venueId,
        status: mapQueueStatusForPlayer(queueData.status),
        players: queueData.players.map(p => ({
          id: p.id,
          userId: p.userId,
          name: p.playerName,
          avatarUrl: p.avatarUrl,
          skillLevel: p.skillLevel,
          rating: p.rating,
          skillTier: getSkillTier(p.skillLevel),
          position: p.position,
          joinedAt: p.joinedAt,
          gamesPlayed: p.gamesPlayed,
          gamesWon: p.gamesWon,
          status: (p as any).status as 'waiting' | 'playing' | 'completed' | 'left' | undefined,
        })),
        userPosition: queueData.userPosition,
        maxPlayers: queueData.maxPlayers,
        currentPlayers: queueData.currentPlayers,
        startTime: queueData.startTime,
        endTime: queueData.endTime,
        mode: queueData.mode as 'casual' | 'competitive',
        gameFormat: queueData.gameFormat as 'singles' | 'doubles' | 'any' | undefined,
        joinWindowHours: (queueData as any).joinWindowHours ?? null,
        organizerId: queueData.organizerId,
        organizerName: queueData.organizerName,
        costPerGame: queueData.costPerGame,
        sessionSummary: (queueData as any).sessionSummary,
        matchOutcomes: (queueData as any).matchOutcomes,
        minSkillLevel: queueData.minSkillLevel,
        maxSkillLevel: queueData.maxSkillLevel,
      }

      setQueue(transformedQueue)
      setError(null)
      console.log('[useQueue] ✅ Queue loaded:', {
        sessionId: transformedQueue.id,
        playerCount: transformedQueue.players.length,
        userPosition: transformedQueue.userPosition,
      })
    } catch (err: any) {
      console.error('[useQueue] ❌ Error fetching queue:', err)
      setError(err.message || 'Failed to load queue')
      setQueue(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Keep fetchQueue ref up to date so real-time callbacks always call the latest version
  fetchRef.current = fetchQueue

  // Debounced fetch for real-time events (avoids flooding on batch updates)
  const debouncedFetch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchRef.current()
    }, 300)
  }

  // Initial fetch
  useEffect(() => {
    fetchQueue()
  }, [courtId])

  // Early subscription on courtId — avoids the gap between initial fetch and session ID being known
  // This catches any status changes to the queue session while data is still loading.
  useEffect(() => {
    const earlyChannel = supabase
      .channel(`queue-early-${courtId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
          filter: `court_id=eq.${courtId}`,
        },
        (payload) => {
          // Only trigger if no queue loaded yet (once queue is set, the session-specific sub takes over)
          if (!queue?.id) debouncedFetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(earlyChannel)
    }
  }, [courtId])

  // Session-specific subscription (granular, filtered — kicks in once session ID is known)
  useEffect(() => {
    if (!queue?.id) return

    const sessionId = queue.id

    const channel = supabase
      .channel(`queue-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${sessionId}`,
        },
        () => debouncedFetch()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `queue_session_id=eq.${sessionId}`,
        },
        () => debouncedFetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => debouncedFetch()
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [queue?.id])


  const joinQueue = async () => {
    console.log('[useQueue] ➕ Joining queue')

    if (!queue) {
      setError('No queue session found')
      return
    }

    try {
      const result = await joinQueueAction(queue.id)

      if (!result.success) {
        setError(result.error || 'Failed to join queue')
        return
      }

      // Refresh queue data
      await fetchQueue()
      console.log('[useQueue] ✅ Successfully joined queue')
    } catch (err: any) {
      console.error('[useQueue] ❌ Error joining queue:', err)
      setError(err.message || 'Failed to join queue')
    }
  }

  const leaveQueue = async (): Promise<{ success: boolean; requiresPayment?: boolean; amountOwed?: number; gamesPlayed?: number; error?: string }> => {
    console.log('[useQueue] ➖ Leaving queue')

    if (!queue) {
      setError('No queue session found')
      return { success: false, error: 'No queue session found' }
    }

    try {
      const result = await leaveQueueAction(queue.id)

      if (!result.success) {
        if ((result as any).requiresPayment) {
          // Payment required - return this info to the caller without setting global error
          console.log('[useQueue] ⚠️ Payment required to leave queue')
          return {
            success: false,
            requiresPayment: true,
            amountOwed: (result as any).amountOwed,
            gamesPlayed: (result as any).gamesPlayed,
            error: 'Payment required',
          }
        }
        setError(result.error || 'Failed to leave queue')
        return { success: false, error: result.error || 'Failed to leave queue' }
      }

      // Refresh queue data
      await fetchQueue()
      console.log('[useQueue] ✅ Successfully left queue')
      return { success: true }
    } catch (err: any) {
      console.error('[useQueue] ❌ Error leaving queue:', err)
      setError(err.message || 'Failed to leave queue')
      return { success: false, error: err.message || 'Failed to leave queue' }
    }
  }

  const refreshQueue = async () => {
    console.log('[useQueue] 🔄 Manually refreshing queue')
    setIsLoading(true)
    await fetchQueue()
  }

  return {
    queue,
    isLoading,
    error,
    joinQueue,
    leaveQueue,
    refreshQueue,
  }
}

/**
 * Hook to fetch all active queues for the current user
 */
export function useMyQueues() {
  const [queues, setQueues] = useState<QueueSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdsRef = useRef<string[]>([])

  const fetchMyQueues = async () => {
    try {
      const result = await getMyQueuesAction()

      if (!result.success) {
        setQueues([])
        return
      }

      const transformedQueues: QueueSession[] = (result.queues || []).map((q: any) => ({
        id: q.id,
        courtId: q.courtId,
        courtName: q.courtName,
        venueName: q.venueName,
        venueId: q.venueId,
        status: mapQueueStatusForPlayer(q.status),
        players: q.players || [],
        userPosition: q.userPosition,
        maxPlayers: q.maxPlayers,
        currentPlayers: q.currentPlayers,
        startTime: q.startTime,
        endTime: q.endTime,
        mode: (q.mode || 'casual') as 'casual' | 'competitive',
        costPerGame: q.costPerGame,
        organizerName: q.organizerName,
        minSkillLevel: q.minSkillLevel,
        maxSkillLevel: q.maxSkillLevel,
      }))

      sessionIdsRef.current = transformedQueues.map(q => q.id)
      setQueues(transformedQueues)
    } catch (err: any) {
      console.error('[useMyQueues] ❌ Error:', err)
      setQueues([])
    } finally {
      setIsLoading(false)
    }
  }

  const debouncedFetch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchMyQueues(), 500)
  }

  useEffect(() => {
    fetchMyQueues()
  }, [])

  // Subscribe only to queue_sessions that belong to this user (filtered via current user's auth)
  // We subscribe broadly to queue_participants changes for JOIN/LEAVE events that affect the user.
  // The server action already filters by user.id, so stale data from other sessions won't appear.
  useEffect(() => {
    // Subscribe only to queue_sessions UPDATE, filtered to sessions the user is in.
    // The update_queue_count DB trigger updates current_players on queue_sessions whenever
    // a participant joins/leaves, so we don't need a separate queue_participants subscription.
    const channel = supabase
      .channel('my-queues-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
        },
        (payload) => {
          // Only refetch if the updated session is one the user is in
          const changedId = (payload.new as any)?.id
          if (changedId && sessionIdsRef.current.includes(changedId)) {
            debouncedFetch()
          }
        }
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  return { queues, isLoading }
}

/**
 * Hook to fetch user's queue history
 */
export function useMyQueueHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { success, history: data, error } = await getMyQueueHistory()
        if (success && data) {
          setHistory(data)
        } else {
          console.error('Error fetching history:', error)
          setHistory([])
        }
      } catch (err) {
        console.error('Error fetching history:', err)
        setHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [])

  return { history, isLoading }
}

/**
 * Hook to fetch queue sessions organized by the current queue master
 */
export function useQueueMasterHistory(enabled = true) {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setHistory([])
      setIsLoading(false)
      return
    }

    async function fetchQueueMasterHistory() {
      setIsLoading(true)
      try {
        const { success, history: data, error } = await getQueueMasterHistory()
        if (success && data) {
          setHistory(data)
        } else {
          console.error('Error fetching queue master history:', error)
          setHistory([])
        }
      } catch (err) {
        console.error('Error fetching queue master history:', err)
        setHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchQueueMasterHistory()
  }, [enabled])

  return { history, isLoading }
}

/**
 * Hook to fetch available queues near the user
 */
export function useNearbyQueues(latitude?: number, longitude?: number) {
  const [queues, setQueues] = useState<QueueSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchNearbyQueues = async () => {
    console.log('[useNearbyQueues] 🔍 Fetching nearby queues')

    try {
      const result = await getNearbyQueuesAction(latitude, longitude)

      if (!result.success) {
        console.error('[useNearbyQueues] ❌ Failed to fetch queues:', result.error)
        setQueues([])
        return
      }

      const transformedQueues: QueueSession[] = (result.queues || []).map((q: any) => ({
        id: q.id,
        courtId: q.courtId,
        courtName: q.courtName,
        venueName: q.venueName,
        venueId: q.venueId,
        status: mapQueueStatusForPlayer(q.status),
        players: q.players || [],
        userPosition: q.userPosition,
        maxPlayers: q.maxPlayers,
        currentPlayers: q.currentPlayers,
        startTime: q.startTime,
        endTime: q.endTime,
        mode: (q.mode || 'casual') as 'casual' | 'competitive',
        costPerGame: q.costPerGame,
        organizerName: q.organizerName,
        minSkillLevel: q.minSkillLevel,
        maxSkillLevel: q.maxSkillLevel,
      }))

      setQueues(transformedQueues)
      console.log('[useNearbyQueues] ✅ Loaded queues:', transformedQueues.length)
    } catch (err: any) {
      console.error('[useNearbyQueues] ❌ Error:', err)
      setQueues([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNearbyQueues()
  }, [latitude, longitude])

  // Debounce ref to avoid flooding on bursts of changes
  const nearbyDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedNearbyFetch = () => {
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current)
    nearbyDebounceRef.current = setTimeout(fetchNearbyQueues, 600)
  }

  // Real-time: subscribe to queue_sessions INSERT (new sessions) and UPDATE for active statuses.
  // The update_queue_count DB trigger updates current_players on the session row when participants
  // join/leave, so a queue_sessions UPDATE covers both status changes AND player count changes.
  useEffect(() => {
    const channel = supabase
      .channel('nearby-queues-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'queue_sessions',
        },
        debouncedNearbyFetch
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
        },
        debouncedNearbyFetch
      )
      .subscribe()

    return () => {
      if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  return { queues, isLoading }
}
