'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

interface SubmitCourtReviewInput {
  courtId: string
  reservationId?: string
  overallRating: number
  qualityRating?: number
  cleanlinessRating?: number
  facilitiesRating?: number
  valueRating?: number
  review?: string
}

/**
 * Submit a court/venue review
 * Users can only review venues where they've had confirmed bookings
 */
export async function submitCourtReview(input: SubmitCourtReviewInput) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: 'You must be logged in to submit a review',
    }
  }

  // Check rate limit (3 reviews per hour)
  const rateLimitResult = await checkRateLimit(createRateLimitConfig('SUBMIT_RATING', user.id))
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Too many review submissions. Please wait ${rateLimitResult.retryAfter} seconds.`,
    }
  }

  // Validate input
  if (!input.courtId) {
    return {
      success: false,
      error: 'Court ID is required',
    }
  }

  if (input.overallRating < 1 || input.overallRating > 5) {
    return {
      success: false,
      error: 'Overall rating must be between 1 and 5',
    }
  }

  // Validate breakdown ratings if provided
  const breakdownRatings = [
    input.qualityRating,
    input.cleanlinessRating,
    input.facilitiesRating,
    input.valueRating,
  ]
  for (const rating of breakdownRatings) {
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return {
        success: false,
        error: 'All ratings must be between 1 and 5',
      }
    }
  }

  try {
    // Get court details (to verify it exists and get venue info)
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .select(`
        id,
        name,
        venue_id,
        venue:venues (
          id,
          name,
          owner_id
        )
      `)
      .eq('id', input.courtId)
      .single()

    if (courtError || !court) {
      return {
        success: false,
        error: 'Court not found',
      }
    }

    // Check if user has a confirmed booking at this court
    const { data: bookings, error: bookingError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('court_id', input.courtId)
      .eq('status', 'confirmed')
      .limit(1)

    if (bookingError) {
      console.error('Error checking bookings:', bookingError)
      return {
        success: false,
        error: 'Failed to verify booking history',
      }
    }

    // Allow review if user has at least one confirmed booking
    if (!bookings || bookings.length === 0) {
      return {
        success: false,
        error: 'You can only review venues where you have confirmed bookings',
      }
    }

    // Use the provided reservationId if available, otherwise use the first confirmed booking
    const reservationId = input.reservationId || bookings[0]?.id

    // Check if user has already reviewed this court for this reservation
    if (reservationId) {
      const { data: existingReview } = await supabase
        .from('court_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('court_id', input.courtId)
        .eq('reservation_id', reservationId)
        .single()

      if (existingReview) {
        return {
          success: false,
          error: 'You have already reviewed this court for this booking',
        }
      }
    }

    // Insert the review
    const { data: newReview, error: insertError } = await supabase
      .from('court_ratings')
      .insert({
        user_id: user.id,
        court_id: input.courtId,
        reservation_id: reservationId,
        overall_rating: input.overallRating,
        quality_rating: input.qualityRating,
        cleanliness_rating: input.cleanlinessRating,
        facilities_rating: input.facilitiesRating,
        value_rating: input.valueRating,
        review: input.review,
        is_verified: true, // Mark as verified since we checked booking history
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting review:', insertError)
      return {
        success: false,
        error: 'Failed to submit review. Please try again.',
      }
    }

    // Notify venue owner about new review
    const venue = Array.isArray(court.venue) ? court.venue[0] : court.venue
    if (venue?.owner_id) {
      await createNotification({
        userId: venue.owner_id,
        type: 'review_received',
        title: 'New Review Received',
        message: `${input.overallRating} ★ review for ${court.name} at ${venue.name}`,
        actionUrl: `/court-admin/venues/${court.venue_id}?tab=reviews`,
      })
    }

    // Revalidate venue pages to show new review
    revalidatePath(`/courts/${court.venue_id}`)
    revalidatePath(`/courts/${court.venue_id}/book`)

    return {
      success: true,
      reviewId: newReview.id,
      message: 'Review submitted successfully!',
    }
  } catch (error) {
    console.error('Error submitting review:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Get user's review for a specific court/reservation
 */
export async function getUserCourtReview(courtId: string, reservationId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated', review: null }
  }

  try {
    let query = supabase
      .from('court_ratings')
      .select(`
        id,
        court_id,
        reservation_id,
        overall_rating,
        quality_rating,
        cleanliness_rating,
        facilities_rating,
        value_rating,
        review,
        created_at
      `)
      .eq('user_id', user.id)
      .eq('court_id', courtId)

    if (reservationId) {
      query = query.eq('reservation_id', reservationId)
    }

    const { data: review, error } = await query.maybeSingle()

    if (error) {
      console.error('Error fetching user review:', error)
      return { success: false, error: 'Failed to fetch review', review: null }
    }

    return { success: true, review }
  } catch (error) {
    console.error('Error getting user review:', error)
    return { success: false, error: 'An unexpected error occurred', review: null }
  }
}

/**
 * Check if user can review a court (has confirmed booking)
 */
export async function canUserReviewCourt(courtId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { canReview: false, reason: 'not_authenticated' }
  }

  try {
    // Check for confirmed bookings
    const { data: bookings, error: bookingError } = await supabase
      .from('reservations')
      .select('id, status, start_time')
      .eq('user_id', user.id)
      .eq('court_id', courtId)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: false })
      .limit(1)

    if (bookingError) {
      console.error('Error checking booking eligibility:', bookingError)
      return { canReview: false, reason: 'error' }
    }

    if (!bookings || bookings.length === 0) {
      return { canReview: false, reason: 'no_bookings' }
    }

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from('court_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('court_id', courtId)
      .maybeSingle()

    if (existingReview) {
      return { canReview: false, reason: 'already_reviewed' }
    }

    return {
      canReview: true,
      reason: 'eligible',
      bookings: bookings.map((b) => ({ id: b.id, startTime: b.start_time })),
    }
  } catch (error) {
    console.error('Error checking review eligibility:', error)
    return { canReview: false, reason: 'error' }
  }
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(reviewId: string, isHelpful: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in' }
  }

  try {
    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('rating_helpful_votes')
      .select('id, is_helpful')
      .eq('rating_id', reviewId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabase
        .from('rating_helpful_votes')
        .update({ is_helpful: isHelpful })
        .eq('id', existingVote.id)

      if (updateError) {
        console.error('Error updating vote:', updateError)
        return { success: false, error: 'Failed to update vote' }
      }
    } else {
      // Insert new vote
      const { error: insertError } = await supabase
        .from('rating_helpful_votes')
        .insert({
          rating_id: reviewId,
          user_id: user.id,
          is_helpful: isHelpful,
        })

      if (insertError) {
        console.error('Error inserting vote:', insertError)
        return { success: false, error: 'Failed to record vote' }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error marking review helpful:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
