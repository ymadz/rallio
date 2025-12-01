'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from './admin-audit-actions'

/**
 * Verify user is a global admin
 */
async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', user.id)
    .eq('role.name', 'global_admin')
    .single()

  if (!roles) {
    throw new Error('Unauthorized - Global admin access required')
  }

  return { user, supabase }
}

/**
 * Get all flagged court reviews for moderation
 */
export async function getFlaggedReviews(filters?: {
  status?: 'pending' | 'resolved' | 'dismissed'
  orderBy?: 'newest' | 'oldest' | 'rating'
}) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    let query = supabase
      .from('court_ratings')
      .select(`
        id,
        overall_rating,
        quality_rating,
        cleanliness_rating,
        facilities_rating,
        value_rating,
        review,
        created_at,
        updated_at,
        metadata,
        user:profiles!user_id(id, display_name, email, avatar_url),
        court:courts(
          id,
          name,
          venue:venues(id, name, owner_id)
        )
      `)
      .not('metadata->flagged', 'is', null)
      .eq('metadata->flagged', 'true')

    // Apply ordering
    if (filters?.orderBy === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else if (filters?.orderBy === 'rating') {
      query = query.order('overall_rating', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error } = await query

    if (error) throw error

    // Filter by resolution status if provided
    let filteredData = data
    if (filters?.status) {
      filteredData = data.filter((review: any) => {
        const metadata = review.metadata || {}
        const resolved = metadata.moderationResolved || false
        const dismissed = metadata.moderationDismissed || false

        if (filters.status === 'resolved') return resolved
        if (filters.status === 'dismissed') return dismissed
        if (filters.status === 'pending') return !resolved && !dismissed
        return true
      })
    }

    return { success: true, reviews: filteredData }
  } catch (error: any) {
    console.error('Error fetching flagged reviews:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get moderation statistics
 */
export async function getModerationStats() {
  try {
    const { supabase } = await verifyGlobalAdmin()

    // Get flagged reviews count
    const { count: flaggedCount } = await supabase
      .from('court_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->flagged', 'true')
      .is('metadata->moderationResolved', null)
      .is('metadata->moderationDismissed', null)

    // Get total flagged (including resolved)
    const { count: totalFlagged } = await supabase
      .from('court_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->flagged', 'true')

    // Get banned users count
    const { count: bannedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)

    // Get recent moderation actions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: recentActions } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .in('action_type', ['CONTENT_MODERATION', 'USER_BAN', 'USER_UNBAN', 'REVIEW_DELETE'])
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Get resolved flags count
    const { count: resolvedCount } = await supabase
      .from('court_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->flagged', 'true')
      .eq('metadata->moderationResolved', 'true')

    return {
      success: true,
      stats: {
        pendingFlags: flaggedCount || 0,
        totalFlagged: totalFlagged || 0,
        resolvedFlags: resolvedCount || 0,
        bannedUsers: bannedUsers || 0,
        recentActions: recentActions || 0
      }
    }
  } catch (error: any) {
    console.error('Error fetching moderation stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Resolve a flagged review (dismiss the flag without deleting)
 */
export async function resolveFlaggedReview(
  reviewId: string,
  action: 'dismiss' | 'delete' | 'ban_user',
  notes?: string
) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    // Get the review
    const { data: review } = await supabase
      .from('court_ratings')
      .select('*, user:profiles!user_id(id, email, display_name)')
      .eq('id', reviewId)
      .single()

    if (!review) {
      return { success: false, error: 'Review not found' }
    }

    const metadata = (review.metadata as any) || {}

    if (action === 'dismiss') {
      // Dismiss the flag but keep the review
      metadata.moderationDismissed = true
      metadata.moderationResolvedBy = user.id
      metadata.moderationResolvedAt = new Date().toISOString()
      metadata.moderationNotes = notes || 'Flag dismissed - no violation found'

      const { error } = await supabase
        .from('court_ratings')
        .update({ metadata })
        .eq('id', reviewId)

      if (error) throw error

      await logAdminAction(
        user.id,
        'CONTENT_MODERATION',
        'court_ratings',
        reviewId,
        { action: 'dismiss_flag', notes }
      )
    } else if (action === 'delete') {
      // Delete the review
      const { error } = await supabase
        .from('court_ratings')
        .delete()
        .eq('id', reviewId)

      if (error) throw error

      await logAdminAction(
        user.id,
        'REVIEW_DELETE',
        'court_ratings',
        reviewId,
        { reason: notes || 'Violated content policy' }
      )
    } else if (action === 'ban_user') {
      // Ban the user who created the review
      const { error: banError } = await supabase
        .from('profiles')
        .update({ 
          is_banned: true,
          is_active: false,
          metadata: { 
            banned_at: new Date().toISOString(),
            banned_by: user.id,
            ban_reason: notes || 'Content policy violation'
          }
        })
        .eq('id', (review.user as any).id)

      if (banError) throw banError

      // Mark review as resolved
      metadata.moderationResolved = true
      metadata.moderationResolvedBy = user.id
      metadata.moderationResolvedAt = new Date().toISOString()
      metadata.moderationNotes = notes || 'User banned for policy violation'

      await supabase
        .from('court_ratings')
        .update({ metadata })
        .eq('id', reviewId)

      await logAdminAction(
        user.id,
        'USER_BAN',
        'profiles',
        (review.user as any).id,
        { reason: notes, related_review: reviewId }
      )
    }

    revalidatePath('/admin/moderation')
    return { success: true, message: 'Action completed successfully' }
  } catch (error: any) {
    console.error('Error resolving flagged review:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get recently banned users
 */
export async function getBannedUsers() {
  try {
    const { supabase } = await verifyGlobalAdmin()

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, metadata, created_at')
      .eq('is_banned', true)
      .order('metadata->banned_at', { ascending: false })

    if (error) throw error

    return { success: true, users: data }
  } catch (error: any) {
    console.error('Error fetching banned users:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Unban a user
 */
export async function unbanUser(userId: string, notes?: string) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    const { error } = await supabase
      .from('profiles')
      .update({
        is_banned: false,
        is_active: true,
        metadata: {
          unbanned_at: new Date().toISOString(),
          unbanned_by: user.id,
          unban_notes: notes
        }
      })
      .eq('id', userId)

    if (error) throw error

    await logAdminAction(
      user.id,
      'USER_UNBAN',
      'profiles',
      userId,
      { notes }
    )

    revalidatePath('/admin/moderation')
    revalidatePath('/admin/users')
    return { success: true, message: 'User unbanned successfully' }
  } catch (error: any) {
    console.error('Error unbanning user:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get recent moderation activity
 */
export async function getRecentModerationActivity(limit: number = 20) {
  try {
    const { supabase } = await verifyGlobalAdmin()

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select(`
        id,
        action_type,
        target_type,
        target_id,
        metadata,
        created_at,
        admin:profiles!admin_id(id, display_name, email)
      `)
      .in('action_type', ['CONTENT_MODERATION', 'USER_BAN', 'USER_UNBAN', 'REVIEW_DELETE'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, activities: data }
  } catch (error: any) {
    console.error('Error fetching moderation activity:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete multiple flagged reviews in batch
 */
export async function batchDeleteReviews(reviewIds: string[], reason: string) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    const { error } = await supabase
      .from('court_ratings')
      .delete()
      .in('id', reviewIds)

    if (error) throw error

    // Log each deletion
    for (const reviewId of reviewIds) {
      await logAdminAction(
        user.id,
        'REVIEW_DELETE',
        'court_ratings',
        reviewId,
        { reason, batch: true }
      )
    }

    revalidatePath('/admin/moderation')
    return { success: true, message: `${reviewIds.length} reviews deleted` }
  } catch (error: any) {
    console.error('Error batch deleting reviews:', error)
    return { success: false, error: error.message }
  }
}
