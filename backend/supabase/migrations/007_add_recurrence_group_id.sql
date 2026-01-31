-- Add recurrence_group_id to reservations table
-- This allows grouping multiple reservations into a single "Recurring Series"

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

-- Add index for faster lookups of series
CREATE INDEX IF NOT EXISTS idx_reservations_recurrence_group 
ON reservations(recurrence_group_id);

COMMENT ON COLUMN reservations.recurrence_group_id IS 'UUID linking multiple reservations belonging to the same recurring series';
