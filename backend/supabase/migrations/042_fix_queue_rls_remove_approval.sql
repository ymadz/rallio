-- Migration 042: Fix Queue Sessions RLS - Remove approval_status check
-- Created: 2026-02-25
-- Purpose: The RLS SELECT policy from migration 013 requires approval_status = 'approved'
-- for public sessions to be visible. Since the approval flow is removed (migration 041),
-- this blocks ALL public sessions from being visible to regular players.
--
-- ALSO FIXES: Infinite recursion between queue_sessions and queue_participants RLS policies
-- by using SECURITY DEFINER functions to break the circular dependency.

-- ============================================================================
-- 1. CREATE HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS and break recursion)
-- ============================================================================

-- Check if user is a participant in a session (bypasses queue_participants RLS)
CREATE OR REPLACE FUNCTION is_queue_participant(p_session_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM queue_participants
    WHERE queue_session_id = p_session_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is the organizer of the session's venue (bypasses courts/venues RLS)
CREATE OR REPLACE FUNCTION is_court_admin_for_session(p_court_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM courts c
    JOIN venues v ON c.venue_id = v.id
    WHERE c.id = p_court_id
      AND v.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is organizer of a queue session (for queue_participants policies)
CREATE OR REPLACE FUNCTION is_queue_organizer(p_session_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE id = p_session_id
      AND organizer_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_queue_participant TO authenticated;
GRANT EXECUTE ON FUNCTION is_court_admin_for_session TO authenticated;
GRANT EXECUTE ON FUNCTION is_queue_organizer TO authenticated;

-- ============================================================================
-- 2. DROP ALL EXISTING QUEUE_SESSIONS SELECT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "View queue sessions with approval" ON queue_sessions;
DROP POLICY IF EXISTS "Public sessions are viewable" ON queue_sessions;
DROP POLICY IF EXISTS "Participants can view their sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Organizers can view own sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Court admins can view venue sessions" ON queue_sessions;
DROP POLICY IF EXISTS "Global admins have full access to queue sessions" ON queue_sessions;

-- ============================================================================
-- 3. CREATE NEW SELECT POLICIES (using SECURITY DEFINER functions)
-- ============================================================================

-- Public sessions visible to everyone
CREATE POLICY "Public sessions are viewable" ON queue_sessions
  FOR SELECT
  USING (is_public = true);

-- Organizers see their own sessions
CREATE POLICY "Organizers can view own sessions" ON queue_sessions
  FOR SELECT
  USING (auth.uid() = organizer_id);

-- Participants see sessions they're in (uses SECURITY DEFINER to avoid recursion)
CREATE POLICY "Participants can view their sessions" ON queue_sessions
  FOR SELECT
  USING (is_queue_participant(id));

-- Court admins see sessions at their venues (uses SECURITY DEFINER)
CREATE POLICY "Court admins can view venue sessions" ON queue_sessions
  FOR SELECT
  USING (is_court_admin_for_session(court_id));

-- Global admin full access
CREATE POLICY "Global admins have full access to queue sessions" ON queue_sessions
  FOR ALL
  USING (has_role(auth.uid(), 'global_admin'));

-- ============================================================================
-- 4. FIX QUEUE_PARTICIPANTS POLICIES (also had recursion)
-- ============================================================================

-- Drop and recreate the problematic participant policies
DROP POLICY IF EXISTS "Queue Masters update participants safely" ON queue_participants;
DROP POLICY IF EXISTS "Queue Masters can update session participants" ON queue_participants;

-- Recreate using SECURITY DEFINER function (no recursion)
CREATE POLICY "Queue Masters update participants safely" ON queue_participants
  FOR UPDATE
  USING (is_queue_organizer(queue_session_id));

-- ============================================================================
-- 5. SET approval_status TO 'approved' FOR ALL SESSIONS (backwards compat)
-- ============================================================================

UPDATE queue_sessions
SET approval_status = 'approved'
WHERE approval_status != 'approved';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'queue_sessions'
      AND policyname = 'View queue sessions with approval'
  ) THEN
    RAISE EXCEPTION 'Migration 042 failed: Old approval RLS policy still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'queue_sessions'
      AND policyname = 'Public sessions are viewable'
  ) THEN
    RAISE EXCEPTION 'Migration 042 failed: New public SELECT policy not created';
  END IF;

  RAISE NOTICE 'Migration 042 applied successfully - RLS fixed, no recursion';
END $$;
