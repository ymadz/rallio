import { createClient } from '@/lib/supabase/client'
import { formatDistanceMetric, calculateDistance } from '@rallio/shared'

// ============================================================
// TYPES
// ============================================================

export interface VenueFilters {
  searchQuery?: string
  minPrice?: number
  maxPrice?: number
  amenities?: string[]
  category?: string
  courtType?: 'indoor' | 'outdoor' | null
  rating?: number
  latitude?: number
  longitude?: number
  radiusKm?: number
  sortBy?: 'distance' | 'price_low' | 'price_high' | 'rating' | 'newest'
  limit?: number
  offset?: number
}

export interface VenueWithDetails {
  id: string
  name: string
  description: string | null
  address: string
  city: string
  latitude: number
  longitude: number
  phone: string | null
  email: string | null
  website: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
  is_active: boolean
  is_verified: boolean
  metadata: Record<string, any> | null
  created_at: string
  courts: CourtWithDetails[]
  minPrice: number
  maxPrice: number
  totalCourts: number
  activeCourtCount: number
  amenities: string[]
  distance?: number // in kilometers
  averageRating?: number
  totalReviews?: number
}

export interface CourtWithDetails {
  id: string
  venue_id: string
  name: string
  description: string | null
  surface_type: string
  court_type: 'indoor' | 'outdoor'
  capacity: number
  hourly_rate: number
  is_active: boolean
  metadata: Record<string, any> | null
  amenities: Array<{ id: string; name: string; icon: string | null }>
  images: Array<{
    id: string
    url: string
    alt_text: string | null
    is_primary: boolean
    display_order: number
  }>
  averageRating?: number
  totalReviews?: number
}

export interface CourtRating {
  id: string
  court_id: string
  user_id: string
  overall_rating: number
  quality_rating: number
  cleanliness_rating: number
  facilities_rating: number
  value_rating: number
  review: string | null
  created_at: string
  helpful_count: number
  user: {
    id: string
    display_name: string
    avatar_url: string | null
  }
  response?: {
    id: string
    response: string
    created_at: string
    responder: {
      id: string
      display_name: string
      avatar_url: string | null
    }
  }
}

export interface AvailabilitySlot {
  id: string
  court_id: string
  date: string
  start_time: string
  end_time: string
  is_available: boolean
  max_bookings: number
  current_bookings: number
}

// ============================================================
// VENUE QUERIES
// ============================================================

/**
 * Get venues with filtering, sorting, and pagination
 */
export async function getVenues(filters: VenueFilters = {}): Promise<{
  venues: VenueWithDetails[]
  total: number
  hasMore: boolean
}> {
  const supabase = createClient()

  const {
    searchQuery,
    minPrice = 0,
    maxPrice = 10000,
    amenities = [],
    category,
    courtType,
    rating = 0,
    latitude,
    longitude,
    radiusKm = 50,
    sortBy = 'newest',
    limit = 12,
    offset = 0,
  } = filters

  try {
    // Optimization: Use server-side pagination for specific sort options where possible.
    // We can do this if:
    // 1. We are not filtering by rating (calculated property)
    // 2. We are not sorting by distance (calculated property, unless using searchNearby)
    // 3. We are not sorting by price or rating (calculated properties)
    //    (Price sorting is tricky with 1:many courts relationship without a view)
    //
    // Currently, we optimize for the default case: sortBy='newest' and no rating filter.
    const canUseServerSidePagination =
      sortBy === 'newest' &&
      rating === 0 &&
      (!latitude || !longitude);

    if (canUseServerSidePagination) {
      // --- OPTIMIZED PATH ---
      let query = supabase
        .from('venues')
        .select(`
        id,
        name,
        description,
        address,
        city,
        latitude,
        longitude,
        phone,
        email,
        website,
        opening_hours,
        is_active,
        is_verified,
        metadata,
        created_at,
        courts!inner (
          id,
          name,
          court_type,
          hourly_rate,
          is_active,
          surface_type,
          capacity,
          description,
          metadata,
          court_amenities (
            amenities (
              id,
              name,
              icon
            )
          ),
          images:court_images (
            id,
            url,
            alt_text,
            is_primary,
            display_order
          )
        )
      `, { count: 'exact' })
        .eq('is_active', true)
        .eq('is_verified', true)
        .eq('courts.is_active', true)

      // Apply Filters
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      }
      if (category) {
        // Metadata filtering is JSONB, relies on containment or specific key
        // We'll perform metadata filtering in the query properly if possible, 
        // or fall back to client side if complex. 
        // For now, let's assume category is less common or handle it:
        // query = query.contains('metadata', { category: category })  <-- simplistic
        // Given complexity, let's Apply SEARCH query filters here but 
        // if we use inner join on courts, we can filter attributes there.
      }

      // Court Type Filter
      if (courtType) {
        query = query.eq('courts.court_type', courtType)
      }

      // Price Filter (At least one court must match the range)
      // Note: This logic means "Venue has a court in this range".
      // Original logic was "Venue minPrice > filterMax or Venue maxPrice < filterMin",
      // which effectively means "Venue has overlapping price range".
      // Simplified optimization:
      // query = query.gte('courts.hourly_rate', minPrice).lte('courts.hourly_rate', maxPrice)

      // Amenities Filter
      // PostgREST filtering on nested array is hard. 
      // STRICT OPTIMIZATION: Only use server pagination if filters are simple.
      // If amenities are selected, fall back to slow path (safe).
      const isSimpleFilters = amenities.length === 0 && !category && minPrice === 0 && maxPrice === 10000;

      if (isSimpleFilters) {
        // Apply Pagination
        query = query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data: rawVenues, error, count } = await query;
        if (error) throw error;

        if (!rawVenues || rawVenues.length === 0) {
          return { venues: [], total: count || 0, hasMore: false };
        }

        // Process ONLY the fetched venues (same processing logic as below)
        // We need to fetch ratings for THESE venues only.
        const processedVenues = await processVenuesList(supabase, rawVenues, latitude, longitude);

        return {
          venues: processedVenues,
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        };
      }
    }

    // --- ORIGINAL / FALLBACK PATH (Slow) ---
    // (Kept for complex filters: rating, price, amenities, distance sort)

    // Build the query
    let query = supabase
      .from('venues')
      .select(`
        id,
        name,
        description,
        address,
        city,
        latitude,
        longitude,
        phone,
        email,
        website,
        opening_hours,
        is_active,
        is_verified,
        metadata,
        created_at,
        courts (
          id,
          name,
          court_type,
          hourly_rate,
          is_active,
          surface_type,
          capacity,
          description,
          metadata,
          court_amenities (
            amenities (
              id,
              name,
              icon
            )
          ),
          images:court_images (
            id,
            url,
            alt_text,
            is_primary,
            display_order
          )
        )
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_verified', true) // Only show verified/approved venues in public listings
      .eq('courts.is_active', true)

    // Search filter
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    // Execute query to get raw data
    const { data: rawVenues, error, count } = await query

    if (error) throw error
    if (!rawVenues) return { venues: [], total: 0, hasMore: false }

    // Use shared processing function
    let processedVenues = await processVenuesList(supabase, rawVenues, latitude, longitude);

    // Apply client-side filters
    processedVenues = processedVenues.filter(venue => {
      // Category filter (if provided)
      if (category) {
        const cat = String(category).toLowerCase()
        const inMeta = venue.metadata && String(venue.metadata.category || '').toLowerCase() === cat
        const inName = String(venue.name || '').toLowerCase().includes(cat)
        const inDesc = String(venue.description || '').toLowerCase().includes(cat)
        if (!inMeta && !inName && !inDesc) return false
      }
      // Price filter
      if (venue.minPrice > maxPrice || venue.maxPrice < minPrice) return false

      // Court type filter
      if (courtType) {
        const hasMatchingType = venue.courts.some(
          (c: any) => c.court_type === courtType
        )
        if (!hasMatchingType) return false
      }

      // Amenities filter
      if (amenities.length > 0) {
        const hasAllAmenities = amenities.every(amenity =>
          venue.amenities.includes(amenity)
        )
        if (!hasAllAmenities) return false
      }

      // Rating filter
      if (rating > 0) {
        if (!venue.averageRating || Math.floor(venue.averageRating) !== rating) {
          return false
        }
      }

      return true
    })

    // Calculate distance filtering if not already done (done in processVenuesList)
    if (latitude && longitude && radiusKm) {
      // Filter by radius
      processedVenues = processedVenues.filter(
        venue => !venue.distance || venue.distance <= radiusKm
      )
    }

    // Sorting
    processedVenues.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return (a.distance || Infinity) - (b.distance || Infinity)
        case 'price_low':
          return a.minPrice - b.minPrice
        case 'price_high':
          return b.maxPrice - a.maxPrice
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0)
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    // Pagination
    const total = processedVenues.length
    const paginatedVenues = processedVenues.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return {
      venues: paginatedVenues,
      total,
      hasMore,
    }
  } catch (error) {
    console.error('Error fetching venues:', error)
    throw error
  }
}

/**
 * Helper to process raw venues, fetch ratings, and aggregate details.
 */
async function processVenuesList(supabase: any, rawVenues: any[], latitude?: number, longitude?: number): Promise<VenueWithDetails[]> {
  const courtIds: string[] = rawVenues.flatMap((v: any) => (v.courts || []).map((c: any) => c.id)).filter(Boolean)
  let courtRatings: Array<{ court_id: string; overall_rating: number }> = []
  if (courtIds.length > 0) {
    const { data: ratingsData } = await supabase
      .from('court_ratings')
      .select('court_id, overall_rating')
      .in('court_id', courtIds)

    courtRatings = ratingsData || []
  }

  // Aggregate ratings per court
  const courtAggregates: Record<string, { sum: number; count: number; avg: number }> = {}
  for (const r of courtRatings) {
    if (!courtAggregates[r.court_id]) courtAggregates[r.court_id] = { sum: 0, count: 0, avg: 0 }
    courtAggregates[r.court_id].sum += Number(r.overall_rating || 0)
    courtAggregates[r.court_id].count += 1
  }
  for (const k of Object.keys(courtAggregates)) {
    courtAggregates[k].avg = courtAggregates[k].count > 0 ? courtAggregates[k].sum / courtAggregates[k].count : 0
  }

  // Process and filter venues (attach computed average ratings)
  return rawVenues.map((venue: any) => {
    const activeCourts = venue.courts.filter((c: any) => c.is_active)

    // Calculate min/max price from active courts
    const prices = activeCourts.map((c: any) => c.hourly_rate)
    const minCourtPrice = prices.length > 0 ? Math.min(...prices) : 0
    const maxCourtPrice = prices.length > 0 ? Math.max(...prices) : 0

    // Collect unique amenities across all courts
    const uniqueAmenities = new Set<string>()
    activeCourts.forEach((court: any) => {
      court.court_amenities?.forEach((mapping: any) => {
        if (mapping.amenities?.name) {
          uniqueAmenities.add(mapping.amenities.name)
        }
      })
    })

    // Compute per-venue average rating using courtAggregates
    let venueSum = 0
    let venueCount = 0
    activeCourts.forEach((court: any) => {
      const agg = courtAggregates[court.id]
      if (agg && agg.count > 0) {
        venueSum += agg.sum
        venueCount += agg.count
      }
    })
    const venueAvg = venueCount > 0 ? venueSum / venueCount : undefined

    let v: VenueWithDetails = {
      ...venue,
      courts: activeCourts.map((court: any) => ({
        ...court,
        venue_id: venue.id,
        amenities: court.court_amenities?.map((m: any) => m.amenities).filter(Boolean) || [],
        images: court.images || [],
      })),
      minPrice: minCourtPrice,
      maxPrice: maxCourtPrice,
      totalCourts: activeCourts.length,
      activeCourtCount: activeCourts.length,
      amenities: Array.from(uniqueAmenities),
      averageRating: venueAvg,
      totalReviews: venueCount,
    }

    // Calculate distance if coordinates provided
    if (latitude && longitude) {
      v.distance = calculateDistance(
        latitude,
        longitude,
        venue.latitude,
        venue.longitude
      )
    }
    return v;
  })
}

/**
 * Get a single venue by ID with full details
 */
export async function getVenueById(
  venueId: string,
  userLatitude?: number,
  userLongitude?: number
): Promise<VenueWithDetails | null> {
  const supabase = createClient()

  try {
    const { data: venue, error } = await supabase
      .from('venues')
      .select(`
        id,
        name,
        description,
        address,
        city,
        latitude,
        longitude,
        phone,
        email,
        website,
        opening_hours,
        is_active,
        is_verified,
        metadata,
        created_at,
        courts (
          id,
          name,
          description,
          surface_type,
          court_type,
          capacity,
          hourly_rate,
          is_active,
          metadata,
          court_amenities (
            amenities (
              id,
              name,
              icon
            )
          ),
          court_images (
            id,
            url,
            alt_text,
            is_primary,
            display_order
          )
        )
      `)
      .eq('id', venueId)
      .eq('is_active', true)
      .eq('is_verified', true) // Only allow viewing verified venues
      .single()

    if (error) throw error
    if (!venue) return null

    console.log('🔍 [getVenueById] Raw venue data:', {
      id: venue.id,
      name: venue.name,
      is_active: venue.is_active,
      is_verified: venue.is_verified,
      courtsCount: venue.courts?.length || 0,
      courts: venue.courts?.map(c => ({ id: c.id, name: c.name, is_active: c.is_active }))
    })

    // Process courts
    const activeCourts = venue.courts.filter(c => c.is_active)
    const prices = activeCourts.map(c => c.hourly_rate)

    // Collect unique amenities
    const uniqueAmenities = new Set<string>()
    activeCourts.forEach(court => {
      court.court_amenities?.forEach((mapping: any) => {
        if (mapping.amenities?.name) {
          uniqueAmenities.add(mapping.amenities.name)
        }
      })
    })

    // Calculate distance if coordinates provided
    let distance: number | undefined
    if (userLatitude && userLongitude) {
      distance = calculateDistance(
        userLatitude,
        userLongitude,
        venue.latitude,
        venue.longitude
      )
    }

    // Get average rating for the venue (average of all court ratings)
    const courtIds = activeCourts.map(c => c.id)
    const ratingsData = await Promise.all(
      courtIds.map(id => getCourtRatings(id))
    )

    const allRatings = ratingsData.flat()
    const averageRating = allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r.overall_rating, 0) / allRatings.length
      : undefined

    return {
      ...venue,
      courts: activeCourts.map(court => ({
        ...court,
        venue_id: venue.id,
        amenities: court.court_amenities?.map((m: any) => m.amenities) || [],
        images: court.court_images || [],
      })),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      totalCourts: activeCourts.length,
      activeCourtCount: activeCourts.length,
      amenities: Array.from(uniqueAmenities),
      distance,
      averageRating,
      totalReviews: allRatings.length,
    }
  } catch (error) {
    console.error('Error fetching venue:', error)
    throw error
  }
}

/**
 * Search venues near a location using PostGIS
 */
export async function searchNearby(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  limit: number = 20
): Promise<VenueWithDetails[]> {
  const supabase = createClient()

  try {
    // Use PostGIS earth_distance function
    const { data: venues, error } = await supabase.rpc('nearby_venues', {
      user_lat: latitude,
      user_long: longitude,
      radius_km: radiusKm,
      result_limit: limit,
    })

    if (error) {
      console.error('PostGIS query error, falling back to client-side calculation:', error)
      // Fallback to getting all venues and calculating distance client-side
      const { venues: allVenues } = await getVenues({ latitude, longitude, radiusKm, limit })
      return allVenues
    }

    return venues || []
  } catch (error) {
    console.error('Error searching nearby venues:', error)
    // Fallback
    const { venues } = await getVenues({ latitude, longitude, radiusKm, limit })
    return venues
  }
}

// ============================================================
// COURT QUERIES
// ============================================================

/**
 * Get court ratings and reviews
 */
export async function getCourtRatings(courtId: string): Promise<CourtRating[]> {
  const supabase = createClient()

  try {
    const { data: ratings, error } = await supabase
      .from('court_ratings')
      .select(`
        id,
        court_id,
        user_id,
        overall_rating,
        quality_rating,
        cleanliness_rating,
        facilities_rating,
        value_rating,
        review,
        created_at,
        user:profiles!court_ratings_user_id_fkey (
          id,
          display_name,
          avatar_url
        ),
        rating_responses (
          id,
          response,
          created_at,
          responder:profiles!rating_responses_responder_id_fkey (
            id,
            display_name,
            avatar_url
          )
        ),
        rating_helpful_votes (
          id
        )
      `)
      .eq('court_id', courtId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (ratings || []).map(rating => {
      const response = rating.rating_responses?.[0]
      return {
        ...rating,
        user: (Array.isArray(rating.user) ? rating.user[0] : rating.user) as { id: string; display_name: string; avatar_url: string | null },
        helpful_count: rating.rating_helpful_votes?.length || 0,
        response: response ? {
          id: response.id,
          response: response.response,
          created_at: response.created_at,
          responder: (Array.isArray(response.responder) ? response.responder[0] : response.responder) as { id: string; display_name: string; avatar_url: string | null }
        } : undefined,
      }
    })
  } catch (error) {
    console.error('Error fetching court ratings:', error)
    return []
  }
}

/**
 * Get court availability for a specific date range
 */
export async function getCourtAvailability(
  courtId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilitySlot[]> {
  const supabase = createClient()

  try {
    const { data: slots, error } = await supabase
      .from('court_availabilities')
      .select('*')
      .eq('court_id', courtId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) throw error

    return slots || []
  } catch (error) {
    console.error('Error fetching court availability:', error)
    return []
  }
}

/**
 * Get average rating for a court
 */
export async function getCourtAverageRating(courtId: string): Promise<{
  averageRating: number
  totalReviews: number
  ratingBreakdown: {
    overall: number
    quality: number
    cleanliness: number
    facilities: number
    value: number
  }
}> {
  const ratings = await getCourtRatings(courtId)

  if (ratings.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: {
        overall: 0,
        quality: 0,
        cleanliness: 0,
        facilities: 0,
        value: 0,
      },
    }
  }

  const sum = {
    overall: ratings.reduce((acc, r) => acc + r.overall_rating, 0),
    quality: ratings.reduce((acc, r) => acc + r.quality_rating, 0),
    cleanliness: ratings.reduce((acc, r) => acc + r.cleanliness_rating, 0),
    facilities: ratings.reduce((acc, r) => acc + r.facilities_rating, 0),
    value: ratings.reduce((acc, r) => acc + r.value_rating, 0),
  }

  const count = ratings.length

  return {
    averageRating: sum.overall / count,
    totalReviews: count,
    ratingBreakdown: {
      overall: sum.overall / count,
      quality: sum.quality / count,
      cleanliness: sum.cleanliness / count,
      facilities: sum.facilities / count,
      value: sum.value / count,
    },
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format distance for display (wrapper for shared utility)
 * Converts km to meters and uses shared formatDistanceMetric
 */
export function formatDistance(km: number): string {
  return formatDistanceMetric(km * 1000) // Convert km to meters
}

/**
 * Check if venue is currently open
 */
export function isVenueOpen(openingHours: Record<string, { open: string; close: string }> | null): boolean {
  if (!openingHours) return false

  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = dayNames[now.getDay()]

  const todayHours = openingHours[today]
  if (!todayHours) return false

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const openTime = parseInt(todayHours.open.replace(':', ''))
  const closeTime = parseInt(todayHours.close.replace(':', ''))

  return currentTime >= openTime && currentTime <= closeTime
}

/**
 * Format operating hours for display
 */
export function formatOperatingHours(openingHours: Record<string, { open: string; close: string }> | null): string {
  if (!openingHours) return 'Hours not available'

  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = dayNames[now.getDay()]

  const todayHours = openingHours[today]
  if (!todayHours) return 'Closed today'

  return `${formatTime(todayHours.open)} - ${formatTime(todayHours.close)}`
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayHour}:${minutes} ${ampm}`
}
