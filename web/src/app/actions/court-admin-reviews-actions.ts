'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all reviews for a venue's courts
 */
export async function getVenueReviews(
  venueId: string,
  filters?: {
    minRating?: number
    maxRating?: number
    hasResponse?: boolean
    courtId?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id, name')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get all courts for this venue
    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .eq('venue_id', venueId)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return { success: true, reviews: [] }
    }

    // Build query for ratings
    let query = supabase
      .from('court_ratings')
      .select(`
        *,
        court:courts(id, name),
        user:profiles(id, display_name, first_name, last_name, avatar_url),
        response:rating_responses(id, response, created_at)
      `)
      .in('court_id', courtIds)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters?.minRating) {
      query = query.gte('overall_rating', filters.minRating)
    }
    if (filters?.maxRating) {
      query = query.lte('overall_rating', filters.maxRating)
    }
    if (filters?.courtId) {
      query = query.eq('court_id', filters.courtId)
    }

    const { data: ratings, error } = await query

    if (error) throw error

    // Filter by hasResponse if specified
    const rawReviews = ratings || []

    // Map to the structure expected by the UI
    let reviews = rawReviews.map(r => {
      // Postgres returns array for one-to-many joins unless specified as single
      const responseArr = Array.isArray(r.response) ? r.response : (r.response ? [r.response] : [])
      const latestResponse = responseArr.length > 0 ? responseArr[0] : null

      const userObj = Array.isArray(r.user) ? r.user[0] : r.user
      const courtObj = Array.isArray(r.court) ? r.court[0] : r.court

      return {
        id: r.id,
        rating: r.overall_rating,
        comment: r.comment,
        customerName: userObj?.display_name || (userObj?.first_name ? `${userObj.first_name} ${userObj.last_name || ''}`.trim() : 'Anonymous Player'),
        customerAvatar: userObj?.avatar_url,
        courtName: courtObj?.name || 'Unknown Court',
        date: r.created_at,
        helpful: 0, // Not in schema yet
        isReported: r.metadata?.flagged === true,
        response: latestResponse ? {
          text: latestResponse.response,
          date: latestResponse.created_at
        } : undefined
      }
    })

    if (filters?.hasResponse !== undefined) {
      reviews = reviews.filter(r => filters.hasResponse ? r.response !== undefined : r.response === undefined)
    }

    return { success: true, reviews }
  } catch (error: any) {
    console.error('Error fetching venue reviews:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Respond to a review (Court Admin)
 */
export async function respondToReview(
  reviewId: string,
  response: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!response || response.trim().length === 0) {
    return { success: false, error: 'Response cannot be empty' }
  }

  if (response.length > 1000) {
    return { success: false, error: 'Response is too long (max 1000 characters)' }
  }

  try {
    // Get the rating and verify ownership
    const { data: rating } = await supabase
      .from('court_ratings')
      .select(`
        id,
        court:courts!inner(
          id,
          venue:venues!inner(id, owner_id)
        )
      `)
      .eq('id', reviewId)
      .single()

    if (!rating) {
      return { success: false, error: 'Review not found' }
    }

    const venueOwnerId = (rating as any).court?.venue?.owner_id
    if (venueOwnerId !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    const venueId = (rating as any).court?.venue?.id

    // Check if response already exists
    const { data: existingResponse } = await supabase
      .from('rating_responses')
      .select('id')
      .eq('rating_id', reviewId)
      .single()

    if (existingResponse) {
      // Update existing response
      const { error } = await supabase
        .from('rating_responses')
        .update({
          response: response.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResponse.id)

      if (error) throw error
    } else {
      // Create new response
      const { error } = await supabase
        .from('rating_responses')
        .insert({
          rating_id: reviewId,
          venue_id: venueId,
          responder_id: user.id,
          response: response.trim()
        })

      if (error) throw error
    }

    revalidatePath('/court-admin/reviews')
    revalidatePath('/court-admin')
    revalidatePath('/courts') // Public court pages

    return { success: true }
  } catch (error: any) {
    console.error('Error responding to review:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Flag a review as inappropriate (for moderation)
 * This doesn't delete the review, but marks it for Global Admin review
 */
export async function flagReview(
  reviewId: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Please provide a reason for flagging' }
  }

  try {
    // Get the rating and verify ownership
    const { data: rating } = await supabase
      .from('court_ratings')
      .select(`
        id,
        metadata,
        court:courts!inner(
          venue:venues!inner(owner_id)
        )
      `)
      .eq('id', reviewId)
      .single()

    if (!rating) {
      return { success: false, error: 'Review not found' }
    }

    const venueOwnerId = (rating as any).court?.venue?.owner_id
    if (venueOwnerId !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Add flag to metadata
    const metadata = (rating.metadata as any) || {}
    const flags = metadata.flags || []

    flags.push({
      flaggedBy: user.id,
      reason: reason.trim(),
      flaggedAt: new Date().toISOString()
    })

    const { error } = await supabase
      .from('court_ratings')
      .update({
        metadata: { ...metadata, flags, flagged: true }
      })
      .eq('id', reviewId)

    if (error) throw error

    // TODO: Create notification for Global Admin to review

    revalidatePath('/court-admin/reviews')
    revalidatePath('/court-admin')

    return { success: true, message: 'Review flagged for moderation' }
  } catch (error: any) {
    console.error('Error flagging review:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get review statistics for a venue
 */
export async function getReviewStats(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get all courts
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('venue_id', venueId)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return {
        success: true,
        stats: {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviewsWithResponse: 0,
          reviewsWithoutResponse: 0
        }
      }
    }

    // Get all ratings
    const { data: ratings } = await supabase
      .from('court_ratings')
      .select(`
        overall_rating,
        response:rating_responses(id)
      `)
      .in('court_id', courtIds)

    const totalReviews = ratings?.length || 0
    const averageRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.overall_rating, 0) / ratings.length
      : 0

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratings?.forEach(r => {
      ratingDistribution[r.overall_rating] = (ratingDistribution[r.overall_rating] || 0) + 1
    })

    const reviewsWithResponse = ratings?.filter((r: any) => r.response !== null).length || 0
    const reviewsWithoutResponse = totalReviews - reviewsWithResponse

    return {
      success: true,
      stats: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        reviewsWithResponse,
        reviewsWithoutResponse
      }
    }
  } catch (error: any) {
    console.error('Error fetching review stats:', error)
    return { success: false, error: error.message }
  }
}
