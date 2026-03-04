-- =====================================================
-- Migration 054: Add 'pending_reschedule' booking status
-- Description: Adds 'pending_reschedule' to the reservation status check and updates conflict logic.
-- =====================================================

BEGIN;

-- 1. Update status CHECK constraint to include 'pending_reschedule'
-- Note: 'reserved' is also included to ensure compatibility with recent changes
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
CHECK (
  status IN (
    'pending_payment',
    'partially_paid',
    'confirmed',
    'ongoing',
    'reserved',
    'pending_reschedule',
    'cancelled',
    'completed',
    'no_show',
    'pending_refund',
    'refunded'
  )
);

-- 2. Update overlap exclusion constraint to include 'pending_reschedule' and 'reserved'
-- These statuses MUST hold the slot to prevent overbooking while awaiting approval or payment.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule'));

-- 3. Update overlap trigger function
CREATE OR REPLACE FUNCTION validate_reservation_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
BEGIN
  -- Skip checks for inactive reservations
  IF NEW.status NOT IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO overlap_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND (NEW.id IS NULL OR id <> NEW.id)
    AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule')
    AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time);

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Reservation overlaps with existing booking'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update queue→reservation conflict trigger
CREATE OR REPLACE FUNCTION prevent_queue_reservation_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Check if queue session conflicts with any active reservations
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule')
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
      AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule')
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

-- 5. Update reservation→queue conflict trigger
CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Only check for active/pending statuses
  IF NEW.status NOT IN ('pending', 'confirmed', 'pending_payment', 'partially_paid', 'reserved', 'pending_reschedule') THEN
    RETURN NEW;
  END IF;

  -- Check if reservation conflicts with any active queue sessions
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

-- 6. Update general index for availability checks
DROP INDEX IF EXISTS idx_reservations_court_time_status;

CREATE INDEX idx_reservations_court_time_status
ON reservations (court_id, start_time, end_time, status)
WHERE status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing', 'reserved', 'pending_reschedule');

COMMIT;
