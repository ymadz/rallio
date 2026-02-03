-- Migration 035: Fix Queue System
-- Created: 2026-02-04
-- Purpose: 
-- 1. Centralize 'Join Queue' logic in a database RPC to prevent race conditions (Mobile vs Web).
-- 2. Add mechanism to auto-close stale sessions.
-- 3. Enforce Max Players constraint at the database level.

-- ============================================================================
-- 1. AUTO-CLOSE STALE SESSIONS
-- ============================================================================

-- Function to close sessions that have passed their end time
CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS void AS $$
DECLARE
  closed_count int;
BEGIN
  -- Update sessions that are open/active/paused but past their end_time
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

-- Comment
COMMENT ON FUNCTION auto_close_expired_sessions() IS 'Closes queue sessions that have passed their end_time. Should be called periodically or before critical actions.';

-- ============================================================================
-- 2. CENTRALIZED JOIN QUEUE RPC
-- ============================================================================

-- RPC function to handle joining a queue safely
CREATE OR REPLACE FUNCTION join_queue(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_session record;
  v_participant record;
  v_existing_participant record;
  v_current_count int;
  v_cooldown_minutes int := 5;
  v_time_since_leave interval;
BEGIN
  -- 1. Run maintenance first (clean up stale sessions)
  PERFORM auto_close_expired_sessions();

  -- 2. Get Session Details & Lock Row (to prevent race conditions on max_players)
  SELECT * INTO v_session
  FROM queue_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Locks this session row until transaction commits

  -- 3. Basic Valdations
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue session not found');
  END IF;

  IF v_session.status NOT IN ('open', 'active') THEN
     RETURN jsonb_build_object('success', false, 'error', 'Queue is not accepting new players');
  END IF;
  
  -- 4. Check Capacity (The Critical Fix)
  -- Count active participants
  SELECT COUNT(*) INTO v_current_count
  FROM queue_participants
  WHERE queue_session_id = p_session_id
  AND left_at IS NULL
  AND status != 'left';
  
  IF v_current_count >= v_session.max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue is full');
  END IF;

  -- 5. Check for Existing Participation
  SELECT * INTO v_existing_participant
  FROM queue_participants
  WHERE queue_session_id = p_session_id
  AND user_id = p_user_id
  ORDER BY left_at DESC NULLS FIRST
  LIMIT 1;

  IF v_existing_participant IS NOT NULL THEN
    -- If currently in queue (not left)
    IF v_existing_participant.left_at IS NULL AND v_existing_participant.status != 'left' THEN
      RETURN jsonb_build_object('success', false, 'error', 'You are already in this queue');
    END IF;

    -- Check Cooldown
    v_time_since_leave := now() - v_existing_participant.left_at;
    IF v_time_since_leave < (v_cooldown_minutes || ' minutes')::interval THEN
       RETURN jsonb_build_object(
         'success', false, 
         'error', format('Please wait %s before rejoining', (v_cooldown_minutes || ' minutes')::interval - v_time_since_leave)
       );
    END IF;
    
    -- Reactivate
    UPDATE queue_participants
    SET 
      left_at = NULL,
      status = 'waiting',
      joined_at = now(),
      updated_at = now()
    WHERE id = v_existing_participant.id
    RETURNING * INTO v_participant;
    
    RETURN jsonb_build_object('success', true, 'participant_id', v_participant.id, 'action', 'reactivated');
  END IF;

  -- 6. Insert New Participant
  INSERT INTO queue_participants (
    queue_session_id,
    user_id,
    status,
    payment_status,
    amount_owed,
    games_played,
    games_won
  ) VALUES (
    p_session_id,
    p_user_id,
    'waiting',
    'unpaid',
    0,
    0,
    0
  )
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object('success', true, 'participant_id', v_participant.id, 'action', 'joined');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION join_queue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_close_expired_sessions() TO authenticated;

-- Comment
COMMENT ON FUNCTION join_queue(uuid, uuid) IS 'Safely joins a queue with race condition protection, capacity checks, and cooldown enforcement.';

