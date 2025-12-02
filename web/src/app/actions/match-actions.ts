'use server'

import { createClient } from '@/lib/supabase/server'
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
  gameFormat: 'singles' | 'doubles' | 'mixed'
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
 */
export async function assignMatchFromQueue(sessionId: string, numPlayers: number = 4) {
  console.log('[assignMatchFromQueue] 🎯 Assigning match from queue:', { sessionId, numPlayers })

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

    // Get top N waiting participants
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('queue_session_id', sessionId)
      .eq('status', 'waiting')
      .is('left_at', null)
      .order('joined_at', { ascending: true })
      .limit(numPlayers)

    if (participantsError || !participants || participants.length < numPlayers) {
      return {
        success: false,
        error: `Not enough waiting players. Need ${numPlayers}, found ${participants?.length || 0}`,
      }
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

    if (session.mode === 'competitive') {
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

      // Sort by skill level descending
      const sorted = [...participantsWithSkill].sort((a, b) => b.skillLevel - a.skillLevel)

      // Snake draft: alternate teams to balance skill
      const teamAList: typeof sorted = []
      const teamBList: typeof sorted = []

      for (const player of sorted) {
        const sumA = teamAList.reduce((sum, p) => sum + p.skillLevel, 0)
        const sumB = teamBList.reduce((sum, p) => sum + p.skillLevel, 0)

        // Add to team with lower total skill (or team A if equal)
        if (sumA <= sumB && teamAList.length < numPlayers / 2) {
          teamAList.push(player)
        } else if (teamBList.length < numPlayers / 2) {
          teamBList.push(player)
        } else {
          teamAList.push(player)
        }
      }

      teamA = teamAList.map(p => p.user_id)
      teamB = teamBList.map(p => p.user_id)

      const avgSkillA = teamAList.reduce((sum, p) => sum + p.skillLevel, 0) / teamAList.length
      const avgSkillB = teamBList.reduce((sum, p) => sum + p.skillLevel, 0) / teamBList.length

      console.log('[assignMatchFromQueue] 📊 Team balance:', {
        teamA: { players: teamA.length, avgSkill: avgSkillA.toFixed(2) },
        teamB: { players: teamB.length, avgSkill: avgSkillB.toFixed(2) },
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
 * Update player ELO ratings, skill levels, and match statistics
 * Only applies to competitive queue sessions
 */
async function updatePlayerRatingsAndStats(
  supabase: SupabaseClient,
  match: any,
  winner: 'team_a' | 'team_b' | 'draw',
  allPlayers: string[],
  winners: string[]
) {
  try {
    // Check if this is a competitive match
    const { data: queueSession } = await supabase
      .from('queue_sessions')
      .select('mode')
      .eq('id', match.queue_session_id)
      .single()

    const isCompetitive = queueSession?.mode === 'competitive'
    
    console.log('[updatePlayerRatingsAndStats] 🎯 Match mode:', queueSession?.mode, '- Updating ratings:', isCompetitive)

    // Get all player data
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, user_id, rating, skill_level, total_games_played, total_wins, total_losses')
      .in('user_id', allPlayers)

    if (playersError || !players) {
      console.error('[updatePlayerRatingsAndStats] ❌ Error fetching players:', playersError)
      return
    }

    const playerMap = new Map(players.map(p => [p.user_id, p]))

    // Update each player's stats and rating
    for (const playerId of allPlayers) {
      const player = playerMap.get(playerId)
      if (!player) continue

      const won = winners.includes(playerId)
      const isDraw = winner === 'draw'

      // Update basic stats (always, regardless of mode)
      const totalGamesPlayed = (player.total_games_played || 0) + 1
      const totalWins = won && !isDraw ? (player.total_wins || 0) + 1 : player.total_wins || 0
      const totalLosses = !won && !isDraw ? (player.total_losses || 0) + 1 : player.total_losses || 0

      const updateData: any = {
        total_games_played: totalGamesPlayed,
        total_wins: totalWins,
        total_losses: totalLosses,
      }

      // Update ELO rating and skill level (only for competitive matches)
      if (isCompetitive) {
        const currentRating = parseFloat(player.rating?.toString() || '1500')
        
        // Calculate average opponent rating
        const opponentIds = won 
          ? allPlayers.filter(id => !winners.includes(id))
          : winners
        
        const opponentRatings = opponentIds
          .map(id => parseFloat(playerMap.get(id)?.rating?.toString() || '1500'))
        
        const avgOpponentRating = opponentRatings.length > 0
          ? opponentRatings.reduce((sum, r) => sum + r, 0) / opponentRatings.length
          : 1500

        // Calculate new rating (K-factor of 32 for standard chess ELO)
        const newRating = isDraw
          ? currentRating // No rating change for draws
          : calculateNewEloRating(currentRating, avgOpponentRating, won, 32)

        // Calculate new skill level based on rating
        const newSkillLevel = calculateSkillLevel(newRating)

        updateData.rating = newRating
        
        // Only update skill level if it changed (respects the ±2 level restriction in profile updates)
        if (newSkillLevel !== player.skill_level) {
          const levelDiff = Math.abs(newSkillLevel - (player.skill_level || 5))
          
          // Auto-update skill level only if within ±2 levels
          if (levelDiff <= 2) {
            updateData.skill_level = newSkillLevel
            updateData.skill_level_updated_at = new Date().toISOString()
            
            console.log(`[updatePlayerRatingsAndStats] 📈 Player ${playerId} skill updated: ${player.skill_level} → ${newSkillLevel} (rating: ${currentRating} → ${newRating})`)
          } else {
            console.log(`[updatePlayerRatingsAndStats] ⚠️ Player ${playerId} skill change too large: ${player.skill_level} → ${newSkillLevel} (would exceed ±2 limit)`)
          }
        }

        console.log(`[updatePlayerRatingsAndStats] 🏆 Player ${playerId} rating updated: ${currentRating} → ${newRating} (${won ? 'won' : 'lost'})`)
      }

      // Update player record
      const { error: updateError } = await supabase
        .from('players')
        .update(updateData)
        .eq('user_id', playerId)

      if (updateError) {
        console.error(`[updatePlayerRatingsAndStats] ❌ Error updating player ${playerId}:`, updateError)
      }
    }

    console.log('[updatePlayerRatingsAndStats] ✅ Player ratings and stats updated')
  } catch (error) {
    console.error('[updatePlayerRatingsAndStats] ❌ Error:', error)
  }
}

/**
 * Record match score and update participant stats
 */
export async function recordMatchScore(
  matchId: string,
  scores: {
    teamAScore: number
    teamBScore: number
    winner: 'team_a' | 'team_b' | 'draw'
    metadata?: any
  }
) {
  console.log('[recordMatchScore] 📊 Recording match score:', { matchId, scores })

  try {
    const supabase = await createClient()

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

    // Get match details
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
      return { success: false, error: 'Unauthorized: Only queue master can record scores' }
    }

    // Validate match status
    if (match.status === 'completed') {
      return { success: false, error: 'Match already completed' }
    }
    if (match.status === 'scheduled') {
      return { success: false, error: 'Match not started yet. Please start the match first.' }
    }
    if (match.status === 'cancelled') {
      return { success: false, error: 'Cannot record score for cancelled match' }
    }

    // Update match with final scores
    const updateData: any = {
      score_a: scores.teamAScore,
      score_b: scores.teamBScore,
      winner: scores.winner,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }

    if (scores.metadata) {
      updateData.metadata = scores.metadata
    }

    const { error: updateMatchError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId)

    if (updateMatchError) {
      console.error('[recordMatchScore] ❌ Failed to update match:', updateMatchError)
      return { success: false, error: 'Failed to update match' }
    }

    // Update participant stats
    const allPlayers = [...match.team_a_players, ...match.team_b_players]
    const winners = scores.winner === 'team_a' ? match.team_a_players : match.team_b_players
    const costPerGame = parseFloat(match.queue_sessions?.cost_per_game || '0')

    for (const playerId of allPlayers) {
      const won = winners.includes(playerId)

      // Get current participant data
      const { data: participant } = await supabase
        .from('queue_participants')
        .select('*')
        .eq('queue_session_id', match.queue_session_id)
        .eq('user_id', playerId)
        .single()

      if (participant) {
        const newGamesPlayed = (participant.games_played || 0) + 1
        const newGamesWon = won ? (participant.games_won || 0) + 1 : participant.games_won || 0
        const newAmountOwed = (participant.amount_owed || 0) + costPerGame

        await supabase
          .from('queue_participants')
          .update({
            games_played: newGamesPlayed,
            games_won: newGamesWon,
            amount_owed: newAmountOwed,
            status: 'waiting', // Return to waiting after match
          })
          .eq('id', participant.id)
      }
    }

    // Update player ELO ratings and stats (only for competitive matches)
    await updatePlayerRatingsAndStats(
      supabase,
      match,
      scores.winner,
      allPlayers,
      winners
    )

    console.log('[recordMatchScore] ✅ Score recorded successfully')

    revalidatePath(`/queue/${match.queue_sessions.court_id}`)
    revalidatePath('/queue')

    return { success: true }
  } catch (error: any) {
    console.error('[recordMatchScore] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to record score' }
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
