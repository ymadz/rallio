/**
 * Courts and venues service - mobile
 * Handles court discovery, venue details, availability, nearby search
 */

import { supabase } from './supabase';

export type CourtFilters = {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  minRating?: number;
  radius?: number; // in km
  latitude?: number;
  longitude?: number;
};

/**
 * Get nearby venues using PostGIS
 */
export async function getNearbyVenues(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  limit: number = 20
) {
  const { data, error } = await supabase.rpc('nearby_venues', {
    lat: latitude,
    lng: longitude,
    radius_km: radiusKm,
    limit_count: limit,
  });

  if (error) throw error;
  return data;
}

/**
 * Get all venues with optional filters
 */
export async function getVenues(filters?: CourtFilters) {
  let query = supabase
    .from('venues')
    .select(`
      *,
      courts (
        id,
        court_number,
        floor_type,
        price_per_hour,
        is_available,
        court_images (
          id,
          image_url,
          display_order,
          is_primary
        )
      ),
      venue_reviews (
        rating
      )
    `)
    .eq('is_active', true)
    .eq('approval_status', 'approved');

  // Apply search filter
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,address.ilike.%${filters.search}%`
    );
  }

  // Apply amenities filter
  if (filters?.amenities && filters.amenities.length > 0) {
    query = query.contains('amenities', filters.amenities);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate average rating for each venue
  const venuesWithRatings = data?.map((venue) => {
    const reviews = venue.venue_reviews || [];
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      ...venue,
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  });

  // Apply rating filter
  let filtered = venuesWithRatings || [];
  if (filters?.minRating) {
    filtered = filtered.filter((v) => v.averageRating >= filters.minRating!);
  }

  // Apply price filter (based on min court price)
  if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
    filtered = filtered.filter((venue) => {
      const prices = venue.courts.map((c: any) => c.price_per_hour);
      const minPrice = Math.min(...prices);

      if (filters.minPrice !== undefined && minPrice < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice !== undefined && minPrice > filters.maxPrice) {
        return false;
      }
      return true;
    });
  }

  return filtered;
}

/**
 * Get venue by ID
 */
export async function getVenueById(venueId: string) {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      courts (
        *,
        court_images (
          id,
          image_url,
          display_order,
          is_primary
        )
      ),
      venue_reviews (
        *,
        profiles (
          first_name,
          last_name,
          avatar_url
        )
      ),
      operating_hours (
        id,
        day_of_week,
        open_time,
        close_time,
        is_closed
      )
    `)
    .eq('id', venueId)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get court by ID
 */
export async function getCourtById(courtId: string) {
  const { data, error } = await supabase
    .from('courts')
    .select(`
      *,
      venue:venues (
        *,
        operating_hours (
          id,
          day_of_week,
          open_time,
          close_time,
          is_closed
        )
      ),
      court_images (
        id,
        image_url,
        display_order,
        is_primary
      )
    `)
    .eq('id', courtId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get court availability for a specific date
 */
export async function getCourtAvailability(courtId: string, date: string) {
  const { data, error } = await supabase
    .from('court_availabilities')
    .select('*')
    .eq('court_id', courtId)
    .eq('date', date)
    .single();

  if (error) {
    // If no availability record exists, return null (means court is available all day)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Get reserved time slots for a court on a specific date
 */
export async function getReservedSlots(courtId: string, date: string) {
  const { data, error } = await supabase
    .from('reservations')
    .select('start_time, end_time')
    .eq('court_id', courtId)
    .gte('start_time', `${date}T00:00:00`)
    .lt('start_time', `${date}T23:59:59`)
    .in('status', ['pending', 'confirmed']);

  if (error) throw error;
  return data || [];
}

/**
 * Calculate available time slots for a court on a date
 */
export async function getAvailableTimeSlots(
  courtId: string,
  date: string,
  slotDurationMinutes: number = 60
) {
  // Get court with venue operating hours
  const court = await getCourtById(courtId);
  if (!court.venue) throw new Error('Venue not found');

  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = new Date(date).getDay();

  // Get operating hours for the day
  const operatingHours = court.venue.operating_hours?.find(
    (oh: any) => oh.day_of_week === dayOfWeek
  );

  if (!operatingHours || operatingHours.is_closed) {
    return []; // Venue is closed on this day
  }

  // Get reserved slots
  const reservedSlots = await getReservedSlots(courtId, date);

  // Generate all possible time slots
  const slots = [];
  const openTime = new Date(`${date}T${operatingHours.open_time}`);
  const closeTime = new Date(`${date}T${operatingHours.close_time}`);

  let currentTime = new Date(openTime);

  while (currentTime < closeTime) {
    const slotEnd = new Date(currentTime.getTime() + slotDurationMinutes * 60000);

    // Check if slot overlaps with any reservation
    const isReserved = reservedSlots.some((reservation) => {
      const resStart = new Date(reservation.start_time);
      const resEnd = new Date(reservation.end_time);

      return (
        (currentTime >= resStart && currentTime < resEnd) ||
        (slotEnd > resStart && slotEnd <= resEnd) ||
        (currentTime <= resStart && slotEnd >= resEnd)
      );
    });

    slots.push({
      startTime: currentTime.toISOString(),
      endTime: slotEnd.toISOString(),
      available: !isReserved,
    });

    currentTime = slotEnd;
  }

  return slots;
}

/**
 * Get venue reviews
 */
export async function getVenueReviews(venueId: string) {
  const { data, error } = await supabase
    .from('venue_reviews')
    .select(`
      *,
      profiles (
        first_name,
        last_name,
        avatar_url
      ),
      review_images (
        id,
        image_url
      ),
      review_responses (
        id,
        response_text,
        created_at,
        profiles (
          first_name,
          last_name
        )
      )
    `)
    .eq('venue_id', venueId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Submit venue review (Player role)
 */
export async function submitVenueReview(
  venueId: string,
  playerId: string,
  reviewData: {
    rating: number;
    review_text?: string;
    court_quality_rating?: number;
    facility_rating?: number;
    value_rating?: number;
    imageUris?: string[];
  }
) {
  const { data, error } = await supabase
    .from('venue_reviews')
    .insert({
      venue_id: venueId,
      player_id: playerId,
      ...reviewData,
      status: 'published',
    })
    .select()
    .single();

  if (error) throw error;

  // Upload review images if provided
  if (reviewData.imageUris && reviewData.imageUris.length > 0) {
    await uploadReviewImages(data.id, reviewData.imageUris);
  }

  return data;
}

/**
 * Upload review images
 */
async function uploadReviewImages(reviewId: string, imageUris: string[]) {
  for (let i = 0; i < imageUris.length; i++) {
    const imageUri = imageUris[i];
    const response = await fetch(imageUri);
    const blob = await response.blob();

    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${reviewId}-${i}-${Date.now()}.${fileExt}`;
    const filePath = `review-images/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('review-images')
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('review-images')
      .getPublicUrl(filePath);

    // Insert review image record
    await supabase.from('review_images').insert({
      review_id: reviewId,
      image_url: urlData.publicUrl,
    });
  }
}
