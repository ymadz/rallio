'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Verify user has global_admin role
 */
async function verifyGlobalAdmin() {
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
  if (!auth.success) return auth

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
      .eq('approval_status', 'approved')

    const { count: pendingVenues } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending')

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
  if (!auth.success) return auth

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
      .select('id, name, created_at, approval_status')
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
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: auth.user!.id,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId,
      old_value: params.oldValue,
      new_value: params.newValue,
    })

    return { success: true }
  } catch (error: any) {
    console.error('[logAdminAction] Error:', error)
    return { success: false, error: error.message }
  }
}
