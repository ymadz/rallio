'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all pending queue session approvals for Court Admin's venues
 */
export async function getPendingQueueApprovals() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get all venues owned by this user
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return { success: true, approvals: [] }
    }

    // Get all courts for these venues
    const { data: courts } = await supabase
      .from('courts')
      .select('id, venue_id')
      .in('venue_id', venueIds)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return { success: true, approvals: [] }
    }

    // Get pending queue sessions using the view (if exists) or direct query
    const { data: pendingSessions, error } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        court:courts!inner(
          id,
          name,
          venue:venues!inner(
            id,
            name,
            owner_id
          )
        ),
        organizer:profiles!queue_sessions_organizer_id_fkey(
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .in('court_id', courtIds)
      .eq('approval_status', 'pending')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter to only sessions for venues owned by this user
    const approvals = pendingSessions?.filter((session: any) =>
      session.court?.venue?.owner_id === user.id
    ) || []

    // Fetch player data for each organizer
    const approvalsWithPlayerData = await Promise.all(
      approvals.map(async (session: any) => {
        // Try to get player data for the organizer
        const { data: playerData } = await supabase
          .from('players')
          .select('skill_level, rating')
          .eq('user_id', session.organizer_id)
          .single()

        return {
          id: session.id,
          courtId: session.court_id,
          courtName: session.court?.name,
          venueId: session.court?.venue?.id,
          venueName: session.court?.venue?.name,
          organizerId: session.organizer_id,
          organizerName: session.organizer?.display_name ||
            `${session.organizer?.first_name || ''} ${session.organizer?.last_name || ''}`.trim(),
          organizerAvatar: session.organizer?.avatar_url,
          organizerSkillLevel: playerData?.skill_level,
          organizerRating: playerData?.rating,
          startTime: session.start_time,
          endTime: session.end_time,
          mode: session.mode,
          gameFormat: session.game_format,
          maxPlayers: session.max_players,
          costPerGame: session.cost_per_game,
          isPublic: session.is_public,
          settings: session.settings,
          approvalExpiresAt: session.approval_expires_at,
          createdAt: session.created_at,
        }
      })
    )

    return { success: true, approvals: approvalsWithPlayerData }
  } catch (error: any) {
    console.error('Error fetching pending queue approvals:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a specific queue session for approval review
 */
export async function getQueueSessionForApproval(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: session, error } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        court:courts!inner(
          id,
          name,
          hourly_rate,
          venue:venues!inner(
            id,
            name,
            owner_id
          )
        ),
        organizer:profiles!queue_sessions_organizer_id_fkey(
          id,
          display_name,
          first_name,
          last_name,
          avatar_url,
          phone
        )
      `)
      .eq('id', sessionId)
      .single()

    if (error) throw error

    if (!session) {
      return { success: false, error: 'Queue session not found' }
    }

    // Verify this user is the court admin
    const venueOwnerId = (session as any).court?.venue?.owner_id
    if (venueOwnerId !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    return { success: true, session }
  } catch (error: any) {
    console.error('Error fetching queue session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Approve a queue session
 */
export async function approveQueueSession(
  sessionId: string,
  notes?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get the session and verify ownership
    const { data: session } = await supabase
      .from('queue_sessions')
      .select(`
        id,
        organizer_id,
        court:courts!inner(
          venue:venues!inner(owner_id)
        )
      `)
      .eq('id', sessionId)
      .single()

    if (!session) {
      return { success: false, error: 'Queue session not found' }
    }

    const venueOwnerId = (session as any).court?.venue?.owner_id
    if (venueOwnerId !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Update the session to approved
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        approval_status: 'approved',
        status: 'open', // Change from pending_approval to open
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_notes: notes?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) throw updateError

    // Note: The trigger notify_organizer_approval_decision will automatically
    // create a notification for the organizer

    revalidatePath('/court-admin/approvals')
    revalidatePath('/court-admin')
    revalidatePath('/queue') // Public queue listing

    return { success: true }
  } catch (error: any) {
    console.error('Error approving queue session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject a queue session
 */
export async function rejectQueueSession(
  sessionId: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Please provide a reason for rejection' }
  }

  try {
    // Get the session and verify ownership
    const { data: session } = await supabase
      .from('queue_sessions')
      .select(`
        id,
        organizer_id,
        court:courts!inner(
          venue:venues!inner(owner_id)
        )
      `)
      .eq('id', sessionId)
      .single()

    if (!session) {
      return { success: false, error: 'Queue session not found' }
    }

    const venueOwnerId = (session as any).court?.venue?.owner_id
    if (venueOwnerId !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Update the session to rejected
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        approval_status: 'rejected',
        status: 'cancelled', // Also cancel the session
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) throw updateError

    // Note: The trigger notify_organizer_approval_decision will automatically
    // create a notification for the organizer

    revalidatePath('/court-admin/approvals')
    revalidatePath('/court-admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error rejecting queue session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get approval statistics for Court Admin dashboard
 */
export async function getApprovalStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get user's venues
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return {
        success: true,
        stats: {
          pendingCount: 0,
          approvedToday: 0,
          rejectedToday: 0,
          expiringSoon: 0
        }
      }
    }

    // Get courts for these venues
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .in('venue_id', venueIds)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return {
        success: true,
        stats: {
          pendingCount: 0,
          approvedToday: 0,
          rejectedToday: 0,
          expiringSoon: 0
        }
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const in24Hours = new Date()
    in24Hours.setHours(in24Hours.getHours() + 24)

    // Count pending approvals
    const { data: pending } = await supabase
      .from('queue_sessions')
      .select('id')
      .in('court_id', courtIds)
      .eq('approval_status', 'pending')

    // Count approved today
    const { data: approvedToday } = await supabase
      .from('queue_sessions')
      .select('id')
      .in('court_id', courtIds)
      .eq('approval_status', 'approved')
      .gte('approved_at', today.toISOString())
      .lt('approved_at', tomorrow.toISOString())

    // Count rejected today
    const { data: rejectedToday } = await supabase
      .from('queue_sessions')
      .select('id')
      .in('court_id', courtIds)
      .eq('approval_status', 'rejected')
      .gte('approved_at', today.toISOString())
      .lt('approved_at', tomorrow.toISOString())

    // Count expiring soon (within 24 hours)
    const { data: expiringSoon } = await supabase
      .from('queue_sessions')
      .select('id')
      .in('court_id', courtIds)
      .eq('approval_status', 'pending')
      .lte('approval_expires_at', in24Hours.toISOString())
      .gte('approval_expires_at', new Date().toISOString())

    return {
      success: true,
      stats: {
        pendingCount: pending?.length || 0,
        approvedToday: approvedToday?.length || 0,
        rejectedToday: rejectedToday?.length || 0,
        expiringSoon: expiringSoon?.length || 0
      }
    }
  } catch (error: any) {
    console.error('Error fetching approval stats:', error)
    return { success: false, error: error.message }
  }
}
