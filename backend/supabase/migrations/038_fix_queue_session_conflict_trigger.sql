-- Migration 038: Fix Queue Session Status Timing
-- Created: 2026-02-11
-- Purpose:
-- 1. Add auto_activate_ready_sessions() function to promote 'open' sessions 
--    to 'active' when their start_time has been reached.
-- 2. Update auto_close_expired_sessions() to also handle auto-activation.
-- This ensures the "Active" status in the dashboard corresponds to the actual
-- start time/date of the session.

-- ============================================================================
-- 1. AUTO-ACTIVATE READY SESSIONS
-- ============================================================================

-- Function to activate sessions whose start_time has been reached
CREATE OR REPLACE FUNCTION auto_activate_ready_sessions()
RETURNS void AS $$
DECLARE
  activated_count int;
BEGIN
  -- Promote 'open' sessions to 'active' when start_time <= now
  -- 'open' means: paid & approved, ready to accept players, but not yet started
  UPDATE queue_sessions
  SET 
    status = 'active',
    updated_at = now()
  WHERE 
    status = 'open'
    AND start_time <= now()
    AND end_time > now();  -- Don't activate if already past end_time
    
  GET DIAGNOSTICS activated_count = ROW_COUNT;
  
  IF activated_count > 0 THEN
    RAISE NOTICE 'Auto-activated % queue sessions (start_time reached)', activated_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_activate_ready_sessions() IS 'Activates open queue sessions whose start_time has been reached. Should be called periodically or before critical actions.';

-- ============================================================================
-- 2. UPDATE AUTO-CLOSE TO ALSO AUTO-ACTIVATE
-- ============================================================================

-- Update the auto_close function to also handle activation
CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS void AS $$
DECLARE
  activated_count int;
  closed_count int;
BEGIN
  -- First: auto-activate sessions that should be active
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

  -- Then: close sessions that are past their end_time
  UPDATE queue_sessions
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status IN ('open', 'active', 'paused')
    AND end_time < now();
    
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  
  IF closed_count > 0 THEN
    RAISE NOTICE 'Auto-closed % expired queue sessions', closed_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. UPDATE join_queue RPC TO ALSO AUTO-ACTIVATE
-- ============================================================================

-- Update join_queue to call auto-activation before processing
-- (The existing function already calls auto_close_expired_sessions which now
--  includes auto-activation, so no separate change needed if using that path)

-- ============================================================================
-- 4. FIX EXISTING SESSIONS: Demote any 'active' sessions whose start_time is 
--    still in the future back to 'open'
-- ============================================================================

-- One-time fix for sessions incorrectly marked as 'active' for future dates
UPDATE queue_sessions
SET 
  status = 'open',
  updated_at = now()
WHERE 
  status = 'active'
  AND start_time > now()
  AND end_time > now();