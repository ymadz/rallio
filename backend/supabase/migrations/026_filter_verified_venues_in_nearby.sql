-- =====================================================
-- MIGRATION 026: Filter Verified Venues in Nearby Search
-- Description: Update nearby_venues function to only return verified venues
-- Date: 2025-12-02
-- Purpose: Ensure unverified venues don't appear in public search results
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS nearby_venues(FLOAT, FLOAT, FLOAT, INT);

-- Create updated nearby_venues function with is_verified check
CREATE OR REPLACE FUNCTION nearby_venues(
  user_lat FLOAT,
  user_long FLOAT,
  radius_km FLOAT DEFAULT 50,
  result_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  address TEXT,
  city VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  phone VARCHAR,
  email VARCHAR,
  website VARCHAR,
  opening_hours JSONB,
  is_active BOOLEAN,
  is_verified BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.description,
    v.address,
    v.city,
    v.latitude,
    v.longitude,
    v.phone,
    v.email,
    v.website,
    v.opening_hours,
    v.is_active,
    v.is_verified,
    v.metadata,
    v.created_at,
    v.updated_at,
    ROUND(
      (earth_distance(
        ll_to_earth(user_lat, user_long),
        ll_to_earth(v.latitude::float, v.longitude::float)
      ) / 1000)::numeric,
      1
    )::float AS distance_km
  FROM venues v
  WHERE v.is_active = true
    AND v.is_verified = true  -- Only return verified/approved venues
    AND v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND earth_box(
      ll_to_earth(user_lat, user_long),
      radius_km * 1000
    ) @> ll_to_earth(v.latitude::float, v.longitude::float)
  ORDER BY distance_km
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION nearby_venues IS 'Returns VERIFIED venues within specified radius (km) from user location, sorted by distance. Unverified venues are excluded from public search.';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION nearby_venues TO authenticated;
GRANT EXECUTE ON FUNCTION nearby_venues TO anon;
