-- ============================================================================
-- Migration 051: Auto-cancel overlapped 'reserved' reservations
-- Date: 2026-03-04
-- Description:
--   When a reservation is PAID FOR (confirmed/partially_paid/ongoing),
--   auto-cancel any overlapping reservations with 'reserved' status.
--   
--   IMPORTANT: Does NOT fire on 'pending_payment' — another user merely
--   starting checkout should NOT cancel an existing reservation.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION cancel_overlapped_reserved_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- ONLY fire when a reservation becomes PAID (confirmed, partially_paid, ongoing)
  -- NOT on pending_payment — someone entering checkout doesn't mean they paid
  IF NEW.status IN ('confirmed', 'ongoing', 'partially_paid') THEN
    
    -- Cancel any *other* reservation that is in the 'reserved' state and overlaps
    UPDATE reservations
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Slot was booked and paid for by another user',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{auto_cancelled}',
          jsonb_build_object(
            'cancelled_at', now(),
            'reason', 'Overlapped by a paid booking',
            'cancelled_by', 'system'
          )
        )
    WHERE court_id = NEW.court_id
      AND id != NEW.id
      AND status = 'reserved'
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_overlapped_reserved_bookings ON reservations;

CREATE TRIGGER trg_cancel_overlapped_reserved_bookings
AFTER INSERT OR UPDATE OF status, start_time, end_time ON reservations
FOR EACH ROW
EXECUTE FUNCTION cancel_overlapped_reserved_bookings();

COMMIT;
