-- Migration 051: Auto-advance queue session statuses
-- Purpose: P3b - Ensures sessions transition upcoming -> open -> active -> completed automatically
-- Date: 2026-03-04

CREATE OR REPLACE FUNCTION auto_advance_session_statuses()
RETURNS jsonb AS $$
DECLARE
  v_upcoming_to_open int := 0;
  v_open_to_active int := 0;
  v_to_completed int := 0;
BEGIN
  -- 1. upcoming -> open (within 2 hours of start_time)
  UPDATE queue_sessions
  SET status = 'open', updated_at = now()
  WHERE status = 'upcoming'
    AND start_time <= now() + interval '2 hours';
    
  GET DIAGNOSTICS v_upcoming_to_open = ROW_COUNT;

  -- 2. open -> active (start_time has arrived)
  UPDATE queue_sessions
  SET status = 'active', updated_at = now()
  WHERE status = 'open'
    AND start_time <= now()
    AND end_time > now();
    
  GET DIAGNOSTICS v_open_to_active = ROW_COUNT;

  -- 3. open/active/paused -> completed (end_time has passed)
  -- Note: We already have auto_close_expired_sessions() for this, but doing it here 
  -- centrally keeps all time-based transitions in one place.
  UPDATE queue_sessions
  SET status = 'completed', updated_at = now()
  WHERE status IN ('open', 'active', 'paused')
    AND end_time < now();
    
  GET DIAGNOSTICS v_to_completed = ROW_COUNT;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'advanced_to_open', v_upcoming_to_open,
    'advanced_to_active', v_open_to_active,
    'advanced_to_completed', v_to_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated (since it may be triggered via edge functions)
GRANT EXECUTE ON FUNCTION auto_advance_session_statuses() TO authenticated;

-- Add Comment
COMMENT ON FUNCTION auto_advance_session_statuses() IS 'Automatically progresses queue session statuses based on current time (upcoming -> open -> active -> completed)';
