-- Fix Queue Participant Count Logic
-- Issue: current_players shows 1/12 when there are actually 2 participants (1 waiting + 1 playing)
-- The count should include ALL active participants regardless of status (waiting, playing, completed)
-- Only exclude participants with status = 'left' or left_at IS NOT NULL

-- ============================================================================
-- Drop and Recreate Trigger with Fixed Logic
-- ============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS update_queue_count ON queue_participants;
DROP FUNCTION IF EXISTS update_queue_participant_count();

-- Recreate function with improved logic
CREATE OR REPLACE FUNCTION update_queue_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT: increment count
  IF TG_OP = 'INSERT' THEN
    UPDATE queue_sessions
    SET current_players = current_players + 1
    WHERE id = NEW.queue_session_id;
    RETURN NEW;

  -- For UPDATE: only decrement if status changed to 'left' or left_at was set
  ELSIF TG_OP = 'UPDATE' THEN
    -- Player left the queue (status changed to 'left' or left_at was set)
    IF (NEW.status = 'left' AND OLD.status != 'left')
       OR (NEW.left_at IS NOT NULL AND OLD.left_at IS NULL) THEN
      UPDATE queue_sessions
      SET current_players = GREATEST(0, current_players - 1)
      WHERE id = NEW.queue_session_id;
    END IF;
    RETURN NEW;

  -- For DELETE: decrement count
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE queue_sessions
    SET current_players = GREATEST(0, current_players - 1)
    WHERE id = OLD.queue_session_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER update_queue_count
AFTER INSERT OR UPDATE OR DELETE ON queue_participants
FOR EACH ROW EXECUTE FUNCTION update_queue_participant_count();

-- ============================================================================
-- Recalculate current_players for All Active Sessions
-- ============================================================================

-- This ensures all existing sessions have accurate counts
UPDATE queue_sessions
SET current_players = (
  SELECT COUNT(*)
  FROM queue_participants
  WHERE queue_participants.queue_session_id = queue_sessions.id
    AND queue_participants.left_at IS NULL
    AND queue_participants.status != 'left'
)
WHERE status IN ('draft', 'open', 'active', 'paused');

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify counts are correct:
-- SELECT
--   qs.id,
--   qs.current_players as stored_count,
--   (SELECT COUNT(*) FROM queue_participants qp
--    WHERE qp.queue_session_id = qs.id
--    AND qp.left_at IS NULL
--    AND qp.status != 'left') as actual_count
-- FROM queue_sessions qs
-- WHERE qs.status IN ('open', 'active');

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION update_queue_participant_count IS
  'Maintains current_players count for queue sessions. Increments on INSERT, decrements only when player leaves (status=left or left_at set), decrements on DELETE. Status changes like waiting→playing do NOT affect count.';
