-- ============================================================================
-- Migration 065: Booking Lifecycle & Expiry
-- Date: 2026-03-17
-- Description:
--   - Adds a function to automatically sync booking status based on its items.
--   - Adds a function to expire stale bookings.
-- ============================================================================

BEGIN;

-- 1. Function to sync booking status from its reservations
CREATE OR REPLACE FUNCTION sync_booking_status()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_id uuid;
  v_all_confirmed boolean;
  v_all_cancelled boolean;
  v_any_ongoing boolean;
  v_any_completed boolean;
BEGIN
  -- Get the booking_id from the affected reservation
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
  
  IF v_booking_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check status of all reservations in this booking
  SELECT 
    bool_and(status IN ('confirmed', 'partially_paid', 'ongoing', 'completed')),
    bool_and(status = 'cancelled'),
    bool_or(status = 'ongoing'),
    bool_or(status = 'completed')
  INTO 
    v_all_confirmed,
    v_all_cancelled,
    v_any_ongoing,
    v_any_completed
  FROM reservations
  WHERE booking_id = v_booking_id;

  -- Update booking status
  IF v_all_cancelled THEN
    UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = v_booking_id AND status != 'cancelled';
  ELSIF v_any_ongoing THEN
    UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE id = v_booking_id AND status != 'confirmed';
  ELSIF v_any_completed AND v_all_confirmed THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = v_booking_id AND status != 'completed';
  ELSIF v_all_confirmed THEN
    UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE id = v_booking_id AND status != 'confirmed';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger on reservations to sync booking status
DROP TRIGGER IF EXISTS tr_sync_booking_status ON reservations;
CREATE TRIGGER tr_sync_booking_status
AFTER UPDATE OF status ON reservations
FOR EACH ROW
EXECUTE FUNCTION sync_booking_status();

-- 3. Function to expire stale bookings
-- This should be called by the system periodically
CREATE OR REPLACE FUNCTION expire_stale_bookings()
RETURNS TABLE(cancelled_booking_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  -- A booking is stale if it's 'pending' and has no non-cancelled reservations
  -- OR if it's 'unpaid' and 'pending' for more than 30 minutes (grace period for payment)
  
  RETURN QUERY
  UPDATE bookings b
  SET 
    status = 'cancelled',
    updated_at = now(),
    metadata = jsonb_set(
      COALESCE(b.metadata, '{}'::jsonb),
      '{auto_expired}',
      jsonb_build_object(
        'expired_at', now(),
        'reason', 'stale booking or all reservations cancelled'
      )
    )
  WHERE b.status = 'pending'
    AND (
      -- Case 1: All reservations are already cancelled/expired
      (
        EXISTS (SELECT 1 FROM reservations r WHERE r.booking_id = b.id)
        AND NOT EXISTS (
          SELECT 1 FROM reservations r 
          WHERE r.booking_id = b.id 
          AND r.status NOT IN ('cancelled', 'expired')
        )
      )
      OR
      -- Case 2: Stale pending booking (no payment activity for 30 mins)
      (
        b.payment_status = 'unpaid'
        AND b.created_at < (now() - interval '30 minutes')
      )
    )
    AND b.status != 'cancelled'
  RETURNING b.id;
END;
$$;

COMMIT;
