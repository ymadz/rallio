-- ============================================================================
-- Migration 046: Add 'partially_paid' to reservation status constraint
-- Date: 2026-02-28
-- Description:
--   The down payment system for cash bookings sets reservation status to
--   'partially_paid' after an online deposit is received, but this status
--   was missing from the CHECK constraint (dropped in migration 043).
--   This migration re-adds it.
--
--   Also updates conflict-prevention triggers and the overlap exclusion
--   constraint to account for partially_paid reservations (they hold a slot).
-- ============================================================================

BEGIN;

-- 1. Update status CHECK constraint to include 'partially_paid'
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
CHECK (
  status IN (
    'pending_payment',
    'partially_paid',
    'confirmed',
    'ongoing',
    'cancelled',
    'completed',
    'no_show',
    'pending_refund',
    'refunded'
  )
);

-- 2. Update overlap exclusion constraint to include 'partially_paid'
--    A partially_paid reservation still holds the court slot.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing'));

-- 3. Update overlap trigger function to include 'partially_paid'
CREATE OR REPLACE FUNCTION validate_reservation_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
BEGIN
  -- Skip checks for inactive reservations
  IF NEW.status NOT IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO overlap_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND (NEW.id IS NULL OR id <> NEW.id)
    AND status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing')
    AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time);

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Reservation overlaps with existing booking'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update reservation-queue conflict trigger to include 'partially_paid'
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
    AND status IN ('pending_payment', 'partially_paid', 'confirmed')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    SELECT
      to_char(start_time, 'HH12:MI AM') || ' - ' || to_char(end_time, 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending_payment', 'partially_paid', 'confirmed')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    LIMIT 1;

    RAISE EXCEPTION 'Queue session conflicts with existing reservation (%). Court already booked during this time.', conflict_time
      USING ERRCODE = '23P01',
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update reservation-queue conflict trigger (reservation side)
CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  IF NEW.status NOT IN ('pending_payment', 'partially_paid', 'confirmed') THEN
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

-- 6. Update court_time_status index to include 'partially_paid'
DROP INDEX IF EXISTS idx_reservations_court_time_status;

CREATE INDEX idx_reservations_court_time_status
ON reservations (court_id, start_time, end_time, status)
WHERE status IN ('pending_payment', 'partially_paid', 'confirmed', 'ongoing');

-- 7. Update expire_stale_reservations to NOT expire partially_paid cash bookings
--    (they already paid a deposit, don't auto-cancel them)
CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS TABLE(cancelled_id uuid, reason text)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. E-wallet reservations: expire after 20 minutes with no payment
  RETURN QUERY
  UPDATE reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Payment expired - e-wallet payment not completed within time limit',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', 'e-wallet payment timeout',
        'expired_by', 'system'
      )
    )
  WHERE status = 'pending_payment'
    AND payment_method = 'e-wallet'
    AND created_at < (now() - interval '20 minutes')
  RETURNING id AS cancelled_id, 'e-wallet payment timeout' AS reason;

  -- 2. Cash reservations with explicit deadline: expire past deadline
  --    ONLY if still pending_payment (NOT partially_paid — they paid a deposit)
  RETURN QUERY
  UPDATE reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Cash payment deadline expired',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', 'cash payment deadline passed',
        'deadline', cash_payment_deadline,
        'expired_by', 'system'
      )
    )
  WHERE status = 'pending_payment'
    AND payment_method = 'cash'
    AND cash_payment_deadline IS NOT NULL
    AND cash_payment_deadline < now()
  RETURNING id AS cancelled_id, 'cash payment deadline passed' AS reason;

  -- 3. Cash reservations WITHOUT deadline: cancel if start_time has passed
  --    (Grace: 30 minutes after start_time)
  --    ONLY if still pending_payment (NOT partially_paid)
  RETURN QUERY
  UPDATE reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Cash payment not received - session start time passed',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', 'start time passed without payment',
        'expired_by', 'system'
      )
    )
  WHERE status = 'pending_payment'
    AND payment_method = 'cash'
    AND cash_payment_deadline IS NULL
    AND start_time < (now() - interval '30 minutes')
  RETURNING id AS cancelled_id, 'start time passed without cash payment' AS reason;

  -- 4. Reservations with unknown/null payment method: expire after 24 hours
  RETURN QUERY
  UPDATE reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Reservation expired - no payment activity',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', 'no payment method, stale reservation',
        'expired_by', 'system'
      )
    )
  WHERE status = 'pending_payment'
    AND payment_method IS NULL
    AND created_at < (now() - interval '24 hours')
  RETURNING id AS cancelled_id, 'stale reservation (no payment method)' AS reason;
END;
$$;

COMMIT;
