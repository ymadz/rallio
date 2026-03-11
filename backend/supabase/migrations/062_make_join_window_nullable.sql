-- Migration 062: Add join_window_hours to queue_sessions (nullable)
-- NULL means no restriction — players can join the queue at any time.
-- This migration is self-contained and replaces 061.

-- Drop constraint if it exists (from 061 if already applied)
ALTER TABLE queue_sessions
  DROP CONSTRAINT IF EXISTS queue_sessions_join_window_hours_check;

-- Add column as nullable if it doesn't exist yet
ALTER TABLE queue_sessions
  ADD COLUMN IF NOT EXISTS join_window_hours smallint DEFAULT NULL;

-- If column was added by 061 as NOT NULL, relax it
ALTER TABLE queue_sessions
  ALTER COLUMN join_window_hours DROP NOT NULL,
  ALTER COLUMN join_window_hours SET DEFAULT NULL;

-- Add check: when set, value must be >= 1
ALTER TABLE queue_sessions
  ADD CONSTRAINT queue_sessions_join_window_hours_check
  CHECK (join_window_hours IS NULL OR join_window_hours >= 1);

COMMENT ON COLUMN queue_sessions.join_window_hours IS
  'Hours before session start that players can begin joining the queue. NULL = no restriction (join anytime).';
