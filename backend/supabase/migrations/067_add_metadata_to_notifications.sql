-- Migration 067: Add metadata column to notifications table
-- Created: 2026
-- Purpose: Support flexible metadata for different notification types

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}';
    RAISE NOTICE 'Added metadata column to notifications table';
  ELSE
    RAISE NOTICE 'metadata column already exists in notifications table';
  END IF;
END $$;

-- Verify the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'Migration 067 failed: metadata column not found in notifications table';
  END IF;
END $$;
