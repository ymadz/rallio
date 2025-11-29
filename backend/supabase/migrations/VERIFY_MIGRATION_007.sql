-- Verification Script for Migration 007: Auto-Close Expired Sessions
-- Run this script AFTER applying 007_auto_close_expired_sessions.sql

\echo '================================'
\echo 'Verification: Migration 007'
\echo 'Auto-Close Expired Sessions'
\echo '================================'
\echo ''

-- =====================================================
-- 1. Verify function exists
-- =====================================================
\echo '1. Checking if auto_close_expired_sessions function exists...'
SELECT
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'auto_close_expired_sessions';

\echo '   Expected: 1 row with return_type = jsonb'
\echo ''

-- =====================================================
-- 2. Verify view exists
-- =====================================================
\echo '2. Checking if expired_queue_sessions view exists...'
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname = 'expired_queue_sessions';

\echo '   Expected: 1 row'
\echo ''

-- =====================================================
-- 3. Verify test function exists
-- =====================================================
\echo '3. Checking if create_test_expired_session function exists...'
SELECT
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'create_test_expired_session';

\echo '   Expected: 1 row with return_type = uuid'
\echo ''

-- =====================================================
-- 4. Check function permissions
-- =====================================================
\echo '4. Checking function permissions...'
SELECT
  proname as function_name,
  proacl as permissions
FROM pg_proc
WHERE proname IN ('auto_close_expired_sessions', 'create_test_expired_session');

\echo '   Expected: Permissions granted to authenticated and service_role'
\echo ''

-- =====================================================
-- 5. Test: Create expired session
-- =====================================================
\echo '5. Creating test expired session...'
SELECT create_test_expired_session();

\echo '   Expected: Returns UUID of created session'
\echo ''

-- =====================================================
-- 6. Verify expired session appears in view
-- =====================================================
\echo '6. Checking expired_queue_sessions view...'
SELECT
  id,
  status,
  end_time,
  time_since_expiration,
  settings->'testSession' as is_test
FROM expired_queue_sessions
WHERE settings->>'testSession' = 'true'
ORDER BY end_time DESC
LIMIT 5;

\echo '   Expected: At least 1 row showing the test session'
\echo ''

-- =====================================================
-- 7. Test: Run auto-close function
-- =====================================================
\echo '7. Running auto_close_expired_sessions()...'
SELECT
  (result->>'success')::boolean as success,
  (result->>'closedCount')::int as closed_count,
  (result->>'failedCount')::int as failed_count,
  result->>'processedAt' as processed_at
FROM (
  SELECT auto_close_expired_sessions() as result
) sub;

\echo '   Expected: success = true, closedCount >= 1, failedCount = 0'
\echo ''

-- =====================================================
-- 8. Verify test session was closed
-- =====================================================
\echo '8. Verifying test session was closed...'
SELECT
  id,
  status,
  end_time,
  updated_at,
  settings->'summary'->>'closedBy' as closed_by,
  settings->'summary'->>'closedReason' as closed_reason,
  settings->'summary'->>'totalGames' as total_games,
  settings->'summary'->>'totalParticipants' as total_participants
FROM queue_sessions
WHERE settings->>'testSession' = 'true'
  AND status = 'closed'
ORDER BY updated_at DESC
LIMIT 5;

\echo '   Expected: status = closed, closedBy = system, closedReason = automatic_expiration'
\echo ''

-- =====================================================
-- 9. Check expired sessions view is now empty (for test sessions)
-- =====================================================
\echo '9. Verifying no more expired test sessions...'
SELECT COUNT(*) as remaining_expired_test_sessions
FROM expired_queue_sessions
WHERE settings->>'testSession' = 'true';

\echo '   Expected: 0 (all test sessions should be closed)'
\echo ''

-- =====================================================
-- 10. Summary
-- =====================================================
\echo '================================'
\echo 'Verification Complete'
\echo '================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Deploy Edge Function: supabase functions deploy auto-close-sessions'
\echo '2. Test Edge Function: supabase functions invoke auto-close-sessions --method POST'
\echo '3. Set up cron schedule (see README.md)'
\echo '4. Clean up test sessions:'
\echo '   DELETE FROM queue_sessions WHERE settings->>''testSession'' = ''true'';'
\echo ''

-- =====================================================
-- Cleanup (optional)
-- =====================================================
\echo 'To clean up test sessions, run:'
\echo 'DELETE FROM queue_sessions WHERE settings->>''testSession'' = ''true'';'
\echo ''
