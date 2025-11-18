-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Version: 1.0
-- Purpose: Enforce data access control based on user roles and ownership
-- =====================================================

-- =====================================================
-- USERS TABLE
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Public can read their own user profile
CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Global admins can read all users
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'global_admin'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- PLAYERS TABLE
-- =====================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Public can read player profiles
CREATE POLICY "Public can read player profiles"
  ON players FOR SELECT
  USING (true);

-- Players can update their own profile
CREATE POLICY "Players can update their own profile"
  ON players FOR UPDATE
  USING (auth.uid() = user_id);

-- Players can insert their own profile (after signup)
CREATE POLICY "Players can create their own profile"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- VENUES TABLE
-- =====================================================

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Public can read active venues
CREATE POLICY "Public can read active venues"
  ON venues FOR SELECT
  USING (is_active = true);

-- Court admins can read all their venues
CREATE POLICY "Court admins can read their venues"
  ON venues FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Court admins can update their venues
CREATE POLICY "Court admins can update their venues"
  ON venues FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Court admins can insert venues
CREATE POLICY "Court admins can create venues"
  ON venues FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Global admins can read/update all venues
CREATE POLICY "Admins can manage all venues"
  ON venues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'global_admin'
    )
  );

-- =====================================================
-- COURTS TABLE
-- =====================================================

ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

-- Public can read active courts
CREATE POLICY "Public can read active courts"
  ON courts FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM venues v WHERE v.id = venue_id AND v.is_active = true
    )
  );

-- Court admins can read their venue's courts
CREATE POLICY "Court admins can read their courts"
  ON courts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.id = venue_id AND v.owner_user_id = auth.uid()
    )
  );

-- Court admins can update their courts
CREATE POLICY "Court admins can update their courts"
  ON courts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.id = venue_id AND v.owner_user_id = auth.uid()
    )
  );

-- Court admins can insert courts
CREATE POLICY "Court admins can create courts"
  ON courts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.id = venue_id AND v.owner_user_id = auth.uid()
    )
  );

-- =====================================================
-- COURT_AMENITY_MAP TABLE
-- =====================================================

ALTER TABLE court_amenity_map ENABLE ROW LEVEL SECURITY;

-- Public can read amenities for active courts
CREATE POLICY "Public can read court amenities"
  ON court_amenity_map FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courts c
      WHERE c.id = court_id AND c.is_active = true
      AND EXISTS (
        SELECT 1 FROM venues v 
        WHERE v.id = c.venue_id AND v.is_active = true
      )
    )
  );

-- Court admins can manage amenities for their courts
CREATE POLICY "Court admins can manage amenities"
  ON court_amenity_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courts c
      JOIN venues v ON v.id = c.venue_id
      WHERE c.id = court_id AND v.owner_user_id = auth.uid()
    )
  );

-- =====================================================
-- RESERVATIONS TABLE (if it exists)
-- =====================================================

-- Uncomment when reservations table is created
-- ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- -- Players can read their own reservations
-- CREATE POLICY "Players can read their own reservations"
--   ON reservations FOR SELECT
--   USING (user_id = auth.uid());

-- -- Court admins can read reservations for their courts
-- CREATE POLICY "Court admins can read reservations for their courts"
--   ON reservations FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM courts c
--       JOIN venues v ON v.id = c.venue_id
--       WHERE c.id = court_id AND v.owner_user_id = auth.uid()
--     )
--   );

-- -- Players can create reservations
-- CREATE POLICY "Players can create reservations"
--   ON reservations FOR INSERT
--   WITH CHECK (user_id = auth.uid());

-- -- Players can update/cancel their own reservations
-- CREATE POLICY "Players can update their reservations"
--   ON reservations FOR UPDATE
--   USING (user_id = auth.uid());

-- =====================================================
-- QUEUE_SESSIONS TABLE (if it exists)
-- =====================================================

-- Uncomment when queue_sessions table is created
-- ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;

-- -- Players can read active queue sessions
-- CREATE POLICY "Players can read queue sessions"
--   ON queue_sessions FOR SELECT
--   USING (is_active = true);

-- -- Queue masters can manage their sessions
-- CREATE POLICY "Queue masters can manage their sessions"
--   ON queue_sessions FOR ALL
--   USING (queue_master_user_id = auth.uid());

-- =====================================================
-- END OF RLS POLICIES
-- =====================================================

COMMENT ON SCHEMA public IS 'Public schema with Row Level Security enabled for data protection';
