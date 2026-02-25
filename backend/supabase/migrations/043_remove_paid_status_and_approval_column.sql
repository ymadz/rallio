-- Migration 043: Remove 'paid' from reservation status constraint, drop approval_status,
-- and fix conflict-prevention trigger functions that reference them.

-- ============================================================================
-- 1. Migrate existing 'paid' reservations to 'confirmed'
-- ============================================================================
UPDATE reservations SET status = 'confirmed' WHERE status = 'paid';

-- ============================================================================
-- 2. Drop old constraint, re-create without 'paid'
-- ============================================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
CHECK (
  status IN (
    'pending_payment',
    'confirmed',
    'ongoing',
    'cancelled',
    'completed',
    'no_show',
    'pending_refund',
    'refunded'
  )
);

-- ============================================================================
-- 3. Drop approval_status column from queue_sessions
-- ============================================================================
ALTER TABLE queue_sessions DROP COLUMN IF EXISTS approval_status;

-- ============================================================================
-- 4. Recreate conflict prevention triggers (from migration 017)
--    These previously referenced approval_status and legacy statuses.
-- ============================================================================

-- 4a. Fix: prevent_queue_reservation_conflicts (queue_sessions trigger)
--     Removed 'paid' from reservation status check
CREATE OR REPLACE FUNCTION prevent_queue_reservation_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND status IN ('pending', 'confirmed', 'pending_payment')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    SELECT
      to_char(start_time, 'HH12:MI AM') || ' - ' || to_char(end_time, 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending', 'confirmed', 'pending_payment')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    LIMIT 1;

    RAISE EXCEPTION 'Queue session conflicts with existing reservation (%). Court already booked during this time.', conflict_time
      USING ERRCODE = '23P01',
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4b. Fix: prevent_reservation_queue_conflicts (reservations trigger)
--     Removed approval_status check, updated status list to current valid values
CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed', 'pending_payment') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO conflict_count
  FROM queue_sessions
  WHERE court_id = NEW.court_id
    AND status IN ('pending_payment', 'open', 'active')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    SELECT
      to_char(start_time, 'HH12:MI AM') || ' - ' || to_char(end_time, 'HH12:MI AM')
    INTO conflict_time
    FROM queue_sessions
    WHERE court_id = NEW.court_id
      AND status IN ('pending_payment', 'open', 'active')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    LIMIT 1;

    RAISE EXCEPTION 'Reservation conflicts with existing queue session (%). Time slot reserved for queue.', conflict_time
      USING ERRCODE = '23P01',
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
