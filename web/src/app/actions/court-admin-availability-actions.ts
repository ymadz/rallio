'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get venue availability settings (operating hours)
 */
export async function getVenueAvailability(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue, error } = await supabase
      .from('venues')
      .select('id, owner_id, opening_hours')
      .eq('id', venueId)
      .single()

    if (error) throw error

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    return { success: true, openingHours: venue.opening_hours }
  } catch (error: any) {
    console.error('Error fetching venue availability:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update venue operating hours
 */
export async function updateOperatingHours(
  venueId: string,
  schedule: Record<string, { open: string; close: string } | null>
) {
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

    // Validate schedule format
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const [day, hours] of Object.entries(schedule)) {
      if (!validDays.includes(day.toLowerCase())) {
        return { success: false, error: `Invalid day: ${day}` }
      }
      if (hours && (!hours.open || !hours.close)) {
        return { success: false, error: `Invalid hours for ${day}` }
      }
    }

    // Update opening hours
    const { error } = await supabase
      .from('venues')
      .update({
        opening_hours: schedule,
        updated_at: new Date().toISOString()
      })
      .eq('id', venueId)

    if (error) throw error

    revalidatePath(`/court-admin/venues/${venueId}`)
    revalidatePath('/court-admin/availability')
    revalidatePath('/court-admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error updating operating hours:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get court availability times (for queue masters/players)
 * Returns venue opening hours for a specific court
 */
export async function getCourtAvailabilityTimes(courtId: string) {
  const supabase = await createClient()

  try {
    // Get court with venue opening hours
    const { data: court, error } = await supabase
      .from('courts')
      .select(`
        id,
        name,
        venue:venues!inner (
          id,
          name,
          opening_hours
        )
      `)
      .eq('id', courtId)
      .eq('is_active', true)
      .single()

    if (error) throw error

    if (!court) {
      return { success: false, error: 'Court not found' }
    }

    const venue = court.venue as any
    const openingHours = venue.opening_hours || {}

    return { 
      success: true, 
      courtId: court.id,
      courtName: court.name,
      venueName: venue.name,
      openingHours 
    }
  } catch (error: any) {
    console.error('Error fetching court availability:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Note: The initial schema doesn't have a blocked_dates table.
 * If needed, create migration 014_blocked_dates_table.sql
 * For now, these are placeholder functions that can be implemented
 * after the migration is created.
 */

/**
 * Add a blocked date for maintenance/holiday
 * TODO: Requires migration 014_blocked_dates_table.sql
 */
export async function addBlockedDate(venueId: string, blockData: {
  courtId?: string // If null, blocks entire venue
  startDate: string
  endDate: string
  reason: string
  blockType: 'maintenance' | 'holiday' | 'private_event' | 'other'
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
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // If courtId is provided, verify it belongs to this venue
    if (blockData.courtId) {
      const { data: court } = await supabase
        .from('courts')
        .select('venue_id')
        .eq('id', blockData.courtId)
        .single()

      if (!court || court.venue_id !== venueId) {
        return { success: false, error: 'Court does not belong to this venue' }
      }
    }

    // TODO: Insert into blocked_dates table once migration is created
    // For now, we'll store in venue metadata as a workaround
    const { data: currentVenue } = await supabase
      .from('venues')
      .select('metadata')
      .eq('id', venueId)
      .single()

    const metadata = currentVenue?.metadata || {}
    const blockedDates = metadata.blocked_dates || []

    blockedDates.push({
      id: crypto.randomUUID(),
      courtId: blockData.courtId,
      startDate: blockData.startDate,
      endDate: blockData.endDate,
      reason: blockData.reason,
      blockType: blockData.blockType,
      createdAt: new Date().toISOString()
    })

    const { error } = await supabase
      .from('venues')
      .update({
        metadata: { ...metadata, blocked_dates: blockedDates },
        updated_at: new Date().toISOString()
      })
      .eq('id', venueId)

    if (error) throw error

    revalidatePath(`/court-admin/venues/${venueId}`)
    revalidatePath('/court-admin/availability')
    revalidatePath('/court-admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error adding blocked date:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Remove a blocked date
 */
export async function removeBlockedDate(venueId: string, blockId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id, metadata')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    const metadata = venue.metadata || {}
    const blockedDates = metadata.blocked_dates || []

    // Remove the blocked date
    const updatedBlockedDates = blockedDates.filter((block: any) => block.id !== blockId)

    const { error } = await supabase
      .from('venues')
      .update({
        metadata: { ...metadata, blocked_dates: updatedBlockedDates },
        updated_at: new Date().toISOString()
      })
      .eq('id', venueId)

    if (error) throw error

    revalidatePath(`/court-admin/venues/${venueId}`)
    revalidatePath('/court-admin/availability')
    revalidatePath('/court-admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error removing blocked date:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all blocked dates for a venue
 */
export async function getBlockedDates(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue, error } = await supabase
      .from('venues')
      .select('owner_id, metadata')
      .eq('id', venueId)
      .single()

    if (error) throw error

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    const metadata = venue.metadata || {}
    const blockedDates = metadata.blocked_dates || []

    return { success: true, blockedDates }
  } catch (error: any) {
    console.error('Error fetching blocked dates:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if a specific date/time is blocked
 */
export async function isTimeSlotBlocked(
  courtId: string,
  startTime: string,
  endTime: string
): Promise<{ success: boolean; isBlocked?: boolean; reason?: string; error?: string }> {
  const supabase = await createClient()

  try {
    // Get the court's venue
    const { data: court } = await supabase
      .from('courts')
      .select('venue_id, venue:venues(metadata)')
      .eq('id', courtId)
      .single()

    if (!court) {
      return { success: false, error: 'Court not found' }
    }

    const metadata = (court as any).venue?.metadata || {}
    const blockedDates = metadata.blocked_dates || []

    const requestStart = new Date(startTime)
    const requestEnd = new Date(endTime)

    // Check each blocked date
    for (const block of blockedDates) {
      const blockStart = new Date(block.startDate)
      const blockEnd = new Date(block.endDate)

      // Check if this block applies to this court or entire venue
      if (block.courtId && block.courtId !== courtId) {
        continue // Block is for a different court
      }

      // Check for overlap
      if (requestStart < blockEnd && requestEnd > blockStart) {
        return {
          success: true,
          isBlocked: true,
          reason: block.reason || 'Court is unavailable during this time'
        }
      }
    }

    return { success: true, isBlocked: false }
  } catch (error: any) {
    console.error('Error checking blocked time slot:', error)
    return { success: false, error: error.message }
  }
}
