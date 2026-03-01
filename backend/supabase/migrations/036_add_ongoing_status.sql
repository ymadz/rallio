-- =====================================================
-- Migration 036: Add 'ongoing' booking status
-- Description: Adds 'ongoing' to the reservation status enum and updates constraints.
-- =====================================================

BEGIN;

-- 1. Drop existing constraints
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

-- 2. Update status check to include 'ongoing'
ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (
    status IN (
      'pending_payment',
      'pending',
      'paid',
      'confirmed',
      'ongoing',
      'cancelled',
      'completed',
      'no_show'
    )
  );

-- 3. Re-add exclusion constraint including 'ongoing'
ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending_payment', 'pending', 'paid', 'confirmed', 'ongoing'));

COMMENT ON CONSTRAINT no_overlapping_reservations ON reservations IS
  'Prevents overlapping reservations for the same court while active, awaiting payment, or ongoing.';

-- 4. Update index for conflict checks
DROP INDEX IF EXISTS idx_reservations_court_time_status;

CREATE INDEX idx_reservations_court_time_status
ON reservations (court_id, start_time, end_time, status)
WHERE status IN ('pending_payment', 'pending', 'paid', 'confirmed', 'ongoing');

COMMIT;
