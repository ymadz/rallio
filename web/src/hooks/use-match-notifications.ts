'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Hook to listen for match assignments and notify the user
 * Displays toast notification when user is assigned to a match
 */
export function useMatchNotifications(userId?: string) {
  const router = useRouter()
  const supabase = createClient()
  const [activeMatch, setActiveMatch] = useState<any>(null)

  useEffect(() => {
    if (!userId) return

    console.log('[useMatchNotifications] 🔔 Setting up match notifications for user:', userId)

    // Subscribe to match assignments
    const channel = supabase
      .channel(`match-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        async (payload) => {
          console.log('[useMatchNotifications] 🎮 New match created:', payload.new)

          const match = payload.new as any

          // Check if user is in this match
          const isTeamA = match.team_a_players?.includes(userId)
          const isTeamB = match.team_b_players?.includes(userId)

          if (isTeamA || isTeamB) {
            console.log('[useMatchNotifications] ✅ User is in this match!')

            // Fetch match details with court info
            const { data: matchDetails } = await supabase
              .from('matches')
              .select(`
                *,
                queue_sessions (
                  court_id,
                  courts (
                    name,
                    venues (
                      name
                    )
                  )
                )
              `)
              .eq('id', match.id)
              .single()

            if (matchDetails) {
              setActiveMatch(matchDetails)

              // Show notification toast
              toast.success("You're assigned to a match!", {
                description: `Match #${match.match_number} • ${matchDetails.queue_sessions?.courts?.name || 'Court'}`,
                duration: 10000,
                action: {
                  label: 'View Match',
                  onClick: () => {
                    router.push(
                      `/queue/${matchDetails.queue_sessions?.court_id}/match/${match.id}`
                    )
                  },
                },
              })

              // Play notification sound
              playNotificationSound()
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
        },
        async (payload) => {
          const match = payload.new as any

          // Check if this is user's active match
          const isUserMatch =
            match.team_a_players?.includes(userId) || match.team_b_players?.includes(userId)

          if (isUserMatch && match.status === 'in_progress' && activeMatch?.status === 'scheduled') {
            console.log('[useMatchNotifications] ▶️ Match started!')

            toast.info('Your match has started!', {
              description: `Match #${match.match_number} is now in progress`,
              duration: 5000,
            })

            setActiveMatch(match)
          }

          if (isUserMatch && match.status === 'completed') {
            console.log('[useMatchNotifications] ✅ Match completed!')

            const winner = match.winner
            const isTeamA = match.team_a_players?.includes(userId)
            const didWin =
              (isTeamA && winner === 'team_a') || (!isTeamA && winner === 'team_b')

            toast.success(didWin ? 'You won! 🎉' : 'Match completed', {
              description: `Final Score: ${match.score_a} - ${match.score_b}`,
              duration: 8000,
            })

            setActiveMatch(null)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('[useMatchNotifications] 🔕 Cleaning up match notifications')
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { activeMatch }
}

/**
 * Play a notification sound
 */
function playNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800 // Frequency in Hz
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (error) {
    console.error('[useMatchNotifications] Failed to play notification sound:', error)
  }
}
