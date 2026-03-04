-- ============================================================================
-- Migration 052: Include partially_paid in overlap auto-cancel
-- Date: 2026-03-04
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION cancel_overlapped_reserved_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire logic if the reservation is actually holding the slot firmly 
  -- (e.g., they paid in full 'confirmed', or they paid a deposit 'partially_paid', or game is 'ongoing')
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
            'reason', 'Overlapped by an active booking',
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

COMMIT;
