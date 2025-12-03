/**
 * Queue store using Zustand
 * Manages queue sessions and real-time subscriptions
 */

import { create } from 'zustand'
import { supabase } from '@/services/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type QueueSession = {
  id: string
  venue_id: string
  court_id: string | null
  host_id: string
  session_date: string
  start_time: string
  end_time: string | null
  max_players: number
  price_per_game: number
  payment_required_upfront: boolean
  status: 'active' | 'paused' | 'ended'
  created_at: string
  updated_at: string
  venue?: {
    id: string
    name: string
    address: string
  }
  court?: {
    id: string
    name: string
  }
  participants_count?: number
}

type QueueParticipant = {
  id: string
  queue_session_id: string
  player_id: string
  join_time: string
  position: number
  games_played: number
  amount_owed: number
  amount_paid: number
  status: 'waiting' | 'playing' | 'completed' | 'left'
  player: {
    id: string
    user_id: string
    skill_level: number | null
    total_games_played: number
    current_elo: number
    profiles: {
      full_name: string | null
      avatar_url: string | null
    }
  }
}

type QueueState = {
  activeSessions: QueueSession[]
  currentSession: QueueSession | null
  participants: QueueParticipant[]
  myParticipation: QueueParticipant | null
  isLoading: boolean
  subscription: RealtimeChannel | null
  fetchActiveSessions: () => Promise<void>
  fetchSessionDetails: (sessionId: string) => Promise<void>
  joinQueue: (sessionId: string, playerId: string) => Promise<void>
  leaveQueue: (participantId: string) => Promise<void>
  subscribeToSession: (sessionId: string) => void
  unsubscribeFromSession: () => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  activeSessions: [],
  currentSession: null,
  participants: [],
  myParticipation: null,
  isLoading: false,
  subscription: null,

  fetchActiveSessions: async () => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('queue_sessions')
        .select(
          `
          *,
          venue:venues(id, name, address),
          court:courts(id, name)
        `
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ activeSessions: data || [], isLoading: false })
    } catch (error) {
      console.error('Failed to fetch active sessions:', error)
      set({ isLoading: false })
    }
  },

  fetchSessionDetails: async (sessionId: string) => {
    try {
      set({ isLoading: true })

      // Fetch session
      const { data: session, error: sessionError } = await supabase
        .from('queue_sessions')
        .select(
          `
          *,
          venue:venues(id, name, address),
          court:courts(id, name)
        `
        )
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      // Fetch participants
      const { data: participants, error: participantsError } = await supabase
        .from('queue_participants')
        .select(
          `
          *,
          player:players(
            id,
            user_id,
            skill_level,
            total_games_played,
            current_elo,
            profiles(full_name, avatar_url)
          )
        `
        )
        .eq('queue_session_id', sessionId)
        .order('position', { ascending: true })

      if (participantsError) throw participantsError

      set({
        currentSession: session,
        participants: participants || [],
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to fetch session details:', error)
      set({ isLoading: false })
    }
  },

  joinQueue: async (sessionId: string, playerId: string) => {
    try {
      const { error } = await supabase.from('queue_participants').insert({
        queue_session_id: sessionId,
        player_id: playerId,
        status: 'waiting',
      })

      if (error) throw error

      // Refresh session details
      await get().fetchSessionDetails(sessionId)
    } catch (error) {
      console.error('Failed to join queue:', error)
      throw error
    }
  },

  leaveQueue: async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('queue_participants')
        .update({ status: 'left' })
        .eq('id', participantId)

      if (error) throw error
    } catch (error) {
      console.error('Failed to leave queue:', error)
      throw error
    }
  },

  subscribeToSession: (sessionId: string) => {
    const subscription = supabase
      .channel(`queue_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${sessionId}`,
        },
        () => {
          // Refresh participants when changes occur
          get().fetchSessionDetails(sessionId)
        }
      )
      .subscribe()

    set({ subscription })
  },

  unsubscribeFromSession: () => {
    const { subscription } = get()
    if (subscription) {
      subscription.unsubscribe()
      set({ subscription: null })
    }
  },
}))
