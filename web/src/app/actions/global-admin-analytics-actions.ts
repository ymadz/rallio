'use server'

import { createClient } from '@/lib/supabase/server'

async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles:role_id(name)')
    .eq('user_id', user.id)

  const isGlobalAdmin = userRoles?.some((ur: any) => ur.roles?.name === 'global_admin')
  if (!isGlobalAdmin) {
    return { success: false, error: 'Unauthorized: Global admin access required' }
  }

  return { success: true, user }
}

export async function getAnalyticsSummary() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    // Total users by role
    const { data: users } = await supabase
      .from('profiles')
      .select('id, created_at, is_active, is_banned')

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles:role_id(name)')

    // Total venues
    const { data: venues } = await supabase
      .from('venues')
      .select('id, is_active, is_verified, created_at')

    // Total courts
    const { data: courts } = await supabase
      .from('courts')
      .select('id, is_active, is_verified, created_at')

    // Total reservations
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, status, total_amount, created_at')

    // Calculate stats
    const totalUsers = users?.length || 0
    const activeUsers = users?.filter(u => u.is_active && !u.is_banned).length || 0
    const bannedUsers = users?.filter(u => u.is_banned).length || 0

    const roleDistribution = {
      players: userRoles?.filter((ur: any) => ur.roles?.name === 'player').length || 0,
      court_admins: userRoles?.filter((ur: any) => ur.roles?.name === 'court_admin').length || 0,
      queue_masters: userRoles?.filter((ur: any) => ur.roles?.name === 'queue_master').length || 0,
      global_admins: userRoles?.filter((ur: any) => ur.roles?.name === 'global_admin').length || 0,
    }

    const totalVenues = venues?.length || 0
    const activeVenues = venues?.filter(v => v.is_active).length || 0
    const verifiedVenues = venues?.filter(v => v.is_verified).length || 0

    const totalCourts = courts?.length || 0
    const activeCourts = courts?.filter(c => c.is_active).length || 0
    const verifiedCourts = courts?.filter(c => c.is_verified).length || 0
    const pendingCourts = courts?.filter(c => !c.is_verified).length || 0

    const totalReservations = reservations?.length || 0
    const pendingReservations = reservations?.filter(r => r.status === 'pending').length || 0
    const completedReservations = reservations?.filter(r => r.status === 'completed').length || 0
    const cancelledReservations = reservations?.filter(r => r.status === 'cancelled').length || 0

    const totalRevenue = reservations
      ?.filter(r => r.status === 'completed')
      ?.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0) || 0

    // User growth (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const newUsers = users?.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length || 0

    // Venue growth (last 30 days)
    const newVenues = venues?.filter(v => new Date(v.created_at) >= thirtyDaysAgo).length || 0

    // Court growth (last 30 days)
    const newCourts = courts?.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length || 0

    // Recent bookings (last 30 days)
    const recentReservations = reservations?.filter(r => new Date(r.created_at) >= thirtyDaysAgo).length || 0

    return {
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          newThisMonth: newUsers,
          roleDistribution
        },
        venues: {
          total: totalVenues,
          active: activeVenues,
          verified: verifiedVenues,
          newThisMonth: newVenues
        },
        courts: {
          total: totalCourts,
          active: activeCourts,
          verified: verifiedCourts,
          pending: pendingCourts,
          newThisMonth: newCourts
        },
        reservations: {
          total: totalReservations,
          pending: pendingReservations,
          completed: completedReservations,
          cancelled: cancelledReservations,
          recentBookings: recentReservations,
          totalRevenue
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getCourtAdminRevenueBreakdown() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, roles:role_id(name)')

    if (rolesError) throw rolesError

    const courtAdminIds = Array.from(
      new Set(
        (userRoles || [])
          .filter((role: any) => role.roles?.name === 'court_admin')
          .map((role: any) => role.user_id)
      )
    )

    if (courtAdminIds.length === 0) {
      return {
        success: true,
        admins: [],
        totals: {
          admins: 0,
          venues: 0,
          courts: 0,
          completedBookings: 0,
          totalRevenue: 0,
        },
      }
    }

    const [{ data: profiles, error: profilesError }, { data: venues, error: venuesError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', courtAdminIds),
      supabase
        .from('venues')
        .select('id, name, owner_id')
        .in('owner_id', courtAdminIds),
    ])

    if (profilesError) throw profilesError
    if (venuesError) throw venuesError

    const venueIds = (venues || []).map((venue) => venue.id)

    const { data: courts, error: courtsError } = venueIds.length > 0
      ? await supabase
          .from('courts')
          .select('id, name, venue_id')
          .in('venue_id', venueIds)
      : { data: [], error: null }

    if (courtsError) throw courtsError

    const courtIds = (courts || []).map((court) => court.id)

    const { data: reservations, error: reservationsError } = courtIds.length > 0
      ? await supabase
          .from('reservations')
          .select('id, court_id, total_amount')
          .eq('status', 'completed')
          .in('court_id', courtIds)
      : { data: [], error: null }

    if (reservationsError) throw reservationsError

    const venuesByOwner = new Map<string, Array<{ id: string; name: string }>>()
    const venueOwnerById = new Map<string, string>()
    const courtsByVenue = new Map<string, Array<{ id: string; name: string }>>()
    const courtToVenueId = new Map<string, string>()

    for (const venue of venues || []) {
      venueOwnerById.set(venue.id, venue.owner_id)
      const ownerVenues = venuesByOwner.get(venue.owner_id) || []
      ownerVenues.push({ id: venue.id, name: venue.name })
      venuesByOwner.set(venue.owner_id, ownerVenues)
    }

    for (const court of courts || []) {
      courtToVenueId.set(court.id, court.venue_id)
      const venueCourts = courtsByVenue.get(court.venue_id) || []
      venueCourts.push({ id: court.id, name: court.name })
      courtsByVenue.set(court.venue_id, venueCourts)
    }

    const revenueByOwner = new Map<string, { totalRevenue: number; completedBookings: number; venueTotals: Map<string, { totalRevenue: number; completedBookings: number }> }>()

    for (const reservation of reservations || []) {
      const venueId = courtToVenueId.get(reservation.court_id)
      if (!venueId) continue

      const ownerId = venueOwnerById.get(venueId)
      if (!ownerId) continue

      const ownerStats = revenueByOwner.get(ownerId) || {
        totalRevenue: 0,
        completedBookings: 0,
        venueTotals: new Map<string, { totalRevenue: number; completedBookings: number }>(),
      }

      const amount = Number(reservation.total_amount) || 0
      ownerStats.totalRevenue += amount
      ownerStats.completedBookings += 1

      const venueStats = ownerStats.venueTotals.get(venueId) || { totalRevenue: 0, completedBookings: 0 }
      venueStats.totalRevenue += amount
      venueStats.completedBookings += 1
      ownerStats.venueTotals.set(venueId, venueStats)

      revenueByOwner.set(ownerId, ownerStats)
    }

    const admins = (profiles || [])
      .map((profile) => {
        const ownedVenues = venuesByOwner.get(profile.id) || []
        const ownerStats = revenueByOwner.get(profile.id)
        const venueDetails = ownedVenues.map((venue) => {
          const venueStats = ownerStats?.venueTotals.get(venue.id)
          const venueCourts = courtsByVenue.get(venue.id) || []

          return {
            id: venue.id,
            name: venue.name,
            totalRevenue: venueStats?.totalRevenue || 0,
            completedBookings: venueStats?.completedBookings || 0,
            courtCount: venueCourts.length,
            courts: venueCourts,
          }
        }).sort((left, right) => right.totalRevenue - left.totalRevenue)

        return {
          id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          totalRevenue: ownerStats?.totalRevenue || 0,
          completedBookings: ownerStats?.completedBookings || 0,
          venueCount: ownedVenues.length,
          courtCount: ownedVenues.reduce((sum, venue) => sum + (courtsByVenue.get(venue.id) || []).length, 0),
          venues: venueDetails,
        }
      })
      .sort((left, right) => right.totalRevenue - left.totalRevenue)

    return {
      success: true,
      admins,
      totals: {
        admins: admins.length,
        venues: (venues || []).length,
        courts: (courts || []).length,
        completedBookings: (reservations || []).length,
        totalRevenue: admins.reduce((sum, admin) => sum + admin.totalRevenue, 0),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getRecentActivity() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: auditLogs, error } = await supabase
      .from('admin_audit_logs')
      .select(`
        id,
        action_type,
        target_type,
        target_id,
        created_at,
        admin_id,
        admin:profiles!admin_id(email, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return { success: true, activities: auditLogs || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getUserGrowthChart(days: number = 30) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: users } = await supabase
      .from('profiles')
      .select('created_at')
      .order('created_at', { ascending: true })

    if (!users) return { success: true, data: [] }

    // Group by date
    const dateMap = new Map<string, number>()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    users.forEach(user => {
      const date = new Date(user.created_at)
      if (date >= startDate) {
        const dateKey = date.toISOString().split('T')[0]
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
      }
    })

    // Fill missing dates with 0
    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      data.push({
        date: dateKey,
        count: dateMap.get(dateKey) || 0
      })
    }

    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
