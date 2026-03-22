-- Migration 068: Add Skill Level Restrictions to Queue Sessions
-- Created: 2026-03-23
-- Purpose: Allow Queue Masters to restrict sessions to specific skill level ranges.

-- 1. Add skill restriction columns to queue_sessions
ALTER TABLE queue_sessions 
ADD COLUMN min_skill_level smallint CHECK (min_skill_level BETWEEN 1 AND 10),
ADD COLUMN max_skill_level smallint CHECK (max_skill_level BETWEEN 1 AND 10);

-- 2. Update join_queue RPC to enforce restrictions
CREATE OR REPLACE FUNCTION join_queue(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_session record;
  v_participant record;
  v_existing_participant record;
  v_user_skill_level smallint;
  v_current_count int;
  v_cooldown_minutes int := 5;
  v_time_since_leave interval;
BEGIN
  -- 1. Run maintenance first (clean up stale sessions)
  PERFORM auto_close_expired_sessions();

  -- 2. Get Session Details & Lock Row
  SELECT * INTO v_session
  FROM queue_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  -- 3. Basic Validations
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue session not found');
  END IF;

  IF v_session.status NOT IN ('open', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue is not accepting new players');
  END IF;

  -- 4. Skill Level Validation (NEW)
  -- Get user's skill level from players table
  SELECT skill_level INTO v_user_skill_level
  FROM players
  WHERE user_id = p_user_id;

  -- Check if session has restrictions and user doesn't meet them
  IF v_session.min_skill_level IS NOT NULL THEN
    IF v_user_skill_level IS NULL OR v_user_skill_level < v_session.min_skill_level THEN
      RETURN jsonb_build_object('success', false, 'error', 'Your skill level is below the required minimum for this session');
    END IF;
  END IF;

  IF v_session.max_skill_level IS NOT NULL THEN
    IF v_user_skill_level IS NULL OR v_user_skill_level > v_session.max_skill_level THEN
      RETURN jsonb_build_object('success', false, 'error', 'Your skill level exceeds the maximum allowed for this session');
    END IF;
  END IF;
  
  -- 5. Check Capacity
  SELECT COUNT(*) INTO v_current_count
  FROM queue_participants
  WHERE queue_session_id = p_session_id
  AND left_at IS NULL
  AND status != 'left';
  
  IF v_current_count >= v_session.max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue is full');
  END IF;

  -- 6. Check for Existing Participation
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

  -- 7. Insert New Participant
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
