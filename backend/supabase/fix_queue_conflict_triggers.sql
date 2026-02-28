-- Fix: Restore self-exclusion logic in queue conflict trigger functions
-- Migration 046 accidentally removed the self-exclusion logic from migrations 044/045

-- 1. Fix prevent_queue_reservation_conflicts: exclude queue session's own reservation
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
    AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    AND (metadata->>'is_queue_session_reservation' IS NULL 
         OR metadata->>'is_queue_session_reservation' != 'true');

  IF conflict_count > 0 THEN
    SELECT
      to_char(start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') || ' - ' || 
      to_char(end_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing')
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

-- 2. Fix prevent_reservation_queue_conflicts: exclude queue session that owns this reservation
CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed', 'pending_payment', 'partially_paid') THEN
    RETURN NEW;
  END IF;

  -- Check if reservation conflicts with any queue sessions
  -- EXCLUDE the queue session that THIS reservation belongs to
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
