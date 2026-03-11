-- Migration 062: Make join_window_hours nullable
-- NULL means no restriction — players can join the queue at any time.

-- Drop existing check constraint
ALTER TABLE queue_sessions
  DROP CONSTRAINT IF EXISTS queue_sessions_join_window_hours_check;

-- Allow NULL values and change default to NULL (no restriction)
ALTER TABLE queue_sessions
  ALTER COLUMN join_window_hours DROP NOT NULL,
  ALTER COLUMN join_window_hours SET DEFAULT NULL;

-- Re-add check: when set, value must be >= 1
ALTER TABLE queue_sessions
  ADD CONSTRAINT queue_sessions_join_window_hours_check
  CHECK (join_window_hours IS NULL OR join_window_hours >= 1);

COMMENT ON COLUMN queue_sessions.join_window_hours IS
  'Hours before session start that players can begin joining the queue. NULL = no restriction (join anytime).';
