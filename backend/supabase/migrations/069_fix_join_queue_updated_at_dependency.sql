-- Migration 069: Fix join_queue dependency on queue_participants.updated_at
-- Created: 2026-03-26
-- Purpose:
-- 1) Ensure queue_participants.updated_at exists in all environments.
-- 2) Make join_queue reactivation path resilient for databases that were missing the column.

-- Ensure updated_at exists and is usable.
ALTER TABLE public.queue_participants
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.queue_participants
SET updated_at = COALESCE(updated_at, joined_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.queue_participants
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.queue_participants
  ALTER COLUMN updated_at SET NOT NULL;

-- Maintain updated_at automatically on row updates.
CREATE OR REPLACE FUNCTION public.set_queue_participants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_queue_participants_updated_at ON public.queue_participants;

CREATE TRIGGER update_queue_participants_updated_at
  BEFORE UPDATE ON public.queue_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_queue_participants_updated_at();

-- Recreate join_queue with skill restrictions and cooldown,
-- but without hard dependency on setting updated_at explicitly.
CREATE OR REPLACE FUNCTION public.join_queue(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
  v_participant record;
  v_existing_participant record;
  v_user_skill_level smallint;
  v_current_count int;
  v_cooldown_minutes int := 1;
  v_time_since_leave interval;
BEGIN
  -- Run maintenance first.
  PERFORM public.auto_close_expired_sessions();

  -- Get and lock session row.
  SELECT * INTO v_session
  FROM public.queue_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue session not found');
  END IF;

  IF v_session.status NOT IN ('open', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue is not accepting new players');
  END IF;

  -- Skill restriction checks.
  SELECT skill_level INTO v_user_skill_level
  FROM public.players
  WHERE user_id = p_user_id;

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

  -- Capacity check.
  SELECT COUNT(*) INTO v_current_count
  FROM public.queue_participants
  WHERE queue_session_id = p_session_id
    AND left_at IS NULL
    AND status <> 'left';

  IF v_current_count >= v_session.max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue is full');
  END IF;

  -- Existing participant check (for rejoin path).
  SELECT * INTO v_existing_participant
  FROM public.queue_participants
  WHERE queue_session_id = p_session_id
    AND user_id = p_user_id
  ORDER BY left_at DESC NULLS FIRST
  LIMIT 1;

  IF v_existing_participant IS NOT NULL THEN
    IF v_existing_participant.left_at IS NULL AND v_existing_participant.status <> 'left' THEN
      RETURN jsonb_build_object('success', false, 'error', 'You are already in this queue');
    END IF;

    -- Cooldown check.
    v_time_since_leave := now() - v_existing_participant.left_at;
    IF v_time_since_leave < (v_cooldown_minutes || ' minutes')::interval THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Please wait %s before rejoining', (v_cooldown_minutes || ' minutes')::interval - v_time_since_leave)
      );
    END IF;

    -- Reactivate old participant record.
    UPDATE public.queue_participants
    SET
      left_at = NULL,
      status = 'waiting',
      joined_at = now()
    WHERE id = v_existing_participant.id
    RETURNING * INTO v_participant;

    RETURN jsonb_build_object('success', true, 'participant_id', v_participant.id, 'action', 'reactivated');
  END IF;

  -- First-time join.
  INSERT INTO public.queue_participants (
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
$$;

GRANT EXECUTE ON FUNCTION public.join_queue(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.join_queue(uuid, uuid)
IS 'Safely joins/rejoins queue with skill checks and cooldown; resilient to older queue_participants schemas.';
