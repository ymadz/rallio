-- =====================================================
-- MIGRATION: Fix court_availabilities Schema
-- Description: Add date column for easier querying and indexing
-- Date: 2025-01-21
-- =====================================================

-- Add date column as a generated column from start_time
ALTER TABLE court_availabilities
ADD COLUMN IF NOT EXISTS date DATE
GENERATED ALWAYS AS (start_time::date) STORED;

-- Create index on court_id and date for faster queries
CREATE INDEX IF NOT EXISTS idx_court_availabilities_date
ON court_availabilities(court_id, date)
WHERE is_reserved = false;

-- Create index for availability lookups
CREATE INDEX IF NOT EXISTS idx_court_availabilities_lookup
ON court_availabilities(court_id, start_time, end_time)
WHERE is_reserved = false;

-- Add comment
COMMENT ON COLUMN court_availabilities.date IS 'Generated date field from start_time for easier querying';
