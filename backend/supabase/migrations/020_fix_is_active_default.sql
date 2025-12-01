-- Migration 020: Fix is_active field default values
-- This migration ensures all existing users have is_active set to true if NULL
-- and sets the default value for future records

-- Update existing NULL values to true
UPDATE profiles
SET is_active = true
WHERE is_active IS NULL;

-- Ensure the column has a default value (in case it wasn't set before)
ALTER TABLE profiles
ALTER COLUMN is_active SET DEFAULT true;

-- Add a comment for documentation
COMMENT ON COLUMN profiles.is_active IS 'Indicates if the user account is active. NULL is treated as true for backwards compatibility.';
