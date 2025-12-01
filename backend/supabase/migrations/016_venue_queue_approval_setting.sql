-- =====================================================
-- MIGRATION 016: Venue Queue Approval Setting
-- Purpose: Add setting to control whether queue sessions require approval
-- Dependencies: 001_initial_schema_v2.sql, 012_queue_session_approval_workflow.sql
-- =====================================================

-- Add requires_queue_approval column to venues table
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS requires_queue_approval BOOLEAN NOT NULL DEFAULT true;

-- Add index for querying venues that require approval
CREATE INDEX IF NOT EXISTS idx_venues_queue_approval
  ON venues(requires_queue_approval)
  WHERE requires_queue_approval = true;

-- Add comment
COMMENT ON COLUMN venues.requires_queue_approval IS 'Whether queue sessions at this venue require Court Admin approval before going live';

-- Update existing venues to require approval by default (conservative approach)
UPDATE venues
SET requires_queue_approval = true
WHERE requires_queue_approval IS NULL;