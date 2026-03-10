'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all courts for a specific venue (with full details)
 */
export async function getVenueCourts(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get courts with stats
    const { data: courts, error } = await supabase
      .from('courts')
      .select(`
        *,
        court_images(id, url, alt_text, is_primary, display_order)
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get reservation counts for each court (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const courtIds = courts?.map(c => c.id) || []

    const { data: reservationCounts } = await supabase
      .from('reservations')
      .select('court_id')
      .in('court_id', courtIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['confirmed', 'completed'])

    // Calculate stats per court
    const courtsWithStats = courts?.map(court => {
      const reservations = reservationCounts?.filter(r => r.court_id === court.id) || []
      return {
        ...court,
        stats: {
          reservations_30d: reservations.length
        }
      }
    })

    return { success: true, courts: courtsWithStats }
  } catch (error: any) {
    console.error('Error fetching venue courts:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a single court by ID (with venue ownership check)
 */
export async function getCourtById(courtId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: court, error } = await supabase
      .from('courts')
      .select(`
        *,
        venue:venues!inner(
          id,
          name,
          owner_id
        ),
        court_images(id, url, alt_text, is_primary, display_order)
      `)
      .eq('id', courtId)
      .single()

    if (error) throw error

    // Verify ownership
    if ((court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    return { success: true, court }
  } catch (error: any) {
    console.error('Error fetching court:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create a new court for a venue
 */
export async function createCourt(venueId: string, courtData: {
  name: string
  description?: string
  surface_type?: string
  court_type: 'indoor' | 'outdoor'
  capacity?: number
  hourly_rate: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Create court
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .insert({
        venue_id: venueId,
        name: courtData.name,
        description: courtData.description,
        surface_type: courtData.surface_type,
        court_type: courtData.court_type,
        capacity: courtData.capacity || 4,
        hourly_rate: courtData.hourly_rate,
        is_active: true,
      })
      .select()
      .single()

    if (courtError) throw courtError

    revalidatePath(`/court-admin/venues/${venueId}`)
    revalidatePath('/court-admin/courts')
    revalidatePath('/court-admin')

    return { success: true, court }
  } catch (error: any) {
    console.error('Error creating court:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update court details
 */
export async function updateCourt(courtId: string, updates: {
  name?: string
  description?: string
  surface_type?: string
  court_type?: 'indoor' | 'outdoor'
  capacity?: number
  hourly_rate?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: court } = await supabase
      .from('courts')
      .select(`
        id,
        venue_id,
        venue:venues!inner(owner_id)
      `)
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // Update court
    const { error: updateError } = await supabase
      .from('courts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', courtId)

    if (updateError) throw updateError

    revalidatePath(`/court-admin/venues/${court.venue_id}`)
    revalidatePath(`/court-admin/courts`)
    revalidatePath('/court-admin')
    revalidatePath('/courts') // Public court listing

    return { success: true }
  } catch (error: any) {
    console.error('Error updating court:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Soft delete a court (set is_active = false)
 */
export async function deleteCourt(courtId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: court } = await supabase
      .from('courts')
      .select(`
        id,
        venue_id,
        venue:venues!inner(owner_id)
      `)
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // Check for active reservations
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('court_id', courtId)
      .in('status', ['pending_payment', 'partially_paid', 'confirmed', 'ongoing'])
      .gte('start_time', new Date().toISOString())

    if (activeReservations && activeReservations.length > 0) {
      return {
        success: false,
        error: `Cannot delete court with ${activeReservations.length} active reservation(s). Please cancel them first.`
      }
    }

    // Soft delete (set is_active = false)
    const { error } = await supabase
      .from('courts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', courtId)

    if (error) throw error

    revalidatePath(`/court-admin/venues/${court.venue_id}`)
    revalidatePath('/court-admin/courts')
    revalidatePath('/court-admin')
    revalidatePath('/courts')

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting court:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update court pricing (hourly rate)
 */
export async function updateCourtPricing(courtId: string, hourlyRate: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (hourlyRate < 0) {
    return { success: false, error: 'Hourly rate must be a positive number' }
  }

  try {
    // Verify ownership
    const { data: court } = await supabase
      .from('courts')
      .select(`
        id,
        venue_id,
        venue:venues!inner(owner_id)
      `)
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // Update pricing
    const { error } = await supabase
      .from('courts')
      .update({
        hourly_rate: hourlyRate,
        updated_at: new Date().toISOString()
      })
      .eq('id', courtId)

    if (error) throw error

    revalidatePath(`/court-admin/venues/${court.venue_id}`)
    revalidatePath('/court-admin/pricing')
    revalidatePath('/court-admin')
    revalidatePath('/courts')

    return { success: true }
  } catch (error: any) {
    console.error('Error updating court pricing:', error)
    return { success: false, error: error.message }
  }
}

