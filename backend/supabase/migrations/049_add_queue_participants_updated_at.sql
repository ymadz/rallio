-- Migration 049: Add updated_at column to queue_participants
-- Purpose: Fixes bug in join_queue RPC where reactivation fails due to missing updated_at column
-- Date: 2026-03-04

-- 1. Add column with default now()
ALTER TABLE queue_participants
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Backfill existing rows with joined_at as baseline
UPDATE queue_participants
  SET updated_at = joined_at;

-- 3. Add auto-update trigger
CREATE TRIGGER update_queue_participants_updated_at
  BEFORE UPDATE ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON COLUMN queue_participants.updated_at IS 'Timestamp of last update, used for race condition checks and reactivation order.';
