-- Migration: Auto-close expired queue sessions
-- Description: Creates a PostgreSQL function to automatically close queue sessions
--              that have passed their end_time. This function can be called by:
--              1. Supabase Edge Function (scheduled)
--              2. External cron job
--              3. Manual execution
--
-- Status: Ready to apply
-- Dependencies: 001_initial_schema_v2.sql (queue_sessions, queue_participants tables)

-- =====================================================
-- FUNCTION: auto_close_expired_sessions
-- =====================================================
-- Purpose: Automatically close queue sessions that have passed their end_time
-- Returns: JSON object with count of closed sessions and details
-- Usage: SELECT auto_close_expired_sessions();

CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner privileges to bypass RLS
AS $$
DECLARE
  session_record RECORD;
  closed_count INTEGER := 0;
  failed_count INTEGER := 0;
  result jsonb;
  closed_sessions jsonb[] := '{}';

  -- Summary variables per session
  total_games INTEGER;
  total_revenue NUMERIC(12,2);
  total_participants INTEGER;
  unpaid_balances INTEGER;
  session_summary jsonb;
BEGIN
  -- Log function start
  RAISE NOTICE '[auto_close_expired_sessions] 🕒 Starting automatic session closure check at %', now();

  -- Find all sessions that should be closed
  -- Criteria: end_time has passed AND status is NOT already closed/cancelled
  FOR session_record IN
    SELECT
      id,
      court_id,
      organizer_id,
      start_time,
      end_time,
      status,
      mode,
      game_format,
      cost_per_game,
      current_players
    FROM queue_sessions
    WHERE end_time < now()
      AND status IN ('open', 'active', 'paused')
    ORDER BY end_time ASC
  LOOP
    BEGIN
      RAISE NOTICE '[auto_close_expired_sessions] 🔒 Closing session: % (ended at %)',
        session_record.id, session_record.end_time;

      -- Calculate session statistics from participants
      SELECT
        COALESCE(SUM(games_played), 0),
        COALESCE(SUM(amount_owed), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE payment_status != 'paid' AND amount_owed > 0)
      INTO
        total_games,
        total_revenue,
        total_participants,
        unpaid_balances
      FROM queue_participants
      WHERE queue_session_id = session_record.id;

      -- Build session summary
      session_summary := jsonb_build_object(
        'totalGames', total_games,
        'totalRevenue', total_revenue,
        'totalParticipants', total_participants,
        'unpaidBalances', unpaid_balances,
        'closedAt', now(),
        'closedBy', 'system',
        'closedReason', 'automatic_expiration'
      );

      -- Update session status to closed with summary in metadata
      UPDATE queue_sessions
      SET
        status = 'closed',
        settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('summary', session_summary),
        updated_at = now()
      WHERE id = session_record.id;

      -- Track this closed session
      closed_sessions := array_append(
        closed_sessions,
        jsonb_build_object(
          'sessionId', session_record.id,
          'courtId', session_record.court_id,
          'endTime', session_record.end_time,
          'summary', session_summary
        )
      );

      closed_count := closed_count + 1;

      RAISE NOTICE '[auto_close_expired_sessions] ✅ Session % closed successfully. Summary: %',
        session_record.id, session_summary;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other sessions
      failed_count := failed_count + 1;
      RAISE WARNING '[auto_close_expired_sessions] ❌ Failed to close session %: %',
        session_record.id, SQLERRM;
    END;
  END LOOP;

  -- Build result summary
  result := jsonb_build_object(
    'success', true,
    'processedAt', now(),
    'closedCount', closed_count,
    'failedCount', failed_count,
    'closedSessions', to_jsonb(closed_sessions)
  );

  RAISE NOTICE '[auto_close_expired_sessions] 🎯 Completed: % sessions closed, % failed',
    closed_count, failed_count;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (needed for Edge Function)
GRANT EXECUTE ON FUNCTION auto_close_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_close_expired_sessions() TO service_role;

COMMENT ON FUNCTION auto_close_expired_sessions() IS
'Automatically closes queue sessions that have passed their end_time. Returns summary of closed sessions.';

-- =====================================================
-- HELPER VIEW: Expired Sessions
-- =====================================================
-- Purpose: Easy way to check which sessions are expired but not closed
-- Usage: SELECT * FROM expired_queue_sessions;

CREATE OR REPLACE VIEW expired_queue_sessions AS
SELECT
  id,
  court_id,
  organizer_id,
  start_time,
  end_time,
  status,
  current_players,
  cost_per_game,
  (now() - end_time) as time_since_expiration
FROM queue_sessions
WHERE end_time < now()
  AND status IN ('open', 'active', 'paused')
ORDER BY end_time ASC;

COMMENT ON VIEW expired_queue_sessions IS
'Shows queue sessions that have expired but are not yet closed';

-- =====================================================
-- TEST FUNCTION: Create expired test session
-- =====================================================
-- Purpose: Helper function to create test sessions for testing auto-close
-- Usage: SELECT create_test_expired_session();
-- Note: Only use in development/testing

CREATE OR REPLACE FUNCTION create_test_expired_session(
  p_organizer_id uuid DEFAULT NULL,
  p_minutes_ago integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_organizer_id uuid;
  v_court_id uuid;
BEGIN
  -- Use provided organizer_id or try to find any profile
  IF p_organizer_id IS NOT NULL THEN
    v_organizer_id := p_organizer_id;
  ELSE
    SELECT id INTO v_organizer_id FROM profiles LIMIT 1;
  END IF;

  -- Get any court
  SELECT id INTO v_court_id FROM courts LIMIT 1;

  -- Create test session that ended N minutes ago
  INSERT INTO queue_sessions (
    court_id,
    organizer_id,
    start_time,
    end_time,
    mode,
    game_format,
    max_players,
    cost_per_game,
    is_public,
    status,
    settings
  ) VALUES (
    v_court_id,
    v_organizer_id,
    now() - interval '2 hours',
    now() - (p_minutes_ago || ' minutes')::interval,
    'casual',
    'doubles',
    12,
    50.00,
    true,
    'active', -- Active but expired
    '{"testSession": true}'::jsonb
  )
  RETURNING id INTO v_session_id;

  RAISE NOTICE '🧪 Test expired session created: % (expired % minutes ago)', v_session_id, p_minutes_ago;

  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION create_test_expired_session IS
'Creates a test session that has already expired. For testing purposes only.';

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- To rollback this migration:
-- DROP FUNCTION IF EXISTS auto_close_expired_sessions();
-- DROP VIEW IF EXISTS expired_queue_sessions;
-- DROP FUNCTION IF EXISTS create_test_expired_session(uuid, integer);
