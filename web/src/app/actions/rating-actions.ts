'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter'

interface SubmitRatingInput {
  matchId: string
  rateeId: string
  rating: number
  feedback?: string
}

interface RatingRecord {
  id: string
  rater_id: string
  ratee_id: string
  match_id: string
  rating: number
  feedback: string | null
  created_at: string
  rater_profile?: Array<{
    id: string
    display_name: string
    avatar_url: string | null
  }>
}

interface AverageRating {
  averageRating: number
  totalRatings: number
}

/**
 * Submit a player rating after a match
 * Rate limit: 10 submissions per minute per user
 */
export async function submitRating(input: SubmitRatingInput) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: 'You must be logged in to rate players',
    }
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(createRateLimitConfig('SUBMIT_RATING', user.id))
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Too many rating submissions. Please wait ${rateLimitResult.retryAfter} seconds.`,
    }
  }

  // Validate input
  if (!input.matchId || !input.rateeId) {
    return {
      success: false,
      error: 'Match ID and ratee ID are required',
    }
  }

  if (input.rating < 1 || input.rating > 5) {
    return {
      success: false,
      error: 'Rating must be between 1 and 5',
    }
  }

  // Prevent self-rating
  if (input.rateeId === user.id) {
    return {
      success: false,
      error: 'You cannot rate yourself',
    }
  }

  // Verify user participated in the match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, team_a_players, team_b_players, status')
    .eq('id', input.matchId)
    .single()

  if (matchError || !match) {
    return {
      success: false,
      error: 'Match not found',
    }
  }

  // Check if user was in the match
  const userInMatch =
    match.team_a_players?.includes(user.id) || match.team_b_players?.includes(user.id)

  if (!userInMatch) {
    return {
      success: false,
      error: 'You can only rate players from matches you participated in',
    }
  }

  // Check if match is completed
  if (match.status !== 'completed') {
    return {
      success: false,
      error: 'You can only rate players after the match is completed',
    }
  }

  // Check if opponent was in the match
  const opponentInMatch =
    match.team_a_players?.includes(input.rateeId) || match.team_b_players?.includes(input.rateeId)

  if (!opponentInMatch) {
    return {
      success: false,
      error: 'The player you are rating was not in this match',
    }
  }

  try {
    // Insert rating (will fail if duplicate due to unique constraint)
    const { error: insertError } = await supabase.from('player_ratings').insert({
      rater_id: user.id,
      ratee_id: input.rateeId,
      match_id: input.matchId,
      rating: input.rating,
      feedback: input.feedback || null,
    })

    if (insertError) {
      // Handle duplicate rating
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'You have already rated this player for this match',
        }
      }

      throw insertError
    }

    return {
      success: true,
      message: 'Rating submitted successfully',
    }
  } catch (error: any) {
    console.error('[submitRating] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to submit rating',
    }
  }
}

/**
 * Submit ratings for multiple players after a match
 * Rate limit: 10 submissions per minute per user
 */
export async function submitMultipleRatings(ratings: SubmitRatingInput[]) {
  if (!ratings || ratings.length === 0) {
    return {
      success: false,
      error: 'At least one rating is required',
    }
  }

  const results = []

  for (const rating of ratings) {
    const result = await submitRating(rating)
    results.push({
      rateeId: rating.rateeId,
      ...result,
    })
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return {
    success: successCount > 0,
    successCount,
    failCount,
    results,
  }
}

/**
 * Get ratings received by a player
 * Public - anyone can view
 */
export async function getPlayerRatings(
  playerId: string,
  limit: number = 10
): Promise<{ success: boolean; ratings?: RatingRecord[]; error?: string }> {
  const supabase = await createClient()

  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required',
    }
  }

  try {
    const { data, error } = await supabase
      .from('player_ratings')
      .select(
        `
        id,
        rater_id,
        ratee_id,
        match_id,
        rating,
        feedback,
        created_at,
        rater_profile:profiles!player_ratings_rater_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `
      )
      .eq('ratee_id', playerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      ratings: data as RatingRecord[],
    }
  } catch (error: any) {
    console.error('[getPlayerRatings] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch ratings',
    }
  }
}

/**
 * Get average rating and count for a player
 * Public - anyone can view
 */
export async function getPlayerAverageRating(
  playerId: string
): Promise<{ success: boolean; data?: AverageRating; error?: string }> {
  const supabase = await createClient()

  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required',
    }
  }

  try {
    // Use PostgreSQL function if it exists, otherwise calculate manually
    const { data: ratings, error } = await supabase
      .from('player_ratings')
      .select('rating')
      .eq('ratee_id', playerId)

    if (error) throw error

    if (!ratings || ratings.length === 0) {
      return {
        success: true,
        data: {
          averageRating: 0,
          totalRatings: 0,
        },
      }
    }

    const totalRatings = ratings.length
    const sumRatings = ratings.reduce((sum, r) => sum + r.rating, 0)
    const averageRating = sumRatings / totalRatings

    return {
      success: true,
      data: {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings,
      },
    }
  } catch (error: any) {
    console.error('[getPlayerAverageRating] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to calculate average rating',
    }
  }
}

/**
 * Check if user has already rated specific players in a match
 */
export async function checkExistingRatings(matchId: string, rateeIds: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: 'You must be logged in',
    }
  }

  try {
    const { data, error } = await supabase
      .from('player_ratings')
      .select('ratee_id')
      .eq('rater_id', user.id)
      .eq('match_id', matchId)
      .in('ratee_id', rateeIds)

    if (error) throw error

    const alreadyRated = data?.map((r) => r.ratee_id) || []

    return {
      success: true,
      alreadyRated,
    }
  } catch (error: any) {
    console.error('[checkExistingRatings] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to check existing ratings',
    }
  }
}
