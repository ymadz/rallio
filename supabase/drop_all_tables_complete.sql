-- =====================================================
-- DROP ALL RALLIO TABLES (COMPLETE)
-- =====================================================
-- WARNING: This will permanently delete ALL data!
-- Run this to completely clean your Supabase database

-- Drop Phase 2 tables (newest)
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS rating_helpful_votes CASCADE;
DROP TABLE IF EXISTS rating_responses CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS promo_code_usage CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS holiday_pricing CASCADE;
DROP TABLE IF EXISTS discount_rules CASCADE;
DROP TABLE IF EXISTS court_availabilities CASCADE;

-- Drop Phase 1 tables (V2 core)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS player_ratings CASCADE;
DROP TABLE IF EXISTS court_ratings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS queue_participants CASCADE;
DROP TABLE IF EXISTS queue_sessions CASCADE;
DROP TABLE IF EXISTS payment_splits CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS court_images CASCADE;
DROP TABLE IF EXISTS court_amenities CASCADE;
DROP TABLE IF EXISTS amenities CASCADE;
DROP TABLE IF EXISTS courts CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop V1 legacy tables (if any remain)
DROP TABLE IF EXISTS match_participants CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS queue_entries CASCADE;
DROP TABLE IF EXISTS reservation_splits CASCADE;
DROP TABLE IF EXISTS court_amenity_map CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all functions and triggers
DROP FUNCTION IF EXISTS calculate_player_stats CASCADE;
DROP FUNCTION IF EXISTS check_reservation_conflicts CASCADE;
DROP FUNCTION IF EXISTS apply_best_discount CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS update_queue_participant_count CASCADE;

-- Drop any views
DROP VIEW IF EXISTS player_stats CASCADE;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All Rallio tables dropped successfully!';
  RAISE NOTICE 'Total tables dropped: 26';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'You can now run 001_initial_schema_v2.sql';
END $$;
