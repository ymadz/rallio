-- Migration 017: Queue-Reservation Conflict Prevention
-- Created: December 1, 2025
-- Purpose: Prevent double booking between queue sessions and regular reservations
-- Implements database-level validation triggers as defense-in-depth protection

-- ============================================================================
-- PART 1: Prevent Queue Sessions from Conflicting with Reservations
-- ============================================================================

-- Function to check if a queue session conflicts with existing reservations
CREATE OR REPLACE FUNCTION prevent_queue_reservation_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Check if queue session conflicts with any confirmed/pending reservations
  -- Uses PostgreSQL's OVERLAPS operator for time range comparison
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations
  WHERE court_id = NEW.court_id
    AND status IN ('pending', 'confirmed', 'pending_payment', 'paid')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    -- Get the conflicting time for better error message
    SELECT
      to_char(start_time, 'HH12:MI AM') || ' - ' || to_char(end_time, 'HH12:MI AM')
    INTO conflict_time
    FROM reservations
    WHERE court_id = NEW.court_id
      AND status IN ('pending', 'confirmed', 'pending_payment', 'paid')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    LIMIT 1;

    RAISE EXCEPTION 'Queue session conflicts with existing reservation (%). Court already booked during this time.', conflict_time
      USING ERRCODE = '23P01', -- exclusion_violation (same as double booking constraint)
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on queue session INSERT and UPDATE
CREATE TRIGGER trigger_prevent_queue_reservation_conflicts
  BEFORE INSERT OR UPDATE OF court_id, start_time, end_time
  ON queue_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_queue_reservation_conflicts();

COMMENT ON FUNCTION prevent_queue_reservation_conflicts IS
  'Prevents queue sessions from being created during times when court has confirmed reservations. Part of defense-in-depth double booking prevention.';

-- ============================================================================
-- PART 2: Prevent Reservations from Conflicting with Queue Sessions
-- ============================================================================

-- Function to check if a reservation conflicts with existing queue sessions
CREATE OR REPLACE FUNCTION prevent_reservation_queue_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflict_time TEXT;
BEGIN
  -- Only check for conflicts if reservation is being confirmed or pending payment
  -- Cancelled or expired reservations don't need validation
  IF NEW.status NOT IN ('pending', 'confirmed', 'pending_payment', 'paid') THEN
    RETURN NEW;
  END IF;

  -- Check if reservation conflicts with any active/approved queue sessions
  SELECT COUNT(*)
  INTO conflict_count
  FROM queue_sessions
  WHERE court_id = NEW.court_id
    AND status IN ('draft', 'active', 'pending_approval')
    AND approval_status IN ('pending', 'approved')
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    -- Get the conflicting time for better error message
    SELECT
      to_char(start_time, 'HH12:MI AM') || ' - ' || to_char(end_time, 'HH12:MI AM')
    INTO conflict_time
    FROM queue_sessions
    WHERE court_id = NEW.court_id
      AND status IN ('draft', 'active', 'pending_approval')
      AND approval_status IN ('pending', 'approved')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    LIMIT 1;

    RAISE EXCEPTION 'Reservation conflicts with existing queue session (%). Time slot reserved for queue.', conflict_time
      USING ERRCODE = '23P01', -- exclusion_violation (same as double booking constraint)
            HINT = 'Choose a different time slot or contact the venue admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on reservation INSERT and UPDATE
CREATE TRIGGER trigger_prevent_reservation_queue_conflicts
  BEFORE INSERT OR UPDATE OF court_id, start_time, end_time, status
  ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_reservation_queue_conflicts();

COMMENT ON FUNCTION prevent_reservation_queue_conflicts IS
  'Prevents reservations from being created during times when court has active queue sessions. Part of defense-in-depth double booking prevention.';

-- ============================================================================
-- TESTING QUERIES (Run these to verify the triggers work)
-- ============================================================================

/*
-- Test 1: Create a reservation, then try to create a conflicting queue session
-- Expected: Queue creation should FAIL with exclusion_violation error

-- First, create a test reservation (replace UUIDs with actual values from your database)
INSERT INTO reservations (
  court_id,
  user_id,
  start_time,
  end_time,
  status,
  total_amount,
  payment_status
) VALUES (
  'your-court-uuid-here',
  'your-user-uuid-here',
  '2025-12-02 14:00:00+08',  -- 2 PM
  '2025-12-02 16:00:00+08',  -- 4 PM
  'confirmed',
  500.00,
  'paid'
);

-- Now try to create a conflicting queue session (should FAIL)
INSERT INTO queue_sessions (
  court_id,
  organizer_id,
  start_time,
  end_time,
  mode,
  game_format,
  status,
  approval_status
) VALUES (
  'your-court-uuid-here',  -- Same court
  'your-organizer-uuid-here',
  '2025-12-02 15:00:00+08',  -- Overlaps: 3 PM
  '2025-12-02 17:00:00+08',  -- Overlaps: 5 PM
  'open',
  'doubles',
  'active',
  'approved'
);
-- Expected: ERROR: Queue session conflicts with existing reservation (02:00 PM - 04:00 PM). Court already booked during this time.

-- ============================================================================

-- Test 2: Create a queue session, then try to create a conflicting reservation
-- Expected: Reservation creation should FAIL with exclusion_violation error

-- First, create a test queue session
INSERT INTO queue_sessions (
  court_id,
  organizer_id,
  start_time,
  end_time,
  mode,
  game_format,
  status,
  approval_status
) VALUES (
  'your-court-uuid-here',
  'your-organizer-uuid-here',
  '2025-12-02 18:00:00+08',  -- 6 PM
  '2025-12-02 20:00:00+08',  -- 8 PM
  'open',
  'doubles',
  'active',
  'approved'
);

-- Now try to create a conflicting reservation (should FAIL)
INSERT INTO reservations (
  court_id,
  user_id,
  start_time,
  end_time,
  status,
  total_amount,
  payment_status
) VALUES (
  'your-court-uuid-here',  -- Same court
  'your-user-uuid-here',
  '2025-12-02 19:00:00+08',  -- Overlaps: 7 PM
  '2025-12-02 21:00:00+08',  -- Overlaps: 9 PM
  'confirmed',
  500.00,
  'paid'
);
-- Expected: ERROR: Reservation conflicts with existing queue session (06:00 PM - 08:00 PM). Time slot reserved for queue.

-- ============================================================================

-- Test 3: Non-overlapping times should succeed
-- Both of these should succeed:

INSERT INTO queue_sessions (
  court_id,
  organizer_id,
  start_time,
  end_time,
  mode,
  game_format,
  status,
  approval_status
) VALUES (
  'your-court-uuid-here',
  'your-organizer-uuid-here',
  '2025-12-02 08:00:00+08',  -- 8 AM
  '2025-12-02 10:00:00+08',  -- 10 AM
  'open',
  'doubles',
  'active',
  'approved'
);

INSERT INTO reservations (
  court_id,
  user_id,
  start_time,
  end_time,
  status,
  total_amount,
  payment_status
) VALUES (
  'your-court-uuid-here',
  'your-user-uuid-here',
  '2025-12-02 10:00:00+08',  -- 10 AM (right after queue ends)
  '2025-12-02 12:00:00+08',  -- 12 PM
  'confirmed',
  500.00,
  'paid'
);
-- Expected: Both should succeed (no overlap)

*/

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

/*
-- To remove these triggers and functions, run:

DROP TRIGGER IF EXISTS trigger_prevent_queue_reservation_conflicts ON queue_sessions;
DROP TRIGGER IF EXISTS trigger_prevent_reservation_queue_conflicts ON reservations;
DROP FUNCTION IF EXISTS prevent_queue_reservation_conflicts();
DROP FUNCTION IF EXISTS prevent_reservation_queue_conflicts();

*/
