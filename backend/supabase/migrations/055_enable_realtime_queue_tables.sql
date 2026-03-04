-- Enable Supabase Realtime for queue tables
-- REPLICA IDENTITY FULL is required for filtered real-time subscriptions
-- (e.g. queue_session_id=eq.{id}) to fire on INSERT/UPDATE/DELETE.

ALTER TABLE queue_participants REPLICA IDENTITY FULL;
ALTER TABLE queue_sessions REPLICA IDENTITY FULL;
ALTER TABLE matches REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication so the Realtime server
-- broadcasts changes. Supabase creates this publication automatically but
-- tables must be added explicitly.
ALTER PUBLICATION supabase_realtime ADD TABLE queue_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
