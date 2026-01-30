'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Verify user is a global admin
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

// Audit logging helper
async function logAdminAction(params: {
  actionType: string
  targetType: string
  targetId: string
  oldValue?: any
  newValue?: any
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  await supabase.from('admin_audit_logs').insert({
    action_type: params.actionType,
    target_type: params.targetType,
    target_id: params.targetId,
    old_value: params.oldValue || null,
    new_value: params.newValue || null,
    performed_by: user.id
  })
}

/**
 * Get all venues with pagination, search, and filters
 */
export async function getAllVenues(options: {
  page?: number
  pageSize?: number
  search?: string
  statusFilter?: 'all' | 'active' | 'inactive' | 'verified' | 'unverified'
  cityFilter?: string
} = {}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()
  const page = options.page || 1
  const pageSize = options.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('venues')
    .select(`
      id,
      name,
      description,
      address,
      city,
      phone,
      email,
      website,
      latitude,
      longitude,
      opening_hours,
      is_active,
      is_verified,
      created_at,
      updated_at,
      owner:owner_id (
        id,
        email,
        display_name
      )
    `, { count: 'exact' })

  // Search filter
  if (options.search) {
    query = query.or(`name.ilike.%${options.search}%,address.ilike.%${options.search}%,city.ilike.%${options.search}%`)
  }

  // Status filters
  if (options.statusFilter === 'active') {
    query = query.eq('is_active', true)
  } else if (options.statusFilter === 'inactive') {
    query = query.eq('is_active', false)
  } else if (options.statusFilter === 'verified') {
    query = query.eq('is_verified', true)
  } else if (options.statusFilter === 'unverified') {
    query = query.eq('is_verified', false)
  }

  // City filter
  if (options.cityFilter && options.cityFilter !== 'all') {
    query = query.eq('city', options.cityFilter)
  }

  // Pagination
  query = query.range(from, to).order('created_at', { ascending: false })

  const { data: venues, error, count } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  // Get court counts for each venue
  const venueIds = venues?.map(v => v.id) || []
  const { data: courtCounts } = await supabase
    .from('courts')
    .select('venue_id, id')
    .in('venue_id', venueIds)

  const venuesWithCourts = (venues || []).map((venue: any) => ({
    ...venue,
    court_count: courtCounts?.filter(c => c.venue_id === venue.id).length || 0
  }))

  return {
    success: true,
    venues: venuesWithCourts,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}

/**
 * Get venue details with courts and amenities
 */
export async function getVenueDetails(venueId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get venue details
  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      *,
      owner:owner_id (
        id,
        email,
        display_name,
        phone
      )
    `)
    .eq('id', venueId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Get courts with amenities
  const { data: courts } = await supabase
    .from('courts')
    .select(`
      *,
      court_amenities (
        amenity:amenity_id (
          id,
          name,
          icon,
          description
        )
      ),
      court_images (
        id,
        url,
        alt_text,
        is_primary,
        display_order
      )
    `)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true })

  // Get booking stats
  const courtIds = courts?.map(c => c.id) || []
  const { data: bookingStats } = await supabase
    .from('reservations')
    .select('court_id, status, total_amount')
    .in('court_id', courtIds)

  const stats = {
    totalBookings: bookingStats?.length || 0,
    totalRevenue: bookingStats?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0,
    pendingBookings: bookingStats?.filter(b => b.status === 'pending').length || 0
  }

  return {
    success: true,
    venue: {
      ...venue,
      courts: courts?.map(c => ({
        ...c,
        amenities: c.court_amenities?.map((ca: any) => ca.amenity).filter(Boolean) || [],
        images: c.court_images || []
      })) || [],
      stats
    }
  }
}

/**
 * Create a new venue
 */
export async function createVenue(data: {
  owner_id: string
  name: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  latitude?: number
  longitude?: number
  opening_hours?: any
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: venue, error } = await supabase
    .from('venues')
    .insert({
      owner_id: data.owner_id,
      name: data.name,
      description: data.description || null,
      address: data.address || null,
      city: data.city || 'Zamboanga City',
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      opening_hours: data.opening_hours || null,
      is_active: true,
      is_verified: false
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'create_venue',
    targetType: 'venue',
    targetId: venue.id,
    newValue: { name: data.name, owner_id: data.owner_id }
  })

  revalidatePath('/admin/venues')
  return { success: true, venue, message: 'Venue created successfully' }
}

/**
 * Update venue details
 */
export async function updateVenue(venueId: string, data: {
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
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get old values
  const { data: oldVenue } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .single()

  const { data: venue, error } = await supabase
    .from('venues')
    .update({
      name: data.name,
      description: data.description,
      address: data.address,
      city: data.city,
      phone: data.phone,
      email: data.email,
      website: data.website,
      latitude: data.latitude,
      longitude: data.longitude,
      opening_hours: data.opening_hours,
      updated_at: new Date().toISOString()
    })
    .eq('id', venueId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'update_venue',
    targetType: 'venue',
    targetId: venueId,
    oldValue: oldVenue,
    newValue: venue
  })

  revalidatePath('/admin/venues')
  return { success: true, venue, message: 'Venue updated successfully' }
}

/**
 * Activate/Deactivate venue
 */
export async function toggleVenueActive(venueId: string, isActive: boolean) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('venues')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', venueId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: isActive ? 'activate_venue' : 'deactivate_venue',
    targetType: 'venue',
    targetId: venueId,
    newValue: { is_active: isActive }
  })

  revalidatePath('/admin/venues')
  return { success: true, message: `Venue ${isActive ? 'activated' : 'deactivated'} successfully` }
}

/**
 * Verify/Unverify venue
 */
export async function toggleVenueVerified(venueId: string, isVerified: boolean) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('venues')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('id', venueId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: isVerified ? 'verify_venue' : 'unverify_venue',
    targetType: 'venue',
    targetId: venueId,
    newValue: { is_verified: isVerified }
  })

  revalidatePath('/admin/venues')
  return { success: true, message: `Venue ${isVerified ? 'verified' : 'unverified'} successfully` }
}

/**
 * Delete venue
 */
export async function deleteVenue(venueId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get venue details for audit
  const { data: venue } = await supabase
    .from('venues')
    .select('name, owner_id')
    .eq('id', venueId)
    .single()

  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', venueId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'delete_venue',
    targetType: 'venue',
    targetId: venueId,
    oldValue: venue
  })

  revalidatePath('/admin/venues')
  return { success: true, message: 'Venue deleted successfully' }
}

/**
 * Get all pending (unverified) courts
 */
export async function getPendingCourts(options: {
  page?: number
  pageSize?: number
} = {}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()
  const page = options.page || 1
  const pageSize = options.pageSize || 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: courts, error, count } = await supabase
    .from('courts')
    .select(`
      *,
      venue:venue_id (
        id,
        name,
        city,
        owner:owner_id (
          email,
          display_name
        )
      ),
      court_amenities (
        amenity:amenity_id (
          name,
          icon
        )
      )
    `, { count: 'exact' })
    .eq('is_verified', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    courts,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}

// ============= COURT ACTIONS =============

/**
 * Get all amenities
 */
export async function getAllAmenities() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: amenities, error } = await supabase
    .from('amenities')
    .select('*')
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, amenities }
}

/**
 * Create a new court
 */
export async function createCourt(data: {
  venue_id: string
  name: string
  description?: string
  surface_type?: string
  court_type: 'indoor' | 'outdoor'
  capacity?: number
  hourly_rate: number
  amenity_ids?: string[]
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Create court
  const { data: court, error } = await supabase
    .from('courts')
    .insert({
      venue_id: data.venue_id,
      name: data.name,
      description: data.description || null,
      surface_type: data.surface_type || null,
      court_type: data.court_type,
      capacity: data.capacity || 4,
      hourly_rate: data.hourly_rate,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Add amenities if provided
  if (data.amenity_ids && data.amenity_ids.length > 0) {
    const amenityMappings = data.amenity_ids.map(amenityId => ({
      court_id: court.id,
      amenity_id: amenityId
    }))

    await supabase.from('court_amenities').insert(amenityMappings)
  }

  await logAdminAction({
    actionType: 'create_court',
    targetType: 'court',
    targetId: court.id,
    newValue: { name: data.name, venue_id: data.venue_id }
  })

  revalidatePath('/admin/venues')
  return { success: true, court, message: 'Court created successfully' }
}

/**
 * Update court details
 */
export async function updateCourt(courtId: string, data: {
  name?: string
  description?: string
  surface_type?: string
  court_type?: 'indoor' | 'outdoor'
  capacity?: number
  hourly_rate?: number
  amenity_ids?: string[]
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get old values
  const { data: oldCourt } = await supabase
    .from('courts')
    .select('*')
    .eq('id', courtId)
    .single()

  // Update court
  const updateData: any = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.surface_type !== undefined) updateData.surface_type = data.surface_type
  if (data.court_type !== undefined) updateData.court_type = data.court_type
  if (data.capacity !== undefined) updateData.capacity = data.capacity
  if (data.hourly_rate !== undefined) updateData.hourly_rate = data.hourly_rate

  const { data: court, error } = await supabase
    .from('courts')
    .update(updateData)
    .eq('id', courtId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Update amenities if provided
  if (data.amenity_ids !== undefined) {
    // Delete existing amenities
    await supabase
      .from('court_amenities')
      .delete()
      .eq('court_id', courtId)

    // Add new amenities
    if (data.amenity_ids.length > 0) {
      const amenityMappings = data.amenity_ids.map(amenityId => ({
        court_id: courtId,
        amenity_id: amenityId
      }))

      await supabase.from('court_amenities').insert(amenityMappings)
    }
  }

  await logAdminAction({
    actionType: 'update_court',
    targetType: 'court',
    targetId: courtId,
    oldValue: oldCourt,
    newValue: court
  })

  revalidatePath('/admin/venues')
  return { success: true, court, message: 'Court updated successfully' }
}

/**
 * Toggle court active status
 */
export async function toggleCourtActive(courtId: string, isActive: boolean) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('courts')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', courtId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: isActive ? 'activate_court' : 'deactivate_court',
    targetType: 'court',
    targetId: courtId,
    newValue: { is_active: isActive }
  })

  revalidatePath('/admin/venues')
  return { success: true, message: `Court ${isActive ? 'activated' : 'deactivated'} successfully` }
}

/**
 * Delete court
 */
export async function deleteCourt(courtId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get court details for audit
  const { data: court } = await supabase
    .from('courts')
    .select('name, venue_id')
    .eq('id', courtId)
    .single()

  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', courtId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'delete_court',
    targetType: 'court',
    targetId: courtId,
    oldValue: court
  })

  revalidatePath('/admin/venues')
  return { success: true, message: 'Court deleted successfully' }
}

// ============= AMENITY ACTIONS =============

/**
 * Create a new amenity
 */
export async function createAmenity(data: {
  name: string
  icon?: string
  description?: string
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: amenity, error } = await supabase
    .from('amenities')
    .insert({
      name: data.name,
      icon: data.icon || null,
      description: data.description || null
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'create_amenity',
    targetType: 'amenity',
    targetId: amenity.id,
    newValue: { name: data.name }
  })

  revalidatePath('/admin/venues')
  return { success: true, amenity, message: 'Amenity created successfully' }
}

/**
 * Update amenity
 */
export async function updateAmenity(amenityId: string, data: {
  name?: string
  icon?: string
  description?: string
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: amenity, error } = await supabase
    .from('amenities')
    .update(data)
    .eq('id', amenityId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'update_amenity',
    targetType: 'amenity',
    targetId: amenityId,
    newValue: data
  })

  revalidatePath('/admin/venues')
  return { success: true, amenity, message: 'Amenity updated successfully' }
}

/**
 * Delete amenity
 */
export async function deleteAmenity(amenityId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get amenity details for audit
  const { data: amenity } = await supabase
    .from('amenities')
    .select('name')
    .eq('id', amenityId)
    .single()

  const { error } = await supabase
    .from('amenities')
    .delete()
    .eq('id', amenityId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: 'delete_amenity',
    targetType: 'amenity',
    targetId: amenityId,
    oldValue: amenity
  })

  revalidatePath('/admin/venues')
  return { success: true, message: 'Amenity deleted successfully' }
}

/**
 * Toggle court verified status
 */
export async function toggleCourtVerified(courtId: string, isVerified: boolean) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: court, error } = await supabase
    .from('courts')
    .update({ is_verified: isVerified })
    .eq('id', courtId)
    .select('name, venue:venue_id(name)')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminAction({
    actionType: isVerified ? 'verify_court' : 'unverify_court',
    targetType: 'court',
    targetId: courtId,
    oldValue: { is_verified: !isVerified },
    newValue: { is_verified: isVerified }
  })

  revalidatePath('/admin/venues')
  return {
    success: true,
    message: `Court ${isVerified ? 'verified' : 'unverified'} successfully`,
    court
  }
}

/**
 * Batch update venues (activate, deactivate, verify, delete)
 */
export async function batchUpdateVenues(
  venueIds: string[],
  action: 'activate' | 'deactivate' | 'verify' | 'unverify' | 'delete'
) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    if (action === 'delete') {
      const { error } = await supabase
        .from('venues')
        .delete()
        .in('id', venueIds)

      if (error) throw error

      for (const venueId of venueIds) {
        await logAdminAction({
          actionType: 'batch_delete_venues',
          targetType: 'venue',
          targetId: venueId
        })
      }

      return { success: true, message: `${venueIds.length} venues deleted successfully` }
    }

    const updates: any = {}
    if (action === 'activate') updates.is_active = true
    if (action === 'deactivate') updates.is_active = false
    if (action === 'verify') updates.is_verified = true
    if (action === 'unverify') updates.is_verified = false

    const { error } = await supabase
      .from('venues')
      .update(updates)
      .in('id', venueIds)

    if (error) throw error

    for (const venueId of venueIds) {
      await logAdminAction({
        actionType: `batch_${action}_venues`,
        targetType: 'venue',
        targetId: venueId,
        newValue: updates
      })
    }

    revalidatePath('/admin/venues')
    return { success: true, message: `${venueIds.length} venues ${action}d successfully` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get list of cities from venues
 */
export async function getVenueCities() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: venues, error } = await supabase
    .from('venues')
    .select('city')

  if (error) {
    return { success: false, error: error.message }
  }

  const cities = [...new Set(venues?.map(v => v.city).filter(Boolean))]

  return { success: true, cities }
}
