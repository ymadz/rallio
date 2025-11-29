-- Queue Master Helper Functions
-- These functions support Queue Master session management operations

-- Function to safely decrement current_players count
-- Used when removing a participant from a queue session
CREATE OR REPLACE FUNCTION decrement_queue_players(session_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE queue_sessions
   SET current_players = GREATEST(0, current_players - 1)
  WHERE id = session_id;
END;
$$; 

-- Function to safely increment current_players count
-- Used when a participant joins a queue session
CREATE OR REPLACE FUNCTION increment_queue_players(session_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE queue_sessions
  SET current_players = current_players + 1
  WHERE id = session_id;
END;
$$;

-- Comment the functions
COMMENT ON FUNCTION decrement_queue_players IS 'Safely decrements the current_players count for a queue session (minimum 0)';
COMMENT ON FUNCTION increment_queue_players IS 'Safely increments the current_players count for a queue session';
