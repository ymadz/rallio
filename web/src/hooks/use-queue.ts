'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getQueueDetails,
  joinQueue as joinQueueAction,
  leaveQueue as leaveQueueAction,
  getMyQueues as getMyQueuesAction,
  getNearbyQueues as getNearbyQueuesAction,
  getMyQueueHistory,
} from '@/app/actions/queue-actions'

export interface QueuePlayer {
  id: string
  userId: string
  name: string
  avatarUrl?: string
  skillTier?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  skillLevel?: number
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
  status: 'waiting' | 'active' | 'completed'
  players: QueuePlayer[]
  userPosition: number | null
  estimatedWaitTime: number // in minutes
  maxPlayers: number
  currentPlayers: number
  startTime: Date  // Added startTime
  endTime: Date // Added endTime
  mode: 'casual' | 'competitive'
  organizerId?: string // Queue session organizer
  userGamesPlayed?: number // Games played by current user
  userAmountOwed?: number // Amount owed by current user
  currentMatch?: {
    courtName: string
    players: string[]
    startTime: Date
    duration: number
  }
}

/**
 * Map DB queue session status to player-facing UI status
 * - pending_payment: not shown to players (filtered out before this)
 * - open: session is open for joining -> 'waiting'
 * - active: session is live -> 'active'
 * - completed/cancelled: session ended -> 'completed'
 */
function mapQueueStatusForPlayer(dbStatus: string): 'waiting' | 'active' | 'completed' {
  switch (dbStatus) {
    case 'open':
      return 'waiting'
    case 'active':
      return 'active'
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
          skillTier: getSkillTier(p.skillLevel),
          position: p.position,
          joinedAt: p.joinedAt,
          gamesPlayed: p.gamesPlayed,
          gamesWon: p.gamesWon,
          status: (p as any).status as 'waiting' | 'playing' | 'completed' | 'left' | undefined,
        })),
        userPosition: queueData.userPosition,
        estimatedWaitTime: queueData.estimatedWaitTime,
        maxPlayers: queueData.maxPlayers,
        currentPlayers: queueData.currentPlayers,
        startTime: queueData.startTime,
        endTime: queueData.endTime,
        mode: queueData.mode as 'casual' | 'competitive',
        organizerId: queueData.organizerId,
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

  // Initial fetch
  useEffect(() => {
    fetchQueue()
  }, [courtId])

  // Set up real-time subscription for queue updates
  useEffect(() => {
    if (!queue?.id) return

    console.log('[useQueue] 🔔 Setting up real-time subscription for queue:', queue.id)

    const channel = supabase
      .channel(`queue-${queue.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${queue.id}`,
        },
        (payload) => {
          console.log('[useQueue] 🔔 Queue participants changed:', payload)
          // Refresh queue data when participants change
          fetchQueue()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
          filter: `id=eq.${queue.id}`,
        },
        (payload) => {
          console.log('[useQueue] 🔔 Queue session updated:', payload)
          // Refresh queue data when session changes
          fetchQueue()
        }
      )
      .subscribe()

    return () => {
      console.log('[useQueue] 🔕 Cleaning up real-time subscription')
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

  const fetchMyQueues = async () => {
    console.log('[useMyQueues] 🔍 Fetching user queues')

    try {
      const result = await getMyQueuesAction()

      if (!result.success) {
        console.error('[useMyQueues] ❌ Failed to fetch queues:', result.error)
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
        estimatedWaitTime: q.estimatedWaitTime,
        maxPlayers: q.maxPlayers,
        currentPlayers: q.currentPlayers,
        startTime: q.startTime,
        endTime: q.endTime,
        mode: (q.mode || 'casual') as 'casual' | 'competitive',
      }))

      setQueues(transformedQueues)
      console.log('[useMyQueues] ✅ Loaded queues:', transformedQueues.length)
    } catch (err: any) {
      console.error('[useMyQueues] ❌ Error:', err)
      setQueues([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMyQueues()
  }, [])

  // Set up real-time subscription for user's queue participations
  useEffect(() => {
    console.log('[useMyQueues] 🔔 Setting up real-time subscription')

    const channel = supabase
      .channel('my-queues')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
        },
        () => {
          console.log('[useMyQueues] 🔔 Queue participation changed, refreshing')
          fetchMyQueues()
        }
      )
      .subscribe()

    return () => {
      console.log('[useMyQueues] 🔕 Cleaning up real-time subscription')
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
        estimatedWaitTime: q.estimatedWaitTime,
        maxPlayers: q.maxPlayers,
        currentPlayers: q.currentPlayers,
        startTime: q.startTime,
        endTime: q.endTime,
        mode: (q.mode || 'casual') as 'casual' | 'competitive',
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

  // Set up real-time subscription for queue sessions and participants
  useEffect(() => {
    console.log('[useNearbyQueues] 🔔 Setting up real-time subscriptions')

    const channel = supabase
      .channel('nearby-queues')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_sessions',
        },
        () => {
          console.log('[useNearbyQueues] 🔔 Queue sessions changed, refreshing')
          fetchNearbyQueues()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
        },
        () => {
          console.log('[useNearbyQueues] 🔔 Participant joined/left, refreshing')
          fetchNearbyQueues()
        }
      )
      .subscribe()

    return () => {
      console.log('[useNearbyQueues] 🔕 Cleaning up real-time subscriptions')
      supabase.removeChannel(channel)
    }
  }, [])

  return { queues, isLoading }
}
