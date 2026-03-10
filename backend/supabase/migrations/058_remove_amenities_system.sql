-- Remove Amenities System
-- Drops the amenities and court_amenities tables and policies

-- 1. Drop the court_amenities many-to-many table first
DROP TABLE IF EXISTS public.court_amenities CASCADE;

-- 2. Drop the amenities lookup table
DROP TABLE IF EXISTS public.amenities CASCADE;

-- 3. Any functions or triggers related to amenities would be dropped by CASCADE
-- but if there are explicit ones, we could add them here. None in the initial schema rely on it outside of the tables themselves.
