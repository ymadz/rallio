-- =====================================================
-- CLEAR ALL TRANSACTIONS & METADATA
-- =====================================================
-- Preserves:
--   ✅ auth.users (Supabase auth accounts)
--   ✅ profiles (user profiles)
--   ✅ players (player profiles)
--   ✅ roles (system roles)
--   ✅ user_roles (role assignments)
--   ✅ notification_preferences (user settings)
--   ✅ venues (venue details)
--   ✅ venue_images (venue images)
--   ✅ courts (court details)
--   ✅ court_images (court images)
--   ✅ court_availabilities (court schedules)
--   ✅ discount_rules (pricing rules)
--   ✅ holiday_pricing (pricing rules)
--   ✅ blocked_dates (venue closures)
--   ✅ promo_codes (discount codes)
--
-- Deletes:
--   ❌ reservations & bookings
--   ❌ payments, refunds, splits
--   ❌ queue sessions & participants
--   ❌ matches & results
--   ❌ ratings & reviews
--   ❌ notifications & logs
-- =====================================================

-- Disable triggers temporarily for faster deletion and to bypass FK checks
SET session_replication_role = replica;

-- =====================================================
-- 1. AUDIT & LOGS
-- =====================================================
DELETE FROM audit_logs;
DO $$ BEGIN DELETE FROM admin_audit_logs; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- =====================================================
-- 2. NOTIFICATIONS
-- =====================================================
DELETE FROM notifications;

-- =====================================================
-- 3. RATINGS & REVIEWS
-- =====================================================
DELETE FROM rating_helpful_votes;
DELETE FROM rating_responses;
DELETE FROM court_ratings;


-- =====================================================
-- 4. QUEUE & MATCHES
-- =====================================================
DELETE FROM queue_participants;
DELETE FROM matches;
DELETE FROM queue_sessions;

-- =====================================================
-- 5. PAYMENTS & REFUNDS
-- =====================================================

DELETE FROM refunds;
DELETE FROM payments;

-- =====================================================
-- 6. RESERVATIONS & BOOKINGS
-- =====================================================
DELETE FROM reservations;
DO $$ BEGIN DELETE FROM bookings; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM promo_code_usage; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM promo_code_usages; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- =====================================================
-- 7. PLATFORM SETTINGS (Metadata)
-- =====================================================
DELETE FROM platform_settings;
DO $$ BEGIN DELETE FROM dev_settings; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFY: Show remaining data
-- =====================================================
SELECT '--- PRESERVED (should have data) ---' AS section;
SELECT 'venues' AS table_name, COUNT(*) AS count FROM venues
UNION ALL SELECT 'courts', COUNT(*) FROM courts
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'players', COUNT(*) FROM players
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'discount_rules', COUNT(*) FROM discount_rules
ORDER BY table_name;

SELECT '--- DELETED (should be 0) ---' AS section;
SELECT 'reservations' AS table_name, COUNT(*) AS count FROM reservations
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'queue_sessions', COUNT(*) FROM queue_sessions
UNION ALL SELECT 'court_ratings', COUNT(*) FROM court_ratings
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY table_name;
