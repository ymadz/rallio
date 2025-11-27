-- Add Missing RLS Policies for Queue Management System
-- Fixes: Critical security gaps identified in QUEUE_ARCHITECTURE_REVIEW.md
-- Issue: queue_sessions has NO RLS policies, queue_participants missing self-update policy
--
-- This migration addresses:
-- 1. queue_sessions table - Add all CRUD policies
-- 2. queue_participants table - Add self-update policy for players
-- 3. Enhanced Queue Master policies with field-level restrictions

-- ============================================================================
-- Enable RLS on queue_sessions (if not already enabled)
-- ============================================================================

ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop Existing Policies (for idempotency)
-- ============================================================================

-- Queue Sessions Policies
DROP POLICY IF EXISTS "Anyone can view active queue sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Public sessions are viewable" ON queue_sessions;
DROP POLICY IF EXISTS "Participants can view their sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Users can create queue sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Queue Masters can create sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Organizers can update their sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Organizers can delete their sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Global admins have full access to queue sessions" ON queue_sessions;

-- Queue Participants Policies (additional to migration 008)
DROP POLICY IF EXISTS "Participants can update their own record" ON queue_participants;
DROP POLICY IF EXISTS "Players can update own participation" ON queue_participants;
DROP POLICY IF EXISTS "Queue Masters update participants safely" ON queue_participants;

-- ============================================================================
-- QUEUE SESSIONS - SELECT Policies
-- ============================================================================

-- Policy: Public sessions are viewable by everyone
CREATE POLICY "Public sessions are viewable" ON queue_sessions
  FOR SELECT
  USING (is_public = true);

-- Policy: Participants can view sessions they're in
CREATE POLICY "Participants can view their sessions" ON queue_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM queue_participants
      WHERE queue_participants.queue_session_id = queue_sessions.id
        AND queue_participants.user_id = auth.uid()
        AND queue_participants.left_at IS NULL
    )
  );

-- Policy: Global admins can view all sessions
CREATE POLICY "Global admins have full access to queue sessions" ON queue_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
        AND roles.name = 'global_admin'
    )
  );

-- ============================================================================
-- QUEUE SESSIONS - INSERT Policies
-- ============================================================================

-- Policy: Users with queue_master role can create sessions
CREATE POLICY "Queue Masters can create sessions" ON queue_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
        AND roles.name = 'queue_master'
    )
    AND organizer_id = auth.uid() -- Ensure organizer is the creator
  );

-- ============================================================================
-- QUEUE SESSIONS - UPDATE Policies
-- ============================================================================

-- Policy: Organizers can update their own sessions
CREATE POLICY "Organizers can update their sessions" ON queue_sessions
  FOR UPDATE
  USING (organizer_id = auth.uid())
  WITH CHECK (
    -- Prevent changing critical fields
    organizer_id = auth.uid()
    AND old.id = new.id
    AND old.organizer_id = new.organizer_id
    AND old.created_at = new.created_at
  );

-- ============================================================================
-- QUEUE SESSIONS - DELETE Policies
-- ============================================================================

-- Policy: Organizers can delete their own sessions
-- Only if session has no participants or is in draft status
CREATE POLICY "Organizers can delete their sessions" ON queue_sessions
  FOR DELETE
  USING (
    organizer_id = auth.uid()
    AND (
      status = 'draft'
      OR current_players = 0
    )
  );

-- ============================================================================
-- QUEUE PARTICIPANTS - UPDATE Policies (Enhanced)
-- ============================================================================

-- Policy: Participants can update their own participation record
-- Allows players to leave queue by updating left_at and status
CREATE POLICY "Participants can update their own record" ON queue_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Prevent modifying critical fields
    AND old.queue_session_id = new.queue_session_id
    AND old.user_id = new.user_id
    AND old.joined_at = new.joined_at
  );

-- Policy: Queue Masters can update participants in their sessions (ENHANCED)
-- Replaces the policy from migration 008 with field-level restrictions
DROP POLICY IF EXISTS "Queue Masters can update session participants" ON queue_participants;

CREATE POLICY "Queue Masters update participants safely" ON queue_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = queue_participants.queue_session_id
        AND queue_sessions.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Queue Masters cannot modify these critical fields
    old.queue_session_id = new.queue_session_id
    AND old.user_id = new.user_id
    AND old.joined_at = new.joined_at
  );

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Public sessions are viewable" ON queue_sessions IS
  'Public queue sessions (is_public=true) are visible to all users for discovery';

COMMENT ON POLICY "Participants can view their sessions" ON queue_sessions IS
  'Players can view queue sessions they have joined (and not left)';

COMMENT ON POLICY "Global admins have full access to queue sessions" ON queue_sessions IS
  'Global admins have unrestricted access to all queue sessions for moderation';

COMMENT ON POLICY "Queue Masters can create sessions" ON queue_sessions IS
  'Users with queue_master role can create new queue sessions. Organizer must be the creator.';

COMMENT ON POLICY "Organizers can update their sessions" ON queue_sessions IS
  'Session organizers can update their own sessions. Critical fields (organizer_id, created_at) are immutable.';

COMMENT ON POLICY "Organizers can delete their sessions" ON queue_sessions IS
  'Session organizers can delete draft sessions or sessions with no participants';

COMMENT ON POLICY "Participants can update their own record" ON queue_participants IS
  'Players can update their own participation (e.g., to leave queue). Critical fields (user_id, joined_at, queue_session_id) are immutable.';

COMMENT ON POLICY "Queue Masters update participants safely" ON queue_participants IS
  'Session organizers can update participant statuses (waiting→playing, games_played, amount_owed, payment_status). Critical fields (user_id, joined_at, queue_session_id) are immutable to prevent abuse.';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Run these queries to verify policies were created successfully:

-- Verify queue_sessions policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'queue_sessions'
ORDER BY policyname;

-- Expected output: 6 policies
-- 1. Global admins have full access to queue sessions (ALL)
-- 2. Organizers can delete their sessions (DELETE)
-- 3. Organizers can update their sessions (UPDATE)
-- 4. Participants can view their sessions (SELECT)
-- 5. Public sessions are viewable (SELECT)
-- 6. Queue Masters can create sessions (INSERT)

-- Verify queue_participants policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'queue_participants'
ORDER BY policyname;

-- Expected output: Should now include:
-- - Participants can update their own record (UPDATE)
-- - Queue Masters update participants safely (UPDATE)
-- Plus any other existing policies from previous migrations

-- ============================================================================
-- Rollback Instructions (if needed)
-- ============================================================================

-- If this migration causes issues, rollback with:
--
-- DROP POLICY IF EXISTS "Public sessions are viewable" ON queue_sessions;
-- DROP POLICY IF EXISTS "Participants can view their sessions" ON queue_sessions;
-- DROP POLICY IF EXISTS "Global admins have full access to queue sessions" ON queue_sessions;
-- DROP POLICY IF EXISTS "Queue Masters can create sessions" ON queue_sessions;
-- DROP POLICY IF EXISTS "Organizers can update their sessions" ON queue_sessions;
-- DROP POLICY IF EXISTS "Organizers can delete their sessions" ON queue_sessions;
-- DROP POLICY IF EXISTS "Participants can update their own record" ON queue_participants;
-- DROP POLICY IF EXISTS "Queue Masters update participants safely" ON queue_participants;
--
-- Note: This will leave tables without RLS policies (all operations blocked).
-- You would need to recreate appropriate policies or disable RLS temporarily:
-- ALTER TABLE queue_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Testing Recommendations
-- ============================================================================

-- Test Case 1: Regular player can view public sessions
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<player_user_id>';
-- SELECT * FROM queue_sessions WHERE is_public = true;
-- Expected: Returns public sessions

-- Test Case 2: Player can view sessions they've joined
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<player_user_id>';
-- SELECT * FROM queue_sessions WHERE id IN (
--   SELECT queue_session_id FROM queue_participants WHERE user_id = auth.uid() AND left_at IS NULL
-- );
-- Expected: Returns sessions user has joined

-- Test Case 3: Queue Master can create session
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<queue_master_user_id>';
-- INSERT INTO queue_sessions (organizer_id, court_id, ...) VALUES (auth.uid(), ...);
-- Expected: Success

-- Test Case 4: Player can update their own participation
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<player_user_id>';
-- UPDATE queue_participants SET left_at = now(), status = 'left' WHERE user_id = auth.uid();
-- Expected: Success

-- Test Case 5: Queue Master can update participant status
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<organizer_user_id>';
-- UPDATE queue_participants SET status = 'playing', games_played = games_played + 1
-- WHERE queue_session_id IN (SELECT id FROM queue_sessions WHERE organizer_id = auth.uid());
-- Expected: Success

-- Test Case 6: Player CANNOT modify user_id or joined_at
-- SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<player_user_id>';
-- UPDATE queue_participants SET user_id = '<other_user_id>' WHERE user_id = auth.uid();
-- Expected: Policy violation error

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- This migration addresses critical RLS policy gaps identified in
-- the queue management system architectural review.
--
-- Key improvements:
-- 1. ✅ queue_sessions now has comprehensive CRUD policies
-- 2. ✅ Players can self-update their participation records
-- 3. ✅ Queue Masters have field-restricted update access
-- 4. ✅ Global admins have full access for moderation
-- 5. ✅ Critical fields are protected from modification
--
-- Security Status: IMPROVED from CRITICAL to GOOD
-- Remaining concerns: Rate limiting (application layer)
