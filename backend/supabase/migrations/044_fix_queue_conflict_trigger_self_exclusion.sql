-- Migration 044: Restore queue session self-conflict exclusion
-- 
-- Problem: Migration 043 accidentally removed the is_queue_session_reservation
-- exclusion from prevent_queue_reservation_conflicts(), originally added in
-- migration 029. This causes queue sessions to conflict with THEIR OWN
-- reservations (since createQueueSession creates a reservation first, then
-- the queue_session record).
--
-- Also restores AT TIME ZONE 'Asia/Manila' for proper error message formatting.

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
    AND status IN ('pending_payment', 'confirmed', 'ongoing')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    AND (metadata->>'is_queue_session_reservation' IS NULL 
         OR metadata->>'is_queue_session_reservation' != 'true');

  IF conflict_count > 0 THEN
    -- Get the conflicting time for better error message (with Manila timezone)
    SELECT
      to_char(start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') || ' - ' || 
      to_char(end_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending_payment', 'confirmed', 'ongoing')
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
  'Prevents queue sessions from conflicting with regular reservations. Excludes queue session reservations (own reservations) from conflict check.';
