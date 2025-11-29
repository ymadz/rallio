-- ============================================================================
-- Diagnose and Fix Participant Count Issue
-- Run these queries one by one in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check current state
-- This shows the discrepancy between stored count and actual count
SELECT
  qs.id,
  qs.status,
  courts.name as court_name,
  qs.current_players as stored_count,
  (SELECT COUNT(*) 
   FROM queue_participants qp
   WHERE qp.queue_session_id = qs.id
   AND qp.left_at IS NULL
   AND qp.status != 'left') as actual_count
FROM queue_sessions qs
LEFT JOIN courts ON courts.id = qs.court_id
WHERE qs.status IN ('open', 'active', 'paused')
ORDER BY qs.created_at DESC;

-- Step 2: Fix all existing sessions
-- This updates the stored count to match actual participants
UPDATE queue_sessions
SET current_players = (
  SELECT COUNT(*)
  FROM queue_participants
  WHERE queue_participants.queue_session_id = queue_sessions.id
    AND queue_participants.left_at IS NULL
    AND queue_participants.status != 'left'
)
WHERE status IN ('draft', 'open', 'active', 'paused');

-- Step 3: Verify the trigger exists
-- Should return 1 row showing the trigger
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'update_queue_count';

-- Step 4: Verify the function exists
-- Should return the function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_queue_participant_count';

-- Step 5: Test the trigger manually
-- Insert a test participant to see if count updates
-- (Replace the UUIDs with actual values from your database)
-- DO $$
-- DECLARE
--   test_session_id uuid;
--   test_user_id uuid;
-- BEGIN
--   -- Get a test session and user
--   SELECT id INTO test_session_id FROM queue_sessions WHERE status = 'open' LIMIT 1;
--   SELECT id INTO test_user_id FROM profiles LIMIT 1;
--   
--   -- Check count before
--   RAISE NOTICE 'Before: %', (SELECT current_players FROM queue_sessions WHERE id = test_session_id);
--   
--   -- Insert participant
--   INSERT INTO queue_participants (queue_session_id, user_id, joined_at)
--   VALUES (test_session_id, test_user_id, NOW());
--   
--   -- Check count after
--   RAISE NOTICE 'After: %', (SELECT current_players FROM queue_sessions WHERE id = test_session_id);
--   
--   -- Cleanup
--   DELETE FROM queue_participants WHERE queue_session_id = test_session_id AND user_id = test_user_id;
-- END $$;
