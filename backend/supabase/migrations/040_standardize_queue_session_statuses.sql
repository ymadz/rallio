-- Migration 040: Standardize Queue Session Statuses
-- Created: 2026-02-11
-- Purpose:
-- 1. Add 'upcoming' and 'completed' statuses to queue_sessions
-- 2. Migrate existing 'closed' to 'completed'
-- 3. Migrate existing 'open'/'active' based on time logic
-- 4. Document the standardized lifecycle

-- ============================================================================
-- QUEUE SESSION STATUS LIFECYCLE:
-- pending_payment → upcoming → open → active → completed
--
-- pending_payment: Created, waiting for payment (e-wallet or cash)
-- upcoming:        Paid, but more than 2 hours before start_time
-- open:            Within 2 hours of start_time, players can join
-- active:          start_time <= now < end_time, session is running
-- completed:       end_time has passed, session finished
-- cancelled:       Cancelled by user or admin
-- paused:          Temporarily paused by Queue Master
-- ============================================================================

-- 1. Drop existing constraint
ALTER TABLE queue_sessions DROP CONSTRAINT IF EXISTS queue_sessions_status_check;

-- 2. Add new constraint with all statuses
ALTER TABLE queue_sessions
  ADD CONSTRAINT queue_sessions_status_check
  CHECK (status IN (
    'draft',              -- Legacy: kept for backwards compatibility
    'pending_payment',    -- Waiting for payment
    'pending_approval',   -- Legacy: kept for backwards compatibility
    'upcoming',           -- Paid, waiting (> 2h before start)
    'open',               -- Within 2h of start, accepting players
    'active',             -- Currently running
    'paused',             -- Temporarily paused
    'completed',          -- Finished successfully
    'closed',             -- Legacy: alias for completed
    'cancelled',          -- Cancelled
    'rejected'            -- Court Admin rejected
  ));

-- 3. Migrate 'closed' to 'completed'
UPDATE queue_sessions
SET status = 'completed'
WHERE status = 'closed';

-- 4. Fix sessions based on current time
-- Sessions that are 'open' but start_time hasn't arrived yet AND > 2h away → upcoming
-- Sessions that are 'open' and start_time <= now → active
-- Sessions that are 'active' but end_time < now → completed

-- 4a. Active sessions past end_time → completed
UPDATE queue_sessions
SET status = 'completed', updated_at = now()
WHERE status IN ('open', 'active', 'paused')
  AND end_time < now();

-- 4b. Open sessions with start_time in the past → active
UPDATE queue_sessions
SET status = 'active', updated_at = now()
WHERE status = 'open'
  AND start_time <= now()
  AND end_time > now();

-- 4c. Open sessions more than 2h from start → upcoming
UPDATE queue_sessions
SET status = 'upcoming', updated_at = now()
WHERE status = 'open'
  AND start_time > now() + interval '2 hours';

-- 5. Document the status column
COMMENT ON COLUMN queue_sessions.status IS 
  'Queue session lifecycle:
   - pending_payment: Waiting for e-wallet or cash payment
   - upcoming: Paid, more than 2h before start (players cannot join yet)
   - open: Within 2h of start, accepting players
   - active: Currently running (start_time <= now < end_time)
   - completed: Session finished (end_time passed)
   - paused: Temporarily paused by Queue Master
   - cancelled: Cancelled by user or admin';

COMMENT ON CONSTRAINT queue_sessions_status_check ON queue_sessions IS 
  'Lifecycle: pending_payment → upcoming → open → active → completed';
