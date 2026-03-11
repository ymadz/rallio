-- Migration 061: Add configurable join window to queue_sessions
-- Allows queue masters to set how many hours before the session start
-- that players can join the queue. Default is 2 hours.

ALTER TABLE queue_sessions
  ADD COLUMN IF NOT EXISTS join_window_hours smallint NOT NULL DEFAULT 2
  CHECK (join_window_hours >= 1);

COMMENT ON COLUMN queue_sessions.join_window_hours IS
  'Hours before session start that players can begin joining the queue (1-24). Default: 2.';

CREATE INDEX IF NOT EXISTS idx_queue_sessions_join_window
  ON queue_sessions (join_window_hours);
