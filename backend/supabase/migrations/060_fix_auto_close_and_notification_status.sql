-- Migration 060: Fix auto_close_expired_sessions and notification trigger status values
-- Created: 2026
-- Purpose:
--   Migration 035 created auto_close_expired_sessions() setting status = 'closed'.
--   Migration 041 removed 'closed' from the queue_sessions_status_check constraint.
--   As a result, any call to auto_close_expired_sessions() that finds expired sessions
--   throws a CHECK constraint violation, causing join_queue RPC to fail for all users
--   whenever expired sessions exist.
--
--   This migration:
--   1. Replaces auto_close_expired_sessions() to use 'completed' instead of 'closed'
--      and removes the now-invalid 'paused' status from the WHERE clause.
--   2. Fixes notify_queue_participants_session_end() to fire on 'completed'
--      instead of 'closed' (which it never does since 'closed' is no longer valid).

-- ============================================================================
-- 1. FIX auto_close_expired_sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS void AS $$
DECLARE
  activated_count int;
  completed_count int;
BEGIN
  -- First: auto-activate sessions that should now be active
  UPDATE queue_sessions
  SET
    status = 'active',
    updated_at = now()
  WHERE
    status = 'open'
    AND start_time <= now()
    AND end_time > now();

  GET DIAGNOSTICS activated_count = ROW_COUNT;

  IF activated_count > 0 THEN
    RAISE NOTICE 'Auto-activated % queue sessions', activated_count;
  END IF;

  -- Then: complete sessions that are past their end_time
  -- NOTE: 'paused' is no longer a valid status (removed in migration 041),
  -- so we only check 'open' and 'active'.
  UPDATE queue_sessions
  SET
    status = 'completed',
    updated_at = now()
  WHERE
    status IN ('open', 'active')
    AND end_time < now();

  GET DIAGNOSTICS completed_count = ROW_COUNT;

  IF completed_count > 0 THEN
    RAISE NOTICE 'Auto-completed % expired queue sessions', completed_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_close_expired_sessions() IS
  'Transitions expired queue sessions to completed and open sessions to active based on current time.
   Uses completed (not closed) to match the status constraint from migration 041.';

-- ============================================================================
-- 2. FIX notify_queue_participants_session_end TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_queue_participants_session_end()
RETURNS TRIGGER AS $$
DECLARE
  v_venue_name text;
BEGIN
  -- Fire when status transitions to 'completed' (previously 'closed', which is
  -- no longer a valid status as of migration 041).
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    -- Get venue details
    SELECT v.name
    INTO v_venue_name
    FROM courts c
    JOIN venues v ON c.venue_id = v.id
    WHERE c.id = NEW.court_id;

    -- Notify active participants that the session has ended
    INSERT INTO notifications (user_id, type, title, message, action_url)
    SELECT
      qp.user_id,
      'queue_session_ended',
      'Queue Session Ended',
      format('The queue session at %s has ended.', COALESCE(v_venue_name, 'Unknown Venue')),
      '/queue/' || NEW.id
    FROM queue_participants qp
    WHERE qp.queue_session_id = NEW.id
      AND qp.status != 'left';

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_queue_participants_session_end() IS
  'Notifies active participants when a queue session transitions to completed.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify the function was created/updated
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'auto_close_expired_sessions'
  ) THEN
    RAISE EXCEPTION 'Migration 060 failed: auto_close_expired_sessions function not found';
  END IF;

  RAISE NOTICE 'Migration 060 applied successfully: auto_close uses completed status';
END $$;
