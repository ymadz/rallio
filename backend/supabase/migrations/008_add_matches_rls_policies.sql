-- Add RLS Policies for Matches Table
-- Fixes: "new row violates row-level security policy for table matches"
-- Issue: RLS was enabled but no policies were defined, blocking all operations

-- ============================================================================
-- Drop Existing Policies (if any)
-- ============================================================================

DROP POLICY IF EXISTS "Match participants can view their matches" ON matches;
DROP POLICY IF EXISTS "Public matches are viewable" ON matches;
DROP POLICY IF EXISTS "Queue Masters can create matches" ON matches;
DROP POLICY IF EXISTS "Queue Masters can update matches" ON matches;
DROP POLICY IF EXISTS "Queue Masters can delete matches" ON matches;
DROP POLICY IF EXISTS "Matches are viewable by participants" ON matches;
DROP POLICY IF EXISTS "Queue Masters can update session participants" ON queue_participants;

-- ============================================================================
-- SELECT Policies
-- ============================================================================

-- Policy: Match participants can view matches they're in
CREATE POLICY "Match participants can view their matches" ON matches
  FOR SELECT
  USING (
    auth.uid() = ANY(team_a_players)
    OR auth.uid() = ANY(team_b_players)
    OR EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

-- Policy: Public matches in public sessions are viewable
CREATE POLICY "Public matches are viewable" ON matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.is_public = true
    )
  );

-- ============================================================================
-- INSERT Policies
-- ============================================================================

-- Policy: Queue Masters can create matches for their sessions
CREATE POLICY "Queue Masters can create matches" ON matches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE Policies
-- ============================================================================

-- Policy: Queue Masters can update matches for their sessions
CREATE POLICY "Queue Masters can update matches" ON matches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

-- ============================================================================
-- DELETE Policies
-- ============================================================================

-- Policy: Queue Masters can delete matches from their sessions
CREATE POLICY "Queue Masters can delete matches" ON matches
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Match participants can view their matches" ON matches IS
  'Players can view matches they are participating in, and Queue Masters can view matches in their sessions';

COMMENT ON POLICY "Public matches are viewable" ON matches IS
  'Matches in public queue sessions are viewable by everyone';

COMMENT ON POLICY "Queue Masters can create matches" ON matches IS
  'Session organizers can create matches for their queue sessions';

COMMENT ON POLICY "Queue Masters can update matches" ON matches IS
  'Session organizers can update match details and scores for their sessions';

COMMENT ON POLICY "Queue Masters can delete matches" ON matches IS
  'Session organizers can delete matches from their sessions (e.g., if created by mistake)';

-- ============================================================================
-- BONUS FIX: Queue Participants UPDATE Policy
-- ============================================================================

-- Policy: Queue Masters can update participants in their sessions
-- This fixes the issue where Queue Masters can't update player status to 'playing'
CREATE POLICY "Queue Masters can update session participants" ON queue_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = queue_participants.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

COMMENT ON POLICY "Queue Masters can update session participants" ON queue_participants IS
  'Session organizers can update participant statuses (e.g., waiting → playing) for their queue sessions';
