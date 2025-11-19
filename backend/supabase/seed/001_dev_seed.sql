-- =====================================================
-- SEED DATA FOR LOCAL DEVELOPMENT
-- Version: 1.0
-- Purpose: Populate database with sample venues, courts, players, and test data
-- =====================================================

-- Clear existing data (optional — only for fresh reset)
-- DELETE FROM court_amenity_map;
-- DELETE FROM court_amenities; -- Keep this, it's reference data
-- DELETE FROM courts;
-- DELETE FROM venues;
-- DELETE FROM players;
-- DELETE FROM user_roles;
-- DELETE FROM users;

-- =====================================================
-- SAMPLE USERS
-- =====================================================

-- Test Player 1
INSERT INTO users (id, email, display_name, phone, is_active, profile_completed, avatar_url)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'player1@example.com',
  'Juan Santos',
  '09171234567',
  true,
  true,
  'https://api.dicebear.com/9.x/avataaars/svg?seed=player1'
)
ON CONFLICT (email) DO NOTHING;

-- Test Player 2
INSERT INTO users (id, email, display_name, phone, is_active, profile_completed, avatar_url)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  'player2@example.com',
  'Maria Reyes',
  '09181234567',
  true,
  true,
  'https://api.dicebear.com/9.x/avataaars/svg?seed=player2'
)
ON CONFLICT (email) DO NOTHING;

-- Test Court Admin
INSERT INTO users (id, email, display_name, phone, is_active, profile_completed, avatar_url)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  'admin@venue.com',
  'Carlos Venue Owner',
  '09191234567',
  true,
  true,
  'https://api.dicebear.com/9.x/avataaars/svg?seed=admin'
)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SAMPLE PLAYER PROFILES
-- =====================================================

-- Player 1 Profile
INSERT INTO players (id, user_id, skill_level, play_style, rating, total_games_played, verified_player, bio)
VALUES (
  'e47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  7,
  'competitive',
  1650,
  45,
  true,
  'Passionate badminton player. Loves doubles and competitive matches.'
)
ON CONFLICT (user_id) DO NOTHING;

-- Player 2 Profile
INSERT INTO players (id, user_id, skill_level, play_style, rating, total_games_played, verified_player, bio)
VALUES (
  'e47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  5,
  'casual',
  1450,
  12,
  false,
  'Learning badminton. Enjoy friendly matches and coaching.'
)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- ASSIGN ROLES
-- =====================================================

-- Player 1 gets "player" role
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  r.id,
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid
FROM roles r
WHERE r.name = 'player'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Player 2 gets "player" role
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  'f47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  r.id,
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid
FROM roles r
WHERE r.name = 'player'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Court Admin gets "court_admin" and "queue_master" roles
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  r.id,
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid
FROM roles r
WHERE r.name IN ('court_admin', 'queue_master')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =====================================================
-- SAMPLE VENUES
-- =====================================================

-- Zamboanga Sports Complex
INSERT INTO venues (
  id,
  owner_user_id,
  name,
  description,
  address,
  latitude,
  longitude,
  phone,
  email,
  website,
  opening_hours,
  is_active
) VALUES (
  'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  'Zamboanga Sports Complex',
  'Premier badminton facility with 8 courts, air-conditioned, professional grade',
  'Calinog Avenue, Zamboanga City',
  6.9228,
  122.0723,
  '09201234567',
  'info@zamboangasports.com',
  'https://zamboangasports.com',
  '{
    "monday": {"open": "08:00", "close": "22:00"},
    "tuesday": {"open": "08:00", "close": "22:00"},
    "wednesday": {"open": "08:00", "close": "22:00"},
    "thursday": {"open": "08:00", "close": "22:00"},
    "friday": {"open": "08:00", "close": "23:00"},
    "saturday": {"open": "07:00", "close": "23:00"},
    "sunday": {"open": "07:00", "close": "22:00"}
  }',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Badminton Club Rio Hondo
INSERT INTO venues (
  id,
  owner_user_id,
  name,
  description,
  address,
  latitude,
  longitude,
  phone,
  email,
  is_active
) VALUES (
  'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid,
  'Badminton Club Rio Hondo',
  'Cozy community badminton club with 4 outdoor courts',
  'Rio Hondo, Zamboanga City',
  6.9200,
  122.0650,
  '09211234567',
  'info@rhbc.com',
  true
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SAMPLE COURTS
-- =====================================================

-- Zamboanga Sports Complex - Court 1-4 (Indoor AC)
INSERT INTO courts (id, venue_id, name, description, surface_type, court_type, capacity, hourly_rate, is_active)
VALUES
  ('c47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'Court A1', 'Indoor, AC, Professional grade', 'wood', 'indoor', 4, 500, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'Court A2', 'Indoor, AC, Professional grade', 'wood', 'indoor', 4, 500, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'Court B1', 'Indoor, AC, Training court', 'synthetic', 'indoor', 4, 400, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d482'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'Court B2', 'Indoor, AC, Training court', 'synthetic', 'indoor', 4, 400, true)
ON CONFLICT (id) DO NOTHING;

-- Rio Hondo - Court 1-4 (Outdoor)
INSERT INTO courts (id, venue_id, name, description, surface_type, court_type, capacity, hourly_rate, is_active)
VALUES
  ('c47ac10b-58cc-4372-a567-0e02b2c3d483'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 'Court 1', 'Outdoor, well-lit', 'concrete', 'outdoor', 4, 250, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d484'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 'Court 2', 'Outdoor, well-lit', 'concrete', 'outdoor', 4, 250, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d485'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 'Court 3', 'Outdoor', 'concrete', 'outdoor', 4, 200, true),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d486'::uuid, 'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid, 'Court 4', 'Outdoor', 'concrete', 'outdoor', 4, 200, true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- LINK COURT AMENITIES
-- =====================================================

-- Zamboanga Sports Complex - All courts get: Parking, Restroom, Shower, Locker, Water, AC, Lighting, Waiting Area, Equipment Rental
INSERT INTO court_amenity_map (court_id, amenity_id)
SELECT
  c.id as court_id,
  ca.id as amenity_id
FROM courts c
CROSS JOIN court_amenities ca
WHERE c.venue_id = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid
AND ca.name IN ('Parking', 'Restroom', 'Shower', 'Lockers', 'Water', 'AC', 'Lighting', 'Waiting Area', 'Equipment Rental')
ON CONFLICT (court_id, amenity_id) DO NOTHING;

-- Rio Hondo - Courts get: Parking, Restroom, Water, Lighting
INSERT INTO court_amenity_map (court_id, amenity_id)
SELECT
  c.id as court_id,
  ca.id as amenity_id
FROM courts c
CROSS JOIN court_amenities ca
WHERE c.venue_id = 'a47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid
AND ca.name IN ('Parking', 'Restroom', 'Water', 'Lighting')
ON CONFLICT (court_id, amenity_id) DO NOTHING;

-- =====================================================
-- END OF SEED DATA
-- =====================================================

COMMENT ON SCHEMA public IS 'Seed data populated for local development and testing';
