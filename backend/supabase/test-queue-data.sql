-- ============================================================================
-- TEST QUEUE DATA SEED SCRIPT
-- ============================================================================
-- This script creates test queue sessions so you can test the queue features
-- without building the Queue Master UI first.
--
-- Usage:
--   1. Run this in Supabase SQL Editor, OR
--   2. Run via psql: psql <connection_string> -f test-queue-data.sql
--
-- ============================================================================

-- First, let's check if we have any courts to create queues for
-- (This will error if no courts exist - you'll need to create a venue/court first)

DO $$
DECLARE
  v_court_id UUID;
  v_court_name TEXT;
  v_venue_name TEXT;
  v_session_id UUID;
  v_test_user_id UUID;
  v_player_id UUID;
BEGIN
  -- Get any existing user from the database (for testing)
  -- This will use the first user found in the profiles table
  SELECT id INTO v_test_user_id
  FROM profiles
  WHERE is_active = true
  LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in profiles table. Please create a user account first by signing up in the app.';
  END IF;

  -- Get the corresponding player record
  SELECT id INTO v_player_id
  FROM players
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player record found for user. Please ensure the user has a player profile.';
  END IF;

  -- Get the first available court
  SELECT c.id, c.name, v.name
  INTO v_court_id, v_court_name, v_venue_name
  FROM courts c
  JOIN venues v ON c.venue_id = v.id
  WHERE c.is_active = true
  LIMIT 1;

  IF v_court_id IS NULL THEN
    RAISE EXCEPTION 'No active courts found. Please create a venue and court first.';
  END IF;

  RAISE NOTICE 'Creating test queue for: % at %', v_court_name, v_venue_name;

  -- Create a test queue session
  INSERT INTO queue_sessions (
    court_id,
    organizer_id,
    start_time,
    end_time,
    mode,
    game_format,
    status,
    max_players,
    cost_per_game,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    v_court_id,
    v_test_user_id, -- You'll be the organizer/Queue Master
    NOW(), -- Start now
    NOW() + INTERVAL '3 hours', -- 3-hour session
    'casual', -- Casual mode
    'doubles', -- Doubles format
    'active', -- Active queue ready to join
    20, -- Max 20 players in queue
    150.00, -- ₱150 per game
    true, -- Public queue (visible to all)
    NOW(),
    NOW()
  )
  RETURNING id INTO v_session_id;

  RAISE NOTICE 'Created queue session: %', v_session_id;

  -- Add the test user as the first participant
  INSERT INTO queue_participants (
    queue_session_id,
    user_id,
    joined_at,
    games_played,
    games_won,
    amount_owed
  )
  VALUES (
    v_session_id,
    v_test_user_id,
    NOW() - INTERVAL '10 minutes', -- Joined 10 minutes ago
    0, -- Haven't played any games yet
    0,
    0
  );

  RAISE NOTICE 'Added test user (%) to the queue as first participant', v_player_id;

  RAISE NOTICE '✅ Test queue created successfully!';
  RAISE NOTICE '   Queue Session ID: %', v_session_id;
  RAISE NOTICE '   Court: % at %', v_court_name, v_venue_name;
  RAISE NOTICE '   You can now test joining/leaving the queue in the app!';
  RAISE NOTICE '';
  RAISE NOTICE '📍 Go to: http://localhost:3000/queue';

END $$;

-- ============================================================================
-- ALTERNATIVE: Create multiple test queue sessions
-- ============================================================================
-- Uncomment the section below if you want multiple queues for testing

/*
DO $$
DECLARE
  v_court RECORD;
  v_session_id UUID;
  v_test_user_id UUID;
  v_player_id UUID;
  v_counter INT := 0;
BEGIN
  -- Get any existing user from the database
  SELECT id INTO v_test_user_id
  FROM profiles
  WHERE is_active = true
  LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in profiles table.';
  END IF;

  -- Get the corresponding player record
  SELECT id INTO v_player_id
  FROM players
  WHERE user_id = v_test_user_id
  LIMIT 1;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player record found for user.';
  END IF;

  -- Create queue sessions for up to 3 courts
  FOR v_court IN
    SELECT c.id, c.name, v.name as venue_name
    FROM courts c
    JOIN venues v ON c.venue_id = v.id
    WHERE c.is_active = true
    LIMIT 3
  LOOP
    -- Create queue session
    INSERT INTO queue_sessions (
      court_id,
      organizer_id,
      start_time,
      end_time,
      mode,
      game_format,
      status,
      max_players,
      cost_per_game,
      is_public
    )
    VALUES (
      v_court.id,
      v_test_user_id,
      NOW(),
      NOW() + INTERVAL '3 hours',
      'casual',
      'doubles',
      'active',
      20,
      150.00 + (v_counter * 50), -- Vary the price: ₱150, ₱200, ₱250
      true
    )
    RETURNING id INTO v_session_id;

    -- Add test user as participant
    INSERT INTO queue_participants (
      queue_session_id,
      user_id,
      joined_at,
      games_played,
      games_won,
      amount_owed
    )
    VALUES (
      v_session_id,
      v_test_user_id,
      NOW() - (INTERVAL '5 minutes' * v_counter),
      0, 0, 0
    );

    RAISE NOTICE 'Created queue % for: % at %', v_counter + 1, v_court.name, v_court.venue_name;
    v_counter := v_counter + 1;
  END LOOP;

  RAISE NOTICE '✅ Created % test queue sessions!', v_counter;
END $$;
*/

-- ============================================================================
-- CLEANUP: Remove all test queue data
-- ============================================================================
-- Run this when you want to clean up test data

/*
DO $$
BEGIN
  -- Delete queue participants first (foreign key constraint)
  DELETE FROM queue_participants
  WHERE queue_session_id IN (
    SELECT id FROM queue_sessions WHERE status != 'closed'
  );

  -- Delete queue sessions
  DELETE FROM queue_sessions WHERE status != 'closed';

  RAISE NOTICE '✅ Cleaned up all test queue data';
END $$;
*/
