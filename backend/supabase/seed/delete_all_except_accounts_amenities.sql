-- =====================================================
-- DELETE ALL DATA EXCEPT ACCOUNTS & AMENITIES
-- =====================================================
-- Preserves:
--   ✅ auth.users (Supabase auth accounts)
--   ✅ profiles (user profiles)
--   ✅ players (player profiles)
--   ✅ roles (system roles)
--   ✅ user_roles (role assignments)
--   ✅ amenities (amenity lookup table)
--   ✅ notification_preferences (user settings)
--
-- Deletes everything else (venues, courts, bookings,
-- payments, queues, ratings, etc.)
-- =====================================================

-- Disable triggers temporarily for faster deletion
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
DELETE FROM promo_code_usage;
DELETE FROM payment_splits;
DELETE FROM refunds;
DELETE FROM payments;

-- =====================================================
-- 6. RESERVATIONS & AVAILABILITIES
-- =====================================================
DELETE FROM court_availabilities;
DELETE FROM reservations;

-- =====================================================
-- 7. COURT DETAILS
-- =====================================================
DELETE FROM court_images;
DELETE FROM court_amenities;
DELETE FROM courts;

-- =====================================================
-- 8. VENUE DETAILS
-- =====================================================
DELETE FROM discount_rules;
DELETE FROM holiday_pricing;
DELETE FROM promo_codes;
DELETE FROM blocked_dates;
DELETE FROM venues;

-- =====================================================
-- 9. PLATFORM SETTINGS (optional - uncomment if needed)
-- =====================================================
-- DELETE FROM platform_settings;
-- DELETE FROM dev_settings;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFY: Show remaining data
-- =====================================================
SELECT '--- PRESERVED (should have data) ---' AS section;
SELECT 'profiles' AS table_name, COUNT(*) AS count FROM profiles
UNION ALL SELECT 'players', COUNT(*) FROM players
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL SELECT 'amenities', COUNT(*) FROM amenities
ORDER BY table_name;

SELECT '--- DELETED (should be 0) ---' AS section;
SELECT 'venues' AS table_name, COUNT(*) AS count FROM venues
UNION ALL SELECT 'courts', COUNT(*) FROM courts
UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'queue_sessions', COUNT(*) FROM queue_sessions
UNION ALL SELECT 'court_ratings', COUNT(*) FROM court_ratings
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY table_name;
