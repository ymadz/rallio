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
  down_payment_percentage?: number
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
    const downPaymentPercentage =
      typeof courtData.down_payment_percentage === 'number'
        ? Math.min(Math.max(courtData.down_payment_percentage, 0), 100)
        : undefined

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
        metadata: downPaymentPercentage !== undefined
          ? { down_payment_percentage: downPaymentPercentage }
          : undefined,
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
  down_payment_percentage?: number
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
        metadata,
        venue:venues!inner(owner_id)
      `)
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // Update court
    const updatesPayload: any = {
      ...updates,
      updated_at: new Date().toISOString()
    }

    if (updates.down_payment_percentage !== undefined) {
      const sanitizedDownPaymentPercentage = Math.min(Math.max(updates.down_payment_percentage, 0), 100)
      const existingMetadata = ((court as any).metadata || {}) as Record<string, any>
      updatesPayload.metadata = {
        ...existingMetadata,
        down_payment_percentage: sanitizedDownPaymentPercentage,
      }
      delete updatesPayload.down_payment_percentage
    }

    const { error: updateError } = await supabase
      .from('courts')
      .update(updatesPayload)
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

/**
 * Add an image to a court
 */
export async function addCourtImage(
  courtId: string,
  url: string,
  altText?: string,
  isPrimary?: boolean,
  displayOrder?: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify court ownership through venue
    const { data: court } = await supabase
      .from('courts')
      .select('id, venue:venues!inner(owner_id)')
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // If this is primary, unset existing primary images
    if (isPrimary) {
      await supabase
        .from('court_images')
        .update({ is_primary: false })
        .eq('court_id', courtId)
    }

    const { data: image, error } = await supabase
      .from('court_images')
      .insert({
        court_id: courtId,
        url,
        alt_text: altText || '',
        is_primary: isPrimary ?? false,
        display_order: displayOrder ?? 0,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/courts')
    return { success: true, image }
  } catch (error: any) {
    console.error('Error adding court image:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Add multiple images to a court in one request
 */
export async function addCourtImages(
  courtId: string,
  images: Array<{
    url: string
    altText?: string
    isPrimary?: boolean
    displayOrder?: number
  }>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!images || images.length === 0) {
    return { success: false, error: 'No images provided' }
  }

  try {
    // Verify court ownership through venue
    const { data: court } = await supabase
      .from('courts')
      .select('id, venue:venues!inner(owner_id)')
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    // If any incoming image is set to primary, unset existing primary flags first.
    if (images.some((image) => image.isPrimary)) {
      await supabase
        .from('court_images')
        .update({ is_primary: false })
        .eq('court_id', courtId)
    }

    const payload = images.map((image, index) => ({
      court_id: courtId,
      url: image.url,
      alt_text: image.altText || '',
      is_primary: image.isPrimary ?? false,
      display_order: image.displayOrder ?? index,
    }))

    const { data, error } = await supabase
      .from('court_images')
      .insert(payload)
      .select('id, url, alt_text, is_primary, display_order')

    if (error) throw error

    revalidatePath('/courts')
    return { success: true, images: data }
  } catch (error: any) {
    console.error('Error adding court images:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a court image
 */
export async function deleteCourtImage(imageId: string, courtId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify court ownership through venue
    const { data: court } = await supabase
      .from('courts')
      .select('id, venue:venues!inner(owner_id)')
      .eq('id', courtId)
      .single()

    if (!court || (court.venue as any).owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this court' }
    }

    const { error } = await supabase
      .from('court_images')
      .delete()
      .eq('id', imageId)
      .eq('court_id', courtId)

    if (error) throw error

    revalidatePath('/courts')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting court image:', error)
    return { success: false, error: error.message }
  }
}

