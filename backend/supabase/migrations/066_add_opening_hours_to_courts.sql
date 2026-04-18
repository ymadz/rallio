-- Add opening_hours column to courts table to support court-specific overrides
ALTER TABLE courts ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT NULL;

COMMENT ON COLUMN courts.opening_hours IS 'Court-specific operating hours. If null, falls back to venue opening_hours.';
