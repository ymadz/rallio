-- Migration 028: Add metadata column to queue_sessions table
-- 
-- Problem: Queue session creation fails with error:
-- "Could not find the 'metadata' column of 'queue_sessions' in the schema cache"
--
-- Solution: Add the metadata JSONB column that the code expects

-- Add metadata column to queue_sessions table
ALTER TABLE queue_sessions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN queue_sessions.metadata IS 'Flexible JSON storage for additional session data like linked reservation_id';

-- Create index for JSONB queries if needed
CREATE INDEX IF NOT EXISTS idx_queue_sessions_metadata ON queue_sessions USING GIN (metadata);
