'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter'
import { createBulkNotifications, NotificationTemplates } from '@/lib/notifications'
import { calculateNewEloRating } from '@rallio/shared/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Match Management Server Actions
 * Handles game assignment, match tracking, and score recording for queue sessions
 */

export interface MatchData {
  id: string
  queueSessionId: string
  courtId: string
  matchNumber: number
  gameFormat: 'singles' | 'doubles' | 'any'
  teamAPlayers: string[]
  teamBPlayers: string[]
  scoreA?: number
  scoreB?: number
  winner?: 'team_a' | 'team_b' | 'draw'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  startedAt?: Date
  completedAt?: Date
}

/**
 * Assign top players from queue to a new match
 * Queue Master action
 * @param sessionId - The queue session ID
 * @param numPlayers - Number of players (default 4 for doubles)
 * @param selectedPlayers - Optional: Specific player user IDs to assign (overrides auto-selection)
 * @param teamAssignments - Optional: Pre-assigned teams { teamA: string[], teamB: string[] }
 */
export async function assignMatchFromQueue(
  sessionId: string,
  numPlayers: number = 4,
  selectedPlayers?: string[],
  teamAssignments?: { teamA: string[], teamB: string[] }
) {
  console.log('[assignMatchFromQueue] 🎯 Assigning match from queue:', { sessionId, numPlayers, selectedPlayers, teamAssignments })

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('ASSIGN_MATCH', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[assignMatchFromQueue] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many match assignment attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Only queue master can assign matches' }
    }

    let participants: any[]

    // If specific players are selected, use those; otherwise get top N waiting
    if (selectedPlayers && selectedPlayers.length > 0) {
      // Get the selected participants
      const { data: selectedParticipants, error: selectedError } = await supabase
        .from('queue_participants')
        .select('*')
        .eq('queue_session_id', sessionId)
        .eq('status', 'waiting')
        .is('left_at', null)
        .in('user_id', selectedPlayers)

      if (selectedError || !selectedParticipants) {
        return { success: false, error: 'Failed to fetch selected participants' }
      }

      if (selectedParticipants.length !== selectedPlayers.length) {
        const foundIds = selectedParticipants.map(p => p.user_id)
        const missingIds = selectedPlayers.filter(id => !foundIds.includes(id))
        return {
          success: false,
          error: `Some selected players are not in the waiting queue: ${missingIds.length} player(s) missing`,
        }
      }

      participants = selectedParticipants
      console.log('[assignMatchFromQueue] 📋 Using manually selected players:', participants.length)
    } else {
      // Get top N waiting participants (original behavior)
      const { data: topParticipants, error: participantsError } = await supabase
        .from('queue_participants')
        .select('*')
        .eq('queue_session_id', sessionId)
        .eq('status', 'waiting')
        .is('left_at', null)
        .order('joined_at', { ascending: true })
        .limit(numPlayers)

      if (participantsError || !topParticipants || topParticipants.length < numPlayers) {
        return {
          success: false,
          error: `Not enough waiting players. Need ${numPlayers}, found ${topParticipants?.length || 0}`,
        }
      }

      participants = topParticipants
      console.log('[assignMatchFromQueue] 📋 Using top waiting players:', participants.length)
    }

    // Get current match count for this session
    const { count: matchCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('queue_session_id', sessionId)

    const matchNumber = (matchCount || 0) + 1

    // Split players into two teams
    let teamA: string[]
    let teamB: string[]

    // If team assignments are provided, use those
    if (teamAssignments && teamAssignments.teamA.length > 0 && teamAssignments.teamB.length > 0) {
      teamA = teamAssignments.teamA
      teamB = teamAssignments.teamB
      console.log('[assignMatchFromQueue] 📋 Using manually assigned teams:', { teamA, teamB })
    } else if (session.mode === 'competitive') {
      // Skill-based team balancing for competitive mode
      console.log('[assignMatchFromQueue] 🎯 Using skill-based team balancing')

      // Get player skill levels
      const { data: players } = await supabase
        .from('players')
        .select('user_id, skill_level')
        .in(
          'user_id',
          participants.map(p => p.user_id)
        )

      // Map skill levels to participants
      const participantsWithSkill = participants.map(p => ({
        ...p,
        skillLevel: players?.find(pl => pl.user_id === p.user_id)?.skill_level || 5,
      }))

      // Sort by skill level descending (highest first)
      const sorted = [...participantsWithSkill].sort((a, b) => b.skillLevel - a.skillLevel)

      // Proper team balancing: snake draft algorithm
      const teamAList: typeof sorted = []
      const teamBList: typeof sorted = []
      const teamSize = numPlayers / 2

      for (let i = 0; i < sorted.length; i++) {
        const player = sorted[i]

        // Snake draft pattern: 1st -> Team A, 2nd -> Team B, 3rd -> Team B, 4th -> Team A, etc.
        // This ensures better balance than always adding to the team with lower total
        if (i % 4 === 0 || i % 4 === 3) {
          // Picks 1, 4, 5, 8, etc. go to Team A
          if (teamAList.length < teamSize) {
            teamAList.push(player)
          } else {
            teamBList.push(player)
          }
        } else {
          // Picks 2, 3, 6, 7, etc. go to Team B
          if (teamBList.length < teamSize) {
            teamBList.push(player)
          } else {
            teamAList.push(player)
          }
        }
      }

      teamA = teamAList.map(p => p.user_id)
      teamB = teamBList.map(p => p.user_id)

      const avgSkillA = teamAList.reduce((sum, p) => sum + p.skillLevel, 0) / teamAList.length
      const avgSkillB = teamBList.reduce((sum, p) => sum + p.skillLevel, 0) / teamBList.length

      console.log('[assignMatchFromQueue] 📊 Team balance:', {
        teamA: { players: teamA.length, avgSkill: avgSkillA.toFixed(2), playerSkills: teamAList.map(p => p.skillLevel) },
        teamB: { players: teamB.length, avgSkill: avgSkillB.toFixed(2), playerSkills: teamBList.map(p => p.skillLevel) },
        skillDifference: Math.abs(avgSkillA - avgSkillB).toFixed(2),
      })
    } else {
      // Simple sequential split for casual games
      console.log('[assignMatchFromQueue] 🎲 Using sequential split (casual mode)')
      teamA = participants.slice(0, numPlayers / 2).map(p => p.user_id)
      teamB = participants.slice(numPlayers / 2).map(p => p.user_id)
    }

    // Create match record
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        queue_session_id: sessionId,
        court_id: session.court_id,
        match_number: matchNumber,
        game_format: session.game_format,
        team_a_players: teamA,
        team_b_players: teamB,
        status: 'scheduled',
      })
      .select()
      .single()

    if (matchError || !match) {
      console.error('[assignMatchFromQueue] ❌ Failed to create match:', matchError)
      return { success: false, error: 'Failed to create match' }
    }

    // Update participants status to 'playing'
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({ status: 'playing' })
      .in(
        'id',
        participants.map(p => p.id)
      )

    if (updateError) {
      console.error('[assignMatchFromQueue] ⚠️ Failed to update participant status:', updateError)
    }

    // 🔔 Send notifications to all assigned players
    const { data: court } = await supabase
      .from('courts')
      .select('name')
      .eq('id', session.court_id)
      .single()

    const courtName = court?.name || 'Court'

    const notificationData = participants.map(p => ({
      userId: p.user_id,
      ...NotificationTemplates.queueMatchAssigned(matchNumber, courtName, sessionId, match.id),
    }))

    await createBulkNotifications(notificationData)
    console.log('[assignMatchFromQueue] 📬 Sent notifications to', participants.length, 'players')

    console.log('[assignMatchFromQueue] ✅ Match assigned successfully:', {
      matchId: match.id,
      matchNumber,
      playerCount: numPlayers,
    })

    // Revalidate paths
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath('/queue')

    return { success: true, match }
  } catch (error: any) {
    console.error('[assignMatchFromQueue] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to assign match' }
  }
}

/**
 * Start a match (mark as in progress)
 */
export async function startMatch(matchId: string) {
  console.log('[startMatch] ▶️ Starting match:', matchId)

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('START_MATCH', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[startMatch] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many start match attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get match and verify permissions
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        queue_sessions (
          organizer_id,
          court_id
        )
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found' }
    }

    // Check if user is organizer or participant
    const isOrganizer = match.queue_sessions?.organizer_id === user.id
    const isParticipant =
      match.team_a_players.includes(user.id) || match.team_b_players.includes(user.id)

    if (!isOrganizer && !isParticipant) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update match status
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', matchId)

    if (updateError) {
      console.error('[startMatch] ❌ Failed to start match:', updateError)
      return { success: false, error: 'Failed to start match' }
    }

    console.log('[startMatch] ✅ Match started successfully')

    revalidatePath(`/queue/${match.queue_sessions.court_id}`)

    return { success: true }
  } catch (error: any) {
    console.error('[startMatch] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to start match' }
  }
}

/**
 * Calculate skill level based on ELO rating
 * Rating ranges correspond to skill levels 1-10
 */
function calculateSkillLevel(rating: number): number {
  if (rating < 1200) return 1
  if (rating < 1300) return 2
  if (rating < 1400) return 3
  if (rating < 1500) return 4
  if (rating < 1600) return 5
  if (rating < 1700) return 6
  if (rating < 1800) return 7
  if (rating < 1900) return 8
  if (rating < 2000) return 9
  return 10
}



/**
 * Record match score and update participant stats
 */
export async function recordMatchScore(
  matchId: string,
  scores: {
    winner: 'team_a' | 'team_b' | 'draw'
    metadata?: any
  }
) {
  console.log('[recordMatchScore] 📊 Recording match winner:', { matchId, winner: scores.winner })

  try {
    const supabase = await createClient()
    // Service client bypasses RLS — needed because the QM updates participants they don't own
    const serviceDb = createServiceClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('RECORD_SCORE', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[recordMatchScore] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many score recording attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get match details (auth client is fine for reads with RLS)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        queue_sessions (
          organizer_id,
          court_id,
          cost_per_game
        )
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found' }
    }

    // Verify user is organizer
    if (match.queue_sessions?.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Only queue master can record results' }
    }

    // Validate match status
    if (match.status === 'completed') {
      return { success: false, error: 'Match already completed' }
    }
    if (match.status === 'scheduled') {
      return { success: false, error: 'Match not started yet. Please start the match first.' }
    }
    if (match.status === 'cancelled') {
      return { success: false, error: 'Cannot record result for cancelled match' }
    }

    // Call RPC via service client so it runs with full DB permissions
    const { data: rpcResult, error: rpcError } = await serviceDb.rpc('update_match_results', {
      p_match_id: matchId,
      p_winner: scores.winner,
      p_metadata: scores.metadata || null
    })

    const rpcFailed = rpcError || (rpcResult && !rpcResult.success)

    if (rpcFailed) {
      console.warn('[recordMatchScore] ⚠️ RPC failed, running service-client fallback:', rpcError || rpcResult?.error)
    } else {
      // RPC succeeded — save rating changes to match metadata so clients can display them
      if (rpcResult?.ratingChanges && Object.keys(rpcResult.ratingChanges).length > 0) {
        console.log('[recordMatchScore] 📈 Saving rating changes to metadata:', rpcResult.ratingChanges)
        const currentMetadata = scores.metadata || {}
        await serviceDb.from('matches').update({
          metadata: { ...currentMetadata, ratingChanges: rpcResult.ratingChanges }
        }).eq('id', matchId)
      }
    }

    // Fallback: run via service client if RPC failed (bypasses RLS for cross-user updates)
    if (rpcFailed) {
      const allPlayerIds = [...(match.team_a_players || []), ...(match.team_b_players || [])]
      const costPerGame = parseFloat(match.queue_sessions?.cost_per_game || '0')
      console.log('[recordMatchScore] 🔄 Service fallback: updating participants, cost_per_game:', costPerGame)

      for (const playerId of allPlayerIds) {
        const isWinner = scores.winner === 'team_a'
          ? (match.team_a_players || []).includes(playerId)
          : scores.winner === 'team_b'
            ? (match.team_b_players || []).includes(playerId)
            : false

        const { data: current } = await serviceDb
          .from('queue_participants')
          .select('games_played, games_won, amount_owed')
          .eq('queue_session_id', match.queue_session_id)
          .eq('user_id', playerId)
          .single()

        if (!current) {
          console.warn('[recordMatchScore] ⚠️ Participant not found for fallback:', playerId)
          continue
        }

        const { error: partError } = await serviceDb
          .from('queue_participants')
          .update({
            status: 'waiting',
            games_played: (current.games_played || 0) + 1,
            games_won: isWinner ? (current.games_won || 0) + 1 : (current.games_won || 0),
            amount_owed: (parseFloat(current.amount_owed || '0')) + costPerGame,
            joined_at: new Date().toISOString(),
          })
          .eq('queue_session_id', match.queue_session_id)
          .eq('user_id', playerId)

        if (partError) {
          console.error('[recordMatchScore] ❌ Service fallback update failed for player', playerId, partError)
        } else {
          console.log('[recordMatchScore] ✅ Service fallback updated player', playerId)
        }
      }
    } // end rpcFailed fallback

    // GUARANTEED STATUS RESET via service client (catches any edge case where RPC skipped the status)
    const allMatchPlayers = [...(match.team_a_players || []), ...(match.team_b_players || [])]
    const { error: statusResetError } = await serviceDb
      .from('queue_participants')
      .update({
        status: 'waiting',
        joined_at: new Date().toISOString(),
      })
      .eq('queue_session_id', match.queue_session_id)
      .in('user_id', allMatchPlayers)
      .eq('status', 'playing')

    if (statusResetError) {
      console.error('[recordMatchScore] ⚠️ Status reset failed:', statusResetError)
    } else {
      console.log('[recordMatchScore] ✅ Status reset to waiting for', allMatchPlayers.length, 'players')
    }

    console.log('[recordMatchScore] ✅ Match recorded, rpcFailed:', rpcFailed)

    revalidatePath(`/queue/${match.queue_sessions.court_id}`)
    revalidatePath(`/queue-master/sessions/${match.queue_session_id}`)
    revalidatePath('/queue')
    revalidatePath('/queue-master')

    return { success: true }
  } catch (error: any) {
    console.error('[recordMatchScore] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to record match result' }
  }
}

/**
 * Get active match for a player
 */
export async function getActiveMatch(playerId?: string) {
  console.log('[getActiveMatch] 🔍 Getting active match for player')

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const targetPlayerId = playerId || user.id

    // Find active or in_progress match for this player
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        queue_sessions (
          *,
          courts (
            name,
            venues (
              name
            )
          )
        )
      `)
      .in('status', ['scheduled', 'in_progress'])
      .order('created_at', { ascending: false })

    if (matchError) {
      console.error('[getActiveMatch] ❌ Failed to fetch matches:', matchError)
      return { success: false, error: 'Failed to fetch match' }
    }

    // Filter matches where player is a participant
    const activeMatch = matches?.find(
      (m: any) =>
        m.team_a_players.includes(targetPlayerId) || m.team_b_players.includes(targetPlayerId)
    )

    if (!activeMatch) {
      return { success: true, match: null }
    }

    console.log('[getActiveMatch] ✅ Found active match:', activeMatch.id)

    return { success: true, match: activeMatch }
  } catch (error: any) {
    console.error('[getActiveMatch] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to get active match' }
  }
}

/**
 * Return players to queue after match ends
 * (Note: This is handled automatically in recordMatchScore by setting status back to 'waiting')
 */
export async function returnPlayersToQueue(matchId: string) {
  console.log('[returnPlayersToQueue] 🔄 Returning players to queue')

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        queue_sessions (
          organizer_id,
          court_id
        )
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found' }
    }

    // Verify user is organizer
    if (match.queue_sessions?.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get all participants in this match
    const allPlayers = [...match.team_a_players, ...match.team_b_players]

    // Update their status back to waiting
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        status: 'waiting',
      })
      .eq('queue_session_id', match.queue_session_id)
      .in('user_id', allPlayers)

    if (updateError) {
      console.error('[returnPlayersToQueue] ❌ Failed to update participants:', updateError)
      return { success: false, error: 'Failed to return players to queue' }
    }

    console.log('[returnPlayersToQueue] ✅ Players returned to queue')

    revalidatePath(`/queue/${match.queue_sessions.court_id}`)

    return { success: true }
  } catch (error: any) {
    console.error('[returnPlayersToQueue] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to return players to queue' }
  }
}

/**
 * QM override: manually reset a stuck participant from 'playing' back to 'waiting'
 * Used when a match was completed but participant status wasn't updated
 */
export async function resetPlayerToWaiting(
  participantId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Verify caller is the session organizer
    const { data: session } = await supabase
      .from('queue_sessions')
      .select('organizer_id, court_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.organizer_id !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    const { error } = await supabase
      .from('queue_participants')
      .update({
        status: 'waiting',
        joined_at: new Date().toISOString(),
      })
      .eq('id', participantId)
      .eq('queue_session_id', sessionId)

    if (error) {
      console.error('[resetPlayerToWaiting] ❌ Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath('/queue-master')

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * QM override: reset ALL stuck 'playing' participants in a session back to 'waiting'
 */
export async function resetAllPlayersToWaiting(
  sessionId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
      .from('queue_sessions')
      .select('organizer_id, court_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.organizer_id !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    const { data, error } = await supabase
      .from('queue_participants')
      .update({
        status: 'waiting',
        joined_at: new Date().toISOString(),
      })
      .eq('queue_session_id', sessionId)
      .eq('status', 'playing')
      .select('id')

    if (error) {
      console.error('[resetAllPlayersToWaiting] ❌ Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath('/queue-master')

    return { success: true, count: data?.length || 0 }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
