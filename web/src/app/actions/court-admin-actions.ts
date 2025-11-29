'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all venues owned by the current user (Court Admin)
 */
export async function getMyVenues() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: venues, error } = await supabase
      .from('venues')
      .select(`
        *,
        courts:courts(count)
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, venues }
  } catch (error: any) {
    console.error('Error fetching venues:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get dashboard statistics for Court Admin
 */
export async function getDashboardStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get all venue IDs owned by user
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return {
        success: true,
        stats: {
          todayReservations: 0,
          todayRevenue: 0,
          pendingReservations: 0,
          upcomingReservations: 0,
          totalRevenue: 0,
          averageRating: 0,
        }
      }
    }

    // Get courts for these venues
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .in('venue_id', venueIds)

    const courtIds = courts?.map(c => c.id) || []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    // Get today's reservations
    const { data: todayReservations } = await supabase
      .from('reservations')
      .select('id, total_amount')
      .in('court_id', courtIds)
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())

    // Get pending reservations
    const { data: pendingReservations } = await supabase
      .from('reservations')
      .select('id')
      .in('court_id', courtIds)
      .eq('status', 'pending')

    // Get upcoming reservations (next 7 days)
    const { data: upcomingReservations } = await supabase
      .from('reservations')
      .select('id')
      .in('court_id', courtIds)
      .gte('start_time', tomorrow.toISOString())
      .lt('start_time', nextWeek.toISOString())
      .in('status', ['pending', 'confirmed'])

    // Get this month's revenue
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const { data: monthRevenue } = await supabase
      .from('reservations')
      .select('amount_paid')
      .in('court_id', courtIds)
      .gte('created_at', monthStart.toISOString())
      .in('status', ['confirmed', 'completed'])

    // Get average rating
    const { data: ratings } = await supabase
      .from('court_ratings')
      .select('rating')
      .in('court_id', courtIds)

    const todayRevenue = todayReservations?.reduce((sum, r) => sum + parseFloat(r.total_amount || '0'), 0) || 0
    const totalRevenue = monthRevenue?.reduce((sum, r) => sum + parseFloat(r.amount_paid || '0'), 0) || 0
    const averageRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0

    return {
      success: true,
      stats: {
        todayReservations: todayReservations?.length || 0,
        todayRevenue,
        pendingReservations: pendingReservations?.length || 0,
        upcomingReservations: upcomingReservations?.length || 0,
        totalRevenue,
        averageRating: Math.round(averageRating * 10) / 10,
      }
    }
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get recent reservations for Court Admin
 */
export async function getRecentReservations(limit = 10) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get all venue IDs owned by user
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return { success: true, reservations: [] }
    }

    // Get reservations with court and user details
    const { data: reservations, error } = await supabase
      .from('reservations')
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
        user:profiles(
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .in('court.venue_id', venueIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const formattedReservations = reservations?.map(r => ({
      id: r.id,
      courtName: r.court?.name || 'Unknown Court',
      venueName: r.court?.venue?.name || 'Unknown Venue',
      customerName: r.user?.display_name || `${r.user?.first_name || ''} ${r.user?.last_name || ''}`.trim() || 'Unknown',
      customerAvatar: r.user?.avatar_url,
      startTime: new Date(r.start_time),
      endTime: new Date(r.end_time),
      status: r.status,
      totalAmount: parseFloat(r.total_amount || '0'),
      amountPaid: parseFloat(r.amount_paid || '0'),
      createdAt: new Date(r.created_at),
    }))

    return { success: true, reservations: formattedReservations }
  } catch (error: any) {
    console.error('Error fetching recent reservations:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all reservations with filters
 */
export async function getMyVenueReservations(filters?: {
  startDate?: string
  endDate?: string
  status?: string
  courtId?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get all venue IDs owned by user
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return { success: true, reservations: [] }
    }

    let query = supabase
      .from('reservations')
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
        user:profiles(
          id,
          display_name,
          first_name,
          last_name,
          avatar_url,
          phone
        )
      `)
      .in('court.venue_id', venueIds)

    // Apply filters
    if (filters?.startDate) {
      query = query.gte('start_time', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('start_time', filters.endDate)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.courtId) {
      query = query.eq('court_id', filters.courtId)
    }

    const { data: reservations, error } = await query.order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, reservations }
  } catch (error: any) {
    console.error('Error fetching reservations:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Approve a reservation
 */
export async function approveReservation(reservationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify the reservation belongs to user's venue
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        id,
        court:courts!inner(
          venue:venues!inner(owner_id)
        )
      `)
      .eq('id', reservationId)
      .single()

    if (!reservation || reservation.court?.venue?.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update reservation status
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('id', reservationId)

    if (error) throw error

    // TODO: Send notification to customer

    revalidatePath('/court-admin/reservations')
    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error approving reservation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject a reservation
 */
export async function rejectReservation(reservationId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify the reservation belongs to user's venue
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        id,
        court:courts!inner(
          venue:venues!inner(owner_id)
        )
      `)
      .eq('id', reservationId)
      .single()

    if (!reservation || reservation.court?.venue?.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update reservation status
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', reservationId)

    if (error) throw error

    // TODO: Send notification to customer
    // TODO: Process refund if payment was made

    revalidatePath('/court-admin/reservations')
    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error rejecting reservation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update venue details
 */
export async function updateVenue(venueId: string, updates: {
  name?: string
  description?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  opening_hours?: any
}) {
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
      return { success: false, error: 'Unauthorized' }
    }

    // Update venue
    const { error } = await supabase
      .from('venues')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', venueId)

    if (error) throw error

    revalidatePath('/court-admin/venues')
    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating venue:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get courts for a venue
 */
export async function getVenueCourts(venueId: string) {
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
      return { success: false, error: 'Unauthorized' }
    }

    // Get courts with amenities
    const { data: courts, error } = await supabase
      .from('courts')
      .select(`
        *,
        court_amenities(
          amenity:amenities(id, name, icon)
        )
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return { success: true, courts }
  } catch (error: any) {
    console.error('Error fetching courts:', error)
    return { success: false, error: error.message }
  }
}
