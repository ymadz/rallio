'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { type User } from '@supabase/supabase-js'

type VerifyAdminResult =
  | { success: true; user: User }
  | { success: false; error: string }

/**
 * Verify user has global_admin role
 */
async function verifyGlobalAdmin(): Promise<VerifyAdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner (name)')
    .eq('user_id', user.id)

  const isGlobalAdmin = roles?.some((r: any) => r.roles?.name === 'global_admin')

  if (!isGlobalAdmin) {
    return { success: false, error: 'Requires global admin role' }
  }

  return { success: true, user }
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return { success: false, error: auth.error }

  const supabase = await createClient()

  try {
    // Get total users count and 30-day growth
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: newUsers30Days } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Get venue statistics
    const { count: totalVenues } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })

    const { count: activeVenues } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_verified', true)

    const { count: pendingVenues } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', false)

    // Get monthly revenue (last 30 days)
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const monthlyRevenue = revenueData?.reduce((sum, payment) =>
      sum + parseFloat(payment.amount || '0'), 0
    ) || 0

    // Get active queue sessions
    const { count: activeQueueSessions } = await supabase
      .from('queue_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'active'])

    // Get platform rating (average across all venues)
    const { data: ratingsData } = await supabase
      .from('venues')
      .select('rating')
      .not('rating', 'is', null)

    const platformRating = ratingsData && ratingsData.length > 0
      ? ratingsData.reduce((sum, v) => sum + (v.rating || 0), 0) / ratingsData.length
      : 0

    // Calculate user growth percentage
    const userGrowthPercent = totalUsers && totalUsers > 0
      ? ((newUsers30Days || 0) / totalUsers) * 100
      : 0

    return {
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        newUsers30Days: newUsers30Days || 0,
        userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
        totalVenues: totalVenues || 0,
        activeVenues: activeVenues || 0,
        pendingVenues: pendingVenues || 0,
        monthlyRevenue: Math.round(monthlyRevenue),
        activeQueueSessions: activeQueueSessions || 0,
        platformRating: Math.round(platformRating * 10) / 10,
      }
    }
  } catch (error: any) {
    console.error('[getDashboardStats] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get recent activity
 */
export async function getRecentActivity() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return { success: false, error: auth.error }

  const supabase = await createClient()

  try {
    // Get last 10 user signups
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get last 10 venues created
    const { data: recentVenues } = await supabase
      .from('venues')
      .select('id, name, created_at, is_verified')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get last 10 bookings
    const { data: recentBookings } = await supabase
      .from('reservations')
      .select('id, created_at, status, courts(name, venues(name))')
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      success: true,
      activity: {
        recentUsers: recentUsers || [],
        recentVenues: recentVenues || [],
        recentBookings: recentBookings || [],
      }
    }
  } catch (error: any) {
    console.error('[getRecentActivity] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Log admin action to audit trail
 */
export async function logAdminAction(params: {
  actionType: string
  targetType?: string
  targetId?: string
  oldValue?: any
  newValue?: any
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return { success: false, error: auth.error }

  const supabase = await createClient()
  const headersList = await headers()
  const ip_address = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || null
  const user_agent = headersList.get('user-agent') || null

  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: auth.user!.id,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId,
      old_value: params.oldValue,
      new_value: params.newValue,
      ip_address,
      user_agent,
    })

    return { success: true }
  } catch (error: any) {
    console.error('[logAdminAction] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get system-wide queue session history
 */
export async function getGlobalQueueHistory(filters?: {
  venueId?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return { success: false, error: auth.error }

  const supabase = await createClient()

  try {
    let query = supabase
      .from('queue_sessions')
      .select(`
        *,
        court:courts!inner(
          id,
          name,
          venue:venues!inner(
            id,
            name
          )
        ),
        organizer:profiles!inner(
          display_name,
          email
        )
      `)
      .order('start_time', { ascending: false })
      .limit(filters?.limit || 50)

    // Apply filters
    if (filters?.venueId && filters.venueId !== 'all') {
      query = query.eq('court.venue_id', filters.venueId)
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    } else {
      // Default to closed/cancelled if not specified, or show all? 
      // Admin might want to see active too. Let's show all by default but sort by date.
    }
    if (filters?.startDate) {
      query = query.gte('start_time', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('start_time', filters.endDate)
    }

    const { data: sessions, error } = await query

    if (error) throw error

    // Format for display
    const formattedSessions = sessions?.map(s => ({
      id: s.id,
      venueName: s.court?.venue?.name,
      courtName: s.court?.name,
      organizerName: s.organizer?.display_name || 'Unknown',
      startTime: new Date(s.start_time),
      endTime: new Date(s.end_time),
      status: s.status,
      maxPlayers: s.max_players,
      costPerGame: s.cost_per_game,
      totalRevenue: s.settings?.summary?.totalRevenue || 0,
      totalGames: s.settings?.summary?.totalGames || 0,
      closedBy: s.settings?.summary?.closedBy || 'unknown',
    }))

    return { success: true, sessions: formattedSessions }
  } catch (error: any) {
    console.error('[getGlobalQueueHistory] Error:', error)
    return { success: false, error: error.message }
  }
}
