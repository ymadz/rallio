-- Migration 029: Fix queue session self-conflict bug
-- 
-- Problem: createQueueSession creates a reservation first, then when it tries to
-- create the queue session, the trigger sees that reservation as a conflict.
-- 
-- Solution: Update the trigger to exclude reservations that are marked as
-- queue session reservations (metadata->>'is_queue_session_reservation' = 'true')

-- Drop and recreate the function with the fix
CREATE OR REPLACE FUNCTION prevent_queue_reservation_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Check if queue session conflicts with any confirmed/pending reservations
  -- EXCLUDE reservations that are for queue sessions (they have metadata flag)
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND status IN ('pending', 'confirmed', 'pending_payment', 'paid')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    AND (metadata->>'is_queue_session_reservation' IS NULL 
         OR metadata->>'is_queue_session_reservation' != 'true');

  IF conflict_count > 0 THEN
    -- Get the conflicting time for better error message (with timezone)
    SELECT
      to_char(start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') || ' - ' || 
      to_char(end_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending', 'confirmed', 'pending_payment', 'paid')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
      AND (metadata->>'is_queue_session_reservation' IS NULL 
           OR metadata->>'is_queue_session_reservation' != 'true')
    LIMIT 1;

    RAISE EXCEPTION 'Queue session conflicts with existing reservation (%). Court already booked during this time.', conflict_time
      USING ERRCODE = '23P01',
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_queue_reservation_conflicts IS
  'Prevents queue sessions from conflicting with regular reservations. Excludes queue session reservations from conflict check.';
