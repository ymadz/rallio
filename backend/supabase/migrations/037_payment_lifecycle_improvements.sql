-- =====================================================
-- Migration 037: Payment Lifecycle Improvements
-- Date: 2026-02-11
-- Description:
--   1. Add payment_method column to reservations (indexed)
--   2. Remove legacy 'pending' from status CHECK (keep 'paid' for audit)
--   3. Auto-expire stale pending_payment reservations (DB function)
--   4. Auto-complete past confirmed/ongoing reservations (DB function)
--   5. Auto-mark ongoing reservations (DB function)
--   6. Add cash_payment_deadline column for cash booking deadlines
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add payment_method column to reservations
-- =====================================================
-- Previously stored only in metadata.intended_payment_method (unindexed JSON).
-- This indexed column enables fast filtering: "show all cash bookings"

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_method varchar(20);

COMMENT ON COLUMN reservations.payment_method IS
  'Payment method: cash, e-wallet. Indexed for fast queries.';

-- Backfill from metadata for existing rows
UPDATE reservations
SET payment_method = metadata->>'intended_payment_method'
WHERE payment_method IS NULL
  AND metadata->>'intended_payment_method' IS NOT NULL;

-- Index for filtering by payment method
CREATE INDEX IF NOT EXISTS idx_reservations_payment_method
  ON reservations(payment_method)
  WHERE payment_method IS NOT NULL;

-- =====================================================
-- 2. Add cash_payment_deadline column
-- =====================================================
-- For cash bookings, this is the deadline by which payment must be received.
-- After this time, the reservation is auto-cancelled to free the slot.
-- Default: NULL (no deadline for e-wallet, e-wallet uses payment.expires_at)

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS cash_payment_deadline timestamptz;

COMMENT ON COLUMN reservations.cash_payment_deadline IS
  'Deadline for cash payment. If not paid by this time, reservation auto-cancels. Default: 2 hours before start_time.';

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_reservations_cash_deadline
  ON reservations(cash_payment_deadline)
  WHERE status = 'pending_payment' AND payment_method = 'cash' AND cash_payment_deadline IS NOT NULL;

-- =====================================================
-- 3. Update status CHECK — remove 'pending', add 'ongoing'
-- =====================================================
-- 'pending' was migrated to 'pending_payment' in migration 006.
-- Keep 'paid' in constraint for backward compat (webhook audit trail).

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (
    status IN (
      'pending_payment',
      'paid',
      'confirmed',
      'ongoing',
      'cancelled',
      'completed',
      'no_show',
      'pending_refund',
      'refunded'
    )
  );

-- Migrate any lingering 'pending' rows (safety net)
UPDATE reservations SET status = 'pending_payment' WHERE status = 'pending';

-- =====================================================
-- 4. Update overlap exclusion constraint (remove 'pending')
-- =====================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending_payment', 'paid', 'confirmed', 'ongoing'));

-- Update overlap trigger function to remove 'pending'
CREATE OR REPLACE FUNCTION validate_reservation_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
BEGIN
  -- Skip checks for inactive reservations
  IF NEW.status NOT IN ('pending_payment', 'paid', 'confirmed', 'ongoing') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO overlap_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND (NEW.id IS NULL OR id <> NEW.id)
    AND status IN ('pending_payment', 'paid', 'confirmed', 'ongoing')
    AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time);

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Reservation overlaps with existing booking'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

-- Refresh court_time_status index
DROP INDEX IF EXISTS idx_reservations_court_time_status;

CREATE INDEX idx_reservations_court_time_status
ON reservations (court_id, start_time, end_time, status)
WHERE status IN ('pending_payment', 'paid', 'confirmed', 'ongoing');

-- =====================================================
-- 5. Function: Expire stale pending_payment reservations
-- =====================================================
-- E-wallet: Cancel if pending_payment for > 20 minutes (payment source expires in 15 min)
-- Cash: Cancel if past cash_payment_deadline, OR if no deadline set and start_time has passed

CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS TABLE(cancelled_id uuid, reason text)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 5a. E-wallet reservations: expire after 20 minutes with no payment
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

  -- 5b. Cash reservations with explicit deadline: expire past deadline
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

  -- 5c. Cash reservations WITHOUT deadline: cancel if start_time has passed
  -- (Grace: cancel 30 minutes after start_time to allow late arrivals)
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

  -- 5d. Reservations with unknown/null payment method: expire after 24 hours
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

COMMENT ON FUNCTION expire_stale_reservations() IS
  'Cancels stale pending_payment reservations based on payment method and deadlines. Should be called periodically via pg_cron or edge function.';

-- =====================================================
-- 6. Function: Auto-transition confirmed → ongoing
-- =====================================================
-- Mark reservations as 'ongoing' when their start_time has arrived

CREATE OR REPLACE FUNCTION mark_ongoing_reservations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE reservations
  SET
    status = 'ongoing',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{marked_ongoing}',
      jsonb_build_object('at', now(), 'by', 'system')
    )
  WHERE status = 'confirmed'
    AND start_time <= now()
    AND end_time > now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Marked % reservations as ongoing', updated_count;
  END IF;

  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION mark_ongoing_reservations() IS
  'Marks confirmed reservations as ongoing when their start_time has arrived. Call periodically.';

-- =====================================================
-- 7. Function: Auto-complete past reservations
-- =====================================================
-- Mark ongoing/confirmed reservations as 'completed' after end_time

CREATE OR REPLACE FUNCTION auto_complete_reservations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  completed_count integer;
BEGIN
  UPDATE reservations
  SET
    status = 'completed',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_completed}',
      jsonb_build_object('at', now(), 'by', 'system')
    )
  WHERE status IN ('confirmed', 'ongoing')
    AND end_time < now();

  GET DIAGNOSTICS completed_count = ROW_COUNT;

  IF completed_count > 0 THEN
    RAISE NOTICE 'Auto-completed % past reservations', completed_count;
  END IF;

  RETURN completed_count;
END;
$$;

COMMENT ON FUNCTION auto_complete_reservations() IS
  'Marks past confirmed/ongoing reservations as completed after their end_time. Call periodically.';

-- =====================================================
-- 8. Combined maintenance function (single entry point)
-- =====================================================
-- Call this from pg_cron or edge function every few minutes

CREATE OR REPLACE FUNCTION run_reservation_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  expired_results RECORD;
  expired_count integer := 0;
  ongoing_count integer;
  completed_count integer;
  expired_details jsonb := '[]'::jsonb;
BEGIN
  -- 1. Expire stale reservations
  FOR expired_results IN SELECT * FROM expire_stale_reservations()
  LOOP
    expired_count := expired_count + 1;
    expired_details := expired_details || jsonb_build_object(
      'id', expired_results.cancelled_id,
      'reason', expired_results.reason
    );
  END LOOP;

  -- 2. Mark ongoing
  ongoing_count := mark_ongoing_reservations();

  -- 3. Auto-complete past
  completed_count := auto_complete_reservations();

  -- 4. Close expired queue sessions (from migration 035)
  PERFORM auto_close_expired_sessions();

  RETURN jsonb_build_object(
    'expired_reservations', expired_count,
    'marked_ongoing', ongoing_count,
    'auto_completed', completed_count,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION run_reservation_maintenance() IS
  'Combined maintenance: expires stale bookings, marks ongoing, auto-completes past sessions. Call via pg_cron every 5 minutes.';

-- =====================================================
-- 9. pg_cron schedule (if extension available)
-- =====================================================
-- This will only run if pg_cron is enabled on the Supabase project.
-- On free tier, pg_cron may not be available — in that case, use a
-- Supabase Edge Function with a cron trigger instead.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run maintenance every 5 minutes
    PERFORM cron.schedule(
      'reservation-maintenance',
      '*/5 * * * *',
      $sql$SELECT run_reservation_maintenance();$sql$
    );
    RAISE NOTICE 'pg_cron job scheduled: reservation-maintenance (every 5 min)';
  ELSE
    RAISE NOTICE 'pg_cron not available. Use Supabase Edge Function with cron trigger instead.';
    RAISE NOTICE 'Edge function should call: SELECT run_reservation_maintenance();';
  END IF;
END;
$$;

COMMIT;
