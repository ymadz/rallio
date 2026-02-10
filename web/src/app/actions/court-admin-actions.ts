'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification, NotificationTemplates } from '@/lib/notifications'
import { getServerNow } from '@/lib/time-server'

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
    // Verify the reservation belongs to user's venue and get details
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        id,
        status,
        start_time,
        end_time,
        total_amount,
        metadata,
        user_id,
        court:courts!inner(
          id,
          name,
          hourly_rate,
          venue:venues!inner(
            id,
            name,
            owner_id
          )
        )
      `)
      .eq('id', reservationId)
      .single()

    if (!reservation || (reservation.court as any)?.venue?.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if it's a queue session reservation
    const isQueueSession = reservation.metadata?.is_queue_session_reservation === true
    let queueSessionId: string | null = null

    if (isQueueSession) {
      // Find the associated queue session
      const { data: queueSession } = await supabase
        .from('queue_sessions')
        .select('id, start_time, end_time, organizer_id')
        .eq('court_id', (reservation.court as any).id)
        .eq('organizer_id', reservation.user_id)
        .eq('start_time', reservation.start_time)
        .eq('end_time', reservation.end_time)
        .single()

      if (queueSession) {
        queueSessionId = queueSession.id

        // Calculate payment amount for queue session
        const durationMs = new Date(queueSession.end_time).getTime() - new Date(queueSession.start_time).getTime()
        const durationHours = durationMs / (1000 * 60 * 60)
        const hourlyRate = (reservation.court as any).hourly_rate || 0
        const courtRental = hourlyRate * durationHours
        const platformFee = courtRental * 0.05
        const totalAmount = courtRental + platformFee

        // Approve Queue Session -> Pending Payment
        const { error: qsError } = await supabase
          .from('queue_sessions')
          .update({
            approval_status: 'approved',
            status: 'pending_payment', // Wait for payment
            metadata: {
              reservation_id: reservation.id,
              payment_required: totalAmount,
              court_rental: courtRental,
              platform_fee: platformFee,
              payment_status: 'pending'
            }
          })
          .eq('id', queueSession.id)

        if (qsError) throw qsError

        // Update reservation to pending_payment
        const { error: resError } = await supabase
          .from('reservations')
          .update({
            status: 'pending_payment',
            total_amount: totalAmount,
            metadata: {
              ...reservation.metadata,
              platform_fee: platformFee,
              hourly_rate: hourlyRate,
              duration_hours: durationHours,
              total_with_fee: totalAmount
            }
          })
          .eq('id', reservationId)

        if (resError) throw resError

        // Notify Queue Master
        await createNotification({
          userId: queueSession.organizer_id,
          type: 'queue_approval_approved',
          title: '✅ Queue Session Approved - Payment Required',
          message: `Your queue session on ${(reservation.court as any).name} has been approved! Total due: ₱${totalAmount.toFixed(2)}. Please complete payment to activate the session.`,
          actionUrl: `/queue-master/sessions/${queueSession.id}`,
          metadata: {
            court_name: (reservation.court as any).name,
            venue_name: (reservation.court as any).venue.name,
            queue_session_id: queueSession.id,
            total_amount: totalAmount,
            payment_required: true
          }
        })
      }
    } else {
      // Normal Reservation -> Confirmed
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId)

      if (error) throw error

      // Notify User
      await createNotification({
        userId: reservation.user_id,
        ...NotificationTemplates.bookingConfirmed(
          (reservation.court as any).venue.name,
          (reservation.court as any).name,
          new Date(reservation.start_time).toLocaleDateString(),
          reservation.id
        )
      })
    }

    revalidatePath('/court-admin/reservations')
    revalidatePath('/court-admin')
    return { success: true }
  } catch (error: any) {
    console.error('Error approving reservation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark a reservation as paid (Cash payment confirmation)
 */
export async function markReservationAsPaid(reservationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership and get details
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        id,
        status,
        total_amount,
        metadata,
        user_id,
        start_time,
        end_time,
        court:courts!inner(
          id,
          name,
          venue:venues!inner(
            id,
            name,
            owner_id
          )
        )
      `)
      .eq('id', reservationId)
      .single()

    if (!reservation || (reservation.court as any)?.venue?.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    if (reservation.status !== 'pending_payment') {
      return { success: false, error: 'Reservation is not pending payment' }
    }

    const isQueueSession = reservation.metadata?.is_queue_session_reservation === true

    if (isQueueSession) {
      // Find associated queue session via metadata link (reliable)
      const { data: queueSession } = await supabase
        .from('queue_sessions')
        .select('id, status, metadata')
        .filter('metadata->>reservation_id', 'eq', reservationId)
        .single()

      if (queueSession) {
        // Activate queue session only if start_time has passed;
        // otherwise set 'open' (paid & ready, but scheduled for later)
        const now = await getServerNow()
        const sessionStart = new Date(reservation.start_time)
        const newQueueStatus = sessionStart <= now ? 'active' : 'open'

        const { error: qsError } = await supabase
          .from('queue_sessions')
          .update({
            status: newQueueStatus,
            approval_status: 'approved',
            metadata: {
              ...queueSession.metadata,
              payment_status: 'paid',
              paid_at: now.toISOString(),
              payment_method: 'cash_confirmed_by_admin'
            }
          })
          .eq('id', queueSession.id)

        if (qsError) throw qsError

        // Create Payment Record for history
        await supabase.from('payments').insert({
          user_id: reservation.user_id,
          reservation_id: reservation.id,
          amount: reservation.total_amount,
          currency: 'PHP',
          payment_method: 'cash',
          status: 'completed',
          provider: 'manual',
          metadata: {
            marked_by: user.id,
            queue_session_id: queueSession.id
          }
        })
      }
    } else {
      // Create Payment Record (for regular booking cash payment)
      await supabase.from('payments').insert({
        user_id: reservation.user_id,
        reservation_id: reservation.id,
        amount: reservation.total_amount,
        currency: 'PHP',
        payment_method: 'cash',
        status: 'completed',
        provider: 'manual',
        metadata: {
          marked_by: user.id
        }
      })
    }

    // Update Reservation to Confirmed
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        amount_paid: reservation.total_amount,
        metadata: {
          ...reservation.metadata,
          payment_status: 'paid',
          payment_method: 'cash'
        }
      })
      .eq('id', reservationId)

    if (error) throw error

    // Notify User
    await createNotification({
      userId: reservation.user_id,
      ...NotificationTemplates.paymentReceived(
        parseFloat(reservation.total_amount),
        isQueueSession ? reservation.metadata?.queue_session_id : reservation.id
      )
    })

    revalidatePath('/court-admin/reservations')
    revalidatePath('/court-admin')
    return { success: true }

  } catch (error: any) {
    console.error('Error marking reservation as paid:', error)
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
        user_id,
        start_time,
        end_time,
        metadata,
        court:courts!inner(
          id,
          name,
          venue:venues!inner(
            id,
            name,
            owner_id
          )
        )
      `)
      .eq('id', reservationId)
      .single()

    if (!reservation || (reservation.court as any)?.venue?.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if it's a queue session reservation
    const isQueueSession = reservation.metadata?.is_queue_session_reservation === true

    if (isQueueSession) {
      // Find and reject queue session via metadata link (reliable)
      const { data: queueSession } = await supabase
        .from('queue_sessions')
        .select('id')
        .filter('metadata->>reservation_id', 'eq', reservationId)
        .single()

      if (queueSession) {
        await supabase
          .from('queue_sessions')
          .update({
            approval_status: 'rejected',
            status: 'cancelled',
            metadata: { rejection_reason: reason }
          })
          .eq('id', queueSession.id)

        // Notify Queue Master
        await createNotification({
          userId: reservation.user_id,
          ...NotificationTemplates.queueApprovalRejected(
            (reservation.court as any).name,
            reason,
            queueSession.id
          )
        })
      }
    } else {
      // Notify User about rejection
      await createNotification({
        userId: reservation.user_id,
        type: 'booking_cancelled',
        title: '❌ Booking Rejected',
        message: `Your booking at ${(reservation.court as any).venue.name} (${(reservation.court as any).name}) was rejected. Reason: ${reason}`,
        actionUrl: `/bookings/${reservation.id}`,
        metadata: {
          booking_id: reservation.id,
          reason,
          venue_name: (reservation.court as any).venue.name
        }
      })
    }

    // Update reservation status to cancelled
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', reservationId)

    if (error) throw error

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

/**
 * Get queue session history for court admin's venues
 */
export async function getVenueQueueHistory(filters?: {
  venueId?: string
  startDate?: string
  endDate?: string
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
      .select('id, name')
      .eq('owner_id', user.id)

    const venueIds = venues?.map(v => v.id) || []

    if (venueIds.length === 0) {
      return { success: true, sessions: [] }
    }

    // If specific venue requested, verify ownership
    if (filters?.venueId && !venueIds.includes(filters.venueId)) {
      return { success: false, error: 'Unauthorized for this venue' }
    }

    const targetVenueIds = filters?.venueId ? [filters.venueId] : venueIds

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
      .in('court.venue_id', targetVenueIds)
      .in('status', ['closed', 'cancelled']) // Only show closed/cancelled sessions for history
      .order('start_time', { ascending: false })

    // Apply date filters
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
      // Calculate revenue if available in summary, otherwise 0
      totalRevenue: s.settings?.summary?.totalRevenue || 0,
      totalGames: s.settings?.summary?.totalGames || 0,
      closedBy: s.settings?.summary?.closedBy || 'unknown',
    }))

    return { success: true, sessions: formattedSessions }
  } catch (error: any) {
    console.error('Error fetching queue history:', error)
    return { success: false, error: error.message }
  }
}
