-- Migration 045: Fix reservation→queue conflict trigger self-exclusion
--
-- Problem: prevent_reservation_queue_conflicts() (from migration 043) blocks
-- queue session reservations from being confirmed because it detects a conflict
-- with the queue session that OWNS the reservation. When the payment processor
-- updates the reservation status to 'confirmed', the trigger fires, finds the
-- overlapping queue session (which is linked via metadata->>'reservation_id'),
-- and raises an exception.
--
-- Fix: Exclude queue sessions whose metadata->>'reservation_id' matches the
-- current reservation's ID. This allows the queue session's own reservation
-- to be confirmed without triggering a false conflict.

CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Only check for active/pending statuses
  IF NEW.status NOT IN ('pending', 'confirmed', 'pending_payment') THEN
    RETURN NEW;
  END IF;

  -- Check if reservation conflicts with any queue sessions
  -- EXCLUDE the queue session that THIS reservation belongs to
  -- (identified by metadata->>'reservation_id' matching this reservation's ID)
  SELECT COUNT(*)
  INTO conflict_count
  FROM queue_sessions
  WHERE court_id = NEW.court_id
    AND status IN ('pending_payment', 'open', 'active')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    AND (metadata->>'reservation_id' IS NULL 
         OR metadata->>'reservation_id' != NEW.id::text);

  IF conflict_count > 0 THEN
    SELECT
      to_char(start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') || ' - ' || 
      to_char(end_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')
    INTO conflict_time
    FROM queue_sessions
    WHERE court_id = NEW.court_id
      AND status IN ('pending_payment', 'open', 'active')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
      AND (metadata->>'reservation_id' IS NULL 
           OR metadata->>'reservation_id' != NEW.id::text)
    LIMIT 1;

    RAISE EXCEPTION 'Reservation conflicts with existing queue session (%). Time slot reserved for queue.', conflict_time
      USING ERRCODE = '23P01',
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_reservation_queue_conflicts IS
  'Prevents reservations from conflicting with queue sessions. Excludes the queue session linked to this reservation (self-exclusion) to allow payment confirmation.';
