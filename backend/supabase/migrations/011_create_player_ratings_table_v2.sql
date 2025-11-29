-- Migration: Create player_ratings table for post-match ratings
-- Created: 2025-11-28
-- Purpose: Allow players to rate opponents after matches

-- Drop existing table if it exists (for clean re-run)
DROP TABLE IF EXISTS player_ratings CASCADE;

-- Create player_ratings table
CREATE TABLE player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate ratings
  CONSTRAINT unique_match_rating UNIQUE(rater_id, ratee_id, match_id),

  -- Prevent self-rating
  CONSTRAINT no_self_rating CHECK (rater_id != ratee_id)
);

-- Create indexes
CREATE INDEX idx_player_ratings_rater ON player_ratings(rater_id);
CREATE INDEX idx_player_ratings_ratee ON player_ratings(ratee_id);
CREATE INDEX idx_player_ratings_match ON player_ratings(match_id);
CREATE INDEX idx_player_ratings_created_at ON player_ratings(created_at);

-- Enable RLS
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view ratings"
  ON player_ratings FOR SELECT
  USING (true);

CREATE POLICY "Players can rate opponents in their matches"
  ON player_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
      AND (
        matches.team_a_players @> ARRAY[auth.uid()]
        OR matches.team_b_players @> ARRAY[auth.uid()]
      )
      AND matches.status = 'completed'
    )
  );

CREATE POLICY "Players can update their own ratings within 24h"
  ON player_ratings FOR UPDATE
  USING (auth.uid() = rater_id AND created_at > NOW() - INTERVAL '24 hours')
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Players can delete their own ratings within 24h"
  ON player_ratings FOR DELETE
  USING (auth.uid() = rater_id AND created_at > NOW() - INTERVAL '24 hours');

-- Helper functions
CREATE OR REPLACE FUNCTION get_player_average_rating(player_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
  FROM player_ratings
  WHERE ratee_id = player_id;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_player_rating_count(player_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM player_ratings
  WHERE ratee_id = player_id;
$$ LANGUAGE SQL STABLE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_player_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_player_ratings_updated_at
  BEFORE UPDATE ON player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_player_ratings_updated_at();
