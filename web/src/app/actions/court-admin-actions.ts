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

    // Fetch queue sessions for queue session reservations
    if (reservations && reservations.length > 0) {
      const queueReservations = reservations.filter(
        (r: any) => r.metadata?.is_queue_session_reservation === true
      )

      if (queueReservations.length > 0) {
        // Get queue sessions that match these reservations by court and time
        const { data: queueSessions } = await supabase
          .from('queue_sessions')
          .select('id, court_id, organizer_id, start_time, end_time, approval_status, status')
          .in(
            'court_id',
            queueReservations.map((r: any) => r.court_id)
          )

        // Match queue sessions to reservations
        if (queueSessions) {
          reservations.forEach((reservation: any) => {
            if (reservation.metadata?.is_queue_session_reservation) {
              const matchingSession = queueSessions.find(
                (qs: any) =>
                  qs.court_id === reservation.court_id &&
                  qs.organizer_id === reservation.user_id &&
                  qs.start_time === reservation.start_time &&
                  qs.end_time === reservation.end_time
              )
              if (matchingSession) {
                reservation.queue_session = [matchingSession]
              }
            }
          })
        }
      }
    }

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

    if (!reservation || (reservation.court as any)?.venue?.owner_id !== user.id) {
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

    if (!reservation || (reservation.court as any)?.venue?.owner_id !== user.id) {
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
  city?: string
  phone?: string
  email?: string
  website?: string
  latitude?: number
  longitude?: number
  opening_hours?: any
  image_url?: string
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
 * Get a single venue by ID (with full details)
 */
export async function getVenueById(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get venue with courts count
    const { data: venue, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .eq('owner_id', user.id)
      .single()

    if (error) throw error

    if (!venue) {
      return { success: false, error: 'Venue not found or access denied' }
    }

    // Get actual courts count separately
    const { count: courtsCount } = await supabase
      .from('courts')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venueId)

    // Add courts count to venue object
    venue.courtsCount = courtsCount || 0

    return { success: true, venue }
  } catch (error: any) {
    console.error('Error fetching venue:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create a new venue
 */
export async function createVenue(venueData: {
  name: string
  description?: string
  address?: string
  city?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  website?: string
  opening_hours?: Record<string, { open: string; close: string }>
  image_url?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Check if user has court_admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)

    const hasCourtAdminRole = roles?.some(
      (r: any) => r.role?.name === 'court_admin' || r.role?.name === 'global_admin'
    )

    if (!hasCourtAdminRole) {
      return {
        success: false,
        error: 'You must have Court Admin role to create venues. Please contact support.'
      }
    }

    // Create venue
    const { data: venue, error } = await supabase
      .from('venues')
      .insert({
        owner_id: user.id,
        name: venueData.name,
        description: venueData.description,
        address: venueData.address,
        city: venueData.city || 'Zamboanga City',
        latitude: venueData.latitude,
        longitude: venueData.longitude,
        phone: venueData.phone,
        email: venueData.email,
        website: venueData.website,
        image_url: venueData.image_url,

        opening_hours: venueData.opening_hours || {
          monday: { open: '06:00', close: '22:00' },
          tuesday: { open: '06:00', close: '22:00' },
          wednesday: { open: '06:00', close: '22:00' },
          thursday: { open: '06:00', close: '22:00' },
          friday: { open: '06:00', close: '22:00' },
          saturday: { open: '06:00', close: '22:00' },
          sunday: { open: '06:00', close: '22:00' }
        },
        is_active: true,
        is_verified: false, // Requires admin verification
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/court-admin/venues')
    revalidatePath('/court-admin')

    return { success: true, venue }
  } catch (error: any) {
    console.error('Error creating venue:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Soft delete a venue (set is_active = false)
 */
export async function deleteVenue(venueId: string) {
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

    // Check for active courts
    const { data: activeCourts } = await supabase
      .from('courts')
      .select('id')
      .eq('venue_id', venueId)
      .eq('is_active', true)

    if (activeCourts && activeCourts.length > 0) {
      return {
        success: false,
        error: `Cannot delete venue with ${activeCourts.length} active court(s). Please deactivate them first.`
      }
    }

    // Check for active reservations
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('id, court:courts!inner(venue_id)')
      .eq('court.venue_id', venueId)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', new Date().toISOString())

    if (activeReservations && activeReservations.length > 0) {
      return {
        success: false,
        error: `Cannot delete venue with ${activeReservations.length} active reservation(s). Please cancel them first.`
      }
    }

    // Soft delete (set is_active = false)
    const { error } = await supabase
      .from('venues')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', venueId)

    if (error) throw error

    revalidatePath('/court-admin/venues')
    revalidatePath('/court-admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting venue:', error)
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

/**
 * Get pending (unverified) courts for the current court admin
 */
export async function getPendingCourts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get venue IDs owned by user
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return { success: true, courts: [] }
    }

    // Get unverified courts
    const { data: courts, error } = await supabase
      .from('courts')
      .select(`
        *,
        venue:venue_id (
          id,
          name,
          city,
          address
        ),
        court_amenities(
          amenity:amenities(id, name, icon)
        )
      `)
      .in('venue_id', venueIds)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, courts: courts || [] }
  } catch (error: any) {
    console.error('Error fetching pending courts:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get refunds for court admin's venues
 */
export async function getMyVenueRefunds(options?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<{ success: boolean; refunds?: any[]; total?: number; error?: string }> {
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
      return { success: true, refunds: [], total: 0 }
    }

    // Get court IDs for these venues
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .in('venue_id', venueIds)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return { success: true, refunds: [], total: 0 }
    }

    // Get reservations for these courts
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id')
      .in('court_id', courtIds)

    const reservationIds = reservations?.map(r => r.id) || []

    if (reservationIds.length === 0) {
      return { success: true, refunds: [], total: 0 }
    }

    // Now get refunds for these reservations
    let query = supabase
      .from('refunds')
      .select(`
        *,
        reservations (
          id,
          start_time,
          end_time,
          total_amount,
          user_id,
          courts (
            name,
            venues (name)
          )
        )
      `, { count: 'exact' })
      .in('reservation_id', reservationIds)
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data: refunds, error, count } = await query

    if (error) {
      console.error('Error fetching refunds:', error)
      return { success: false, error: error.message }
    }

    // Fetch profiles separately for the user_ids
    const userIds = [...new Set(refunds?.map(r => r.user_id).filter(Boolean) || [])]

    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', userIds)

      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {} as Record<string, any>)
      }
    }

    // Attach profiles to refunds
    const refundsWithProfiles = refunds?.map(refund => ({
      ...refund,
      profiles: profilesMap[refund.user_id] || null
    })) || []

    return { success: true, refunds: refundsWithProfiles, total: count || 0 }
  } catch (error: any) {
    console.error('Error fetching venue refunds:', error)
    return { success: false, error: error.message }
  }
}
