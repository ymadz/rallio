-- Run this in your Supabase SQL Editor
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_reservations_recurrence_group 
ON reservations(recurrence_group_id);

COMMENT ON COLUMN reservations.recurrence_group_id IS 'UUID linking multiple reservations belonging to the same recurring series';
