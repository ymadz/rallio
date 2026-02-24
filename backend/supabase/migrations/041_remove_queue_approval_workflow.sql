-- Migration 041: Remove Queue Approval Workflow
-- Created: 2026-02-25
-- Purpose:
-- 1. Drop the approval trigger that forces status to 'pending_approval' on insert
-- 2. Drop related approval notification triggers
-- 3. Simplify status constraint to the 5 valid statuses
-- 4. Migrate any legacy sessions to their correct status
--
-- SIMPLIFIED LIFECYCLE:
-- pending_payment → open → active → completed
-- Terminal: completed, cancelled

-- ============================================================================
-- 1. DROP APPROVAL TRIGGERS
-- ============================================================================

-- This is the trigger that overrides NEW.status to 'pending_approval' on every insert
DROP TRIGGER IF EXISTS trigger_set_queue_approval_expiration ON queue_sessions;
DROP FUNCTION IF EXISTS set_queue_approval_expiration();

-- Drop approval notification triggers
DROP TRIGGER IF EXISTS trigger_notify_court_admin_new_queue_approval ON queue_sessions;
DROP FUNCTION IF EXISTS notify_court_admin_new_queue_approval();

DROP TRIGGER IF EXISTS trigger_notify_organizer_approval_decision ON queue_sessions;
DROP FUNCTION IF EXISTS notify_organizer_approval_decision();

-- Drop the approval expiration function
DROP FUNCTION IF EXISTS expire_pending_queue_approvals();

-- Drop the pending approvals view
DROP VIEW IF EXISTS pending_queue_approvals;

-- ============================================================================
-- 2. MIGRATE LEGACY SESSIONS TO VALID STATUSES
-- ============================================================================

-- pending_approval → pending_payment (approval flow removed)
UPDATE queue_sessions
SET status = 'pending_payment', updated_at = now()
WHERE status = 'pending_approval';

-- draft → pending_payment (draft removed)
UPDATE queue_sessions
SET status = 'pending_payment', updated_at = now()
WHERE status = 'draft';

-- upcoming → open (upcoming removed, time-based logic handled in code)
UPDATE queue_sessions
SET status = 'open', updated_at = now()
WHERE status = 'upcoming';

-- paused → active (pause feature removed)
UPDATE queue_sessions
SET status = 'active', updated_at = now()
WHERE status = 'paused';

-- closed → completed (closed is a legacy alias)
UPDATE queue_sessions
SET status = 'completed', updated_at = now()
WHERE status = 'closed';

-- rejected → cancelled
UPDATE queue_sessions
SET status = 'cancelled', updated_at = now()
WHERE status = 'rejected';

-- Fix any expired sessions that were stuck in old statuses
UPDATE queue_sessions
SET status = 'completed', updated_at = now()
WHERE status IN ('open', 'active')
  AND end_time < now();

-- ============================================================================
-- 3. UPDATE STATUS CONSTRAINT
-- ============================================================================

ALTER TABLE queue_sessions DROP CONSTRAINT IF EXISTS queue_sessions_status_check;

ALTER TABLE queue_sessions
  ADD CONSTRAINT queue_sessions_status_check
  CHECK (status IN (
    'pending_payment',    -- Waiting for payment (cash or e-wallet)
    'open',               -- Paid, accepting players (within join window of start)
    'active',             -- Currently running (start_time <= now < end_time)
    'completed',          -- Finished (end_time passed or manually closed)
    'cancelled'           -- Cancelled by QM
  ));

-- ============================================================================
-- 4. SET requires_approval DEFAULT TO FALSE
-- ============================================================================

-- Since we removed the approval flow, default to false so triggers don't fire
ALTER TABLE queue_sessions ALTER COLUMN requires_approval SET DEFAULT false;

-- Update all existing sessions
UPDATE queue_sessions SET requires_approval = false WHERE requires_approval = true;

-- ============================================================================
-- 5. DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN queue_sessions.status IS
  'Queue session lifecycle:
   - pending_payment: Created, waiting for e-wallet or cash payment
   - open: Paid, accepting players (within join window before start)
   - active: Currently running (start_time <= now < end_time)  
   - completed: Session finished (end_time passed or manually closed)
   - cancelled: Cancelled by Queue Master';

COMMENT ON CONSTRAINT queue_sessions_status_check ON queue_sessions IS
  'Lifecycle: pending_payment → open → active → completed | cancelled';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify no sessions have legacy statuses
  IF EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE status NOT IN ('pending_payment', 'open', 'active', 'completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Migration 041 failed: Some sessions still have legacy statuses';
  END IF;

  -- Verify trigger was dropped
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_set_queue_approval_expiration'
  ) THEN
    RAISE EXCEPTION 'Migration 041 failed: Approval trigger still exists';
  END IF;

  RAISE NOTICE 'Migration 041 applied successfully - approval workflow removed';
END $$;
