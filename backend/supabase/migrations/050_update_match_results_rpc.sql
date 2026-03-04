-- Migration 050: Create Atomic Match Results RPC
-- Purpose: Fixes P0 ELO RLS bypass bug and P2 stat drift by doing all updates in one transaction
-- Date: 2026-03-04

-- Function to handle all match result updates atomically
CREATE OR REPLACE FUNCTION update_match_results(
  p_match_id uuid,
  p_winner text, -- 'team_a', 'team_b', 'draw'
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_match record;
  v_session record;
  v_team_a uuid[];
  v_team_b uuid[];
  v_all_players uuid[];
  v_winners uuid[];
  v_cost_per_game numeric;
  v_is_competitive boolean;
  v_player_id uuid;
  v_won boolean;
  v_is_draw boolean;
  v_current_participant record;
  v_player_record record;
  
  -- ELO vars
  v_current_rating numeric;
  v_opponent_ids uuid[];
  v_opponent_ratings numeric[];
  v_avg_opponent_rating numeric;
  v_new_rating numeric;
  v_new_skill_level smallint;
  v_expected_score numeric;
  v_actual_score numeric;
  v_k_factor numeric := 32;
  v_rating_changes jsonb := '{}'::jsonb;
BEGIN
  -- 1. Get match and verify status
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already completed');
  END IF;

  IF v_match.status = 'cancelled' THEN
     RETURN jsonb_build_object('success', false, 'error', 'Cannot record result for cancelled match');
  END IF;

  -- 2. Get session details
  SELECT * INTO v_session FROM queue_sessions WHERE id = v_match.queue_session_id;
  
  v_cost_per_game := COALESCE(v_session.cost_per_game, 0);
  v_is_competitive := v_session.mode = 'competitive';
  v_team_a := v_match.team_a_players;
  v_team_b := v_match.team_b_players;
  v_all_players := v_team_a || v_team_b;
  v_is_draw := p_winner = 'draw';
  
  IF p_winner = 'team_a' THEN
    v_winners := v_team_a;
  ELSIF p_winner = 'team_b' THEN
    v_winners := v_team_b;
  ELSE
    v_winners := ARRAY[]::uuid[];
  END IF;

  -- 3. Update Match
  UPDATE matches
  SET 
    winner = p_winner,
    status = 'completed',
    completed_at = now(),
    score_a = CASE WHEN p_winner = 'team_a' THEN 1 ELSE 0 END,
    score_b = CASE WHEN p_winner = 'team_b' THEN 1 ELSE 0 END,
    metadata = COALESCE(p_metadata, v_match.metadata)
  WHERE id = p_match_id;

  -- 4. Update Participants and Player Stats
  FOREACH v_player_id IN ARRAY v_all_players
  LOOP
    v_won := v_player_id = ANY(v_winners);
    
    -- Update Participant (games played, won, amount owed, return to queue)
    SELECT * INTO v_current_participant 
    FROM queue_participants 
    WHERE queue_session_id = v_match.queue_session_id AND user_id = v_player_id
    FOR UPDATE;

    IF v_current_participant IS NOT NULL THEN
      UPDATE queue_participants
      SET 
        games_played = COALESCE(games_played, 0) + 1,
        games_won = CASE WHEN v_won THEN COALESCE(games_won, 0) + 1 ELSE COALESCE(games_won, 0) END,
        amount_owed = COALESCE(amount_owed, 0) + v_cost_per_game,
        status = 'waiting',
        joined_at = now() -- Move to back of queue
      WHERE id = v_current_participant.id;
    END IF;

    -- Update Player Stats
    SELECT * INTO v_player_record FROM players WHERE user_id = v_player_id FOR UPDATE;

    IF v_player_record IS NOT NULL THEN
      -- Calculate ELO if competitive
      IF v_is_competitive THEN
        v_current_rating := COALESCE(v_player_record.rating, 1500);
        
        -- Get opponents
        IF v_is_draw THEN
          -- In a draw, everyone else is an opponent
          SELECT array_agg(user_id) INTO v_opponent_ids 
          FROM unnest(v_all_players) AS user_id 
          WHERE user_id != v_player_id;
        ELSIF v_won THEN
          -- If won, opponents are the losers
          SELECT array_agg(user_id) INTO v_opponent_ids 
          FROM unnest(v_all_players) AS user_id 
          WHERE NOT (user_id = ANY(v_winners));
        ELSE
          -- If lost, opponents are the winners
          v_opponent_ids := v_winners;
        END IF;

        -- Calculate average opponent rating
        SELECT COALESCE(avg(COALESCE(rating, 1500)), 1500) INTO v_avg_opponent_rating
        FROM players
        WHERE user_id = ANY(v_opponent_ids);

        -- Standard ELO formula
        v_expected_score := 1.0 / (1.0 + power(10.0, (v_avg_opponent_rating - v_current_rating) / 400.0));
        
        IF v_is_draw THEN
          v_actual_score := 0.5;
        ELSIF v_won THEN
          v_actual_score := 1.0;
        ELSE
          v_actual_score := 0.0;
        END IF;

        v_new_rating := round(v_current_rating + v_k_factor * (v_actual_score - v_expected_score));
        
          -- Accumulate rating changes
          v_rating_changes := jsonb_set(
            v_rating_changes, 
            array[v_player_id::text], 
            jsonb_build_object(
              'old', v_current_rating, 
              'new', v_new_rating, 
              'diff', v_new_rating - v_current_rating
            )
          );
          
        -- Calculate new skill level
        IF v_new_rating < 1200 THEN v_new_skill_level := 1;
        ELSIF v_new_rating < 1300 THEN v_new_skill_level := 2;
        ELSIF v_new_rating < 1400 THEN v_new_skill_level := 3;
        ELSIF v_new_rating < 1500 THEN v_new_skill_level := 4;
        ELSIF v_new_rating < 1600 THEN v_new_skill_level := 5;
        ELSIF v_new_rating < 1700 THEN v_new_skill_level := 6;
        ELSIF v_new_rating < 1800 THEN v_new_skill_level := 7;
        ELSIF v_new_rating < 1900 THEN v_new_skill_level := 8;
        ELSIF v_new_rating < 2000 THEN v_new_skill_level := 9;
        ELSE v_new_skill_level := 10;
        END IF;

        -- Update Player with ELO (only update skill level if within ±2 limit to prevent sudden jumps)
        UPDATE players
        SET
          total_games_played = COALESCE(total_games_played, 0) + 1,
          total_wins = CASE WHEN v_won AND NOT v_is_draw THEN COALESCE(total_wins, 0) + 1 ELSE COALESCE(total_wins, 0) END,
          total_losses = CASE WHEN NOT v_won AND NOT v_is_draw THEN COALESCE(total_losses, 0) + 1 ELSE COALESCE(total_losses, 0) END,
          rating = v_new_rating,
          -- Auto update skill level if difference is <= 2
          skill_level = CASE 
            WHEN abs(v_new_skill_level - COALESCE(skill_level, 5)) <= 2 THEN v_new_skill_level 
            ELSE skill_level 
          END,
          skill_level_updated_at = CASE 
            WHEN abs(v_new_skill_level - COALESCE(skill_level, 5)) <= 2 AND v_new_skill_level != COALESCE(skill_level, 5) THEN now()
            ELSE skill_level_updated_at 
          END,
          updated_at = now()
        WHERE id = v_player_record.id;
      ELSE
        -- Update Player without ELO (casual)
        UPDATE players
        SET
          total_games_played = COALESCE(total_games_played, 0) + 1,
          total_wins = CASE WHEN v_won AND NOT v_is_draw THEN COALESCE(total_wins, 0) + 1 ELSE COALESCE(total_wins, 0) END,
          total_losses = CASE WHEN NOT v_won AND NOT v_is_draw THEN COALESCE(total_losses, 0) + 1 ELSE COALESCE(total_losses, 0) END,
          updated_at = now()
        WHERE id = v_player_record.id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ratingChanges', v_rating_changes);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_match_results(uuid, text, jsonb) TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_match_results(uuid, text, jsonb) IS 'Atomically records match results, updates queue participants (games, amount owed, return to queue), and updates player stats/ELO ratings.';
