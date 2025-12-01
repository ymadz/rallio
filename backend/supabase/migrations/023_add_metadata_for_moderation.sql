-- Migration 023: Add metadata and moderation columns
-- This migration adds JSONB metadata column and is_banned column for moderation

-- Add metadata column to court_ratings
ALTER TABLE court_ratings
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add metadata column to player_ratings for future moderation needs
ALTER TABLE player_ratings
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add is_banned column to profiles for user moderation
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- Create index for querying flagged content
CREATE INDEX IF NOT EXISTS idx_court_ratings_metadata_flagged 
ON court_ratings ((metadata->>'flagged')) 
WHERE metadata->>'flagged' = 'true';

-- Create index for banned users
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(is_banned) WHERE is_banned = true;

-- Add comment for documentation
COMMENT ON COLUMN court_ratings.metadata IS 'Stores moderation flags, responses, and other metadata. Structure: { flags: [{flaggedBy, reason, flaggedAt}], flagged: boolean, owner_response: {text, respondedAt, respondedBy} }';
COMMENT ON COLUMN player_ratings.metadata IS 'Stores moderation flags and other metadata for player ratings';
COMMENT ON COLUMN profiles.is_banned IS 'Indicates if the user has been banned by global admins for policy violations';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_court_ratings_metadata ON court_ratings USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_player_ratings_metadata ON player_ratings USING gin(metadata);
