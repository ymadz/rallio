-- ============================================================================
-- Migration 050: Update expire_stale_reservations to handle 'reserved' status
-- Date: 2026-03-04
-- Description:
--   Reserved bookings should expire after 24 hours if no payment is made.
-- ============================================================================

BEGIN;

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

  -- 4. Reservations with unknown/null payment method (including legacy pending_payment with no data)
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

  -- 5. Reserved reservations: expire after 24 hours
  RETURN QUERY
  UPDATE reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Reserved booking expired - 24 hour payment window elapsed',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', '24 hour payment window for reserved booking elapsed',
        'expired_by', 'system'
      )
    )
  WHERE status = 'reserved'
    AND created_at < (now() - interval '24 hours')
  RETURNING id AS cancelled_id, 'reserved booking expired' AS reason;
END;
$$;

COMMIT;
