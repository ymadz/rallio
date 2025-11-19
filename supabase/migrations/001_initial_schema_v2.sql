-- =====================================================
-- RALLIO DATABASE SCHEMA (Supabase Auth Compatible)
-- Version: 2.0
-- Database: PostgreSQL 16+ with Supabase
-- Purpose: Badminton Court Finder & Queue Management System
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

-- UUID generation (already enabled by Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Geospatial support for court location searches
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- =====================================================
-- PROFILES (extends auth.users)
-- =====================================================

-- User profiles - extends Supabase auth.users
-- This is the main user data table that links to auth.users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  display_name varchar(100),
  first_name varchar(50),
  middle_initial varchar(5),
  last_name varchar(50),
  phone varchar(20),
  avatar_url varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  profile_completed boolean NOT NULL DEFAULT false,
  preferred_locale varchar(10) DEFAULT 'en',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = true;

COMMENT ON TABLE profiles IS 'Extended user profiles linked to Supabase auth.users';

-- =====================================================
-- ROLES & PERMISSIONS
-- =====================================================

-- Roles table - defines user roles (player, court_admin, queue_master, global_admin)
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('player', 'Regular player who can book courts and join queues'),
  ('court_admin', 'Court/venue owner who manages their facilities'),
  ('queue_master', 'User who can create and manage queue sessions'),
  ('global_admin', 'Platform administrator with full access');

COMMENT ON TABLE roles IS 'Defines available user roles in the system';

-- User roles junction table - users can have multiple roles
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

COMMENT ON TABLE user_roles IS 'Maps users to their assigned roles';

-- =====================================================
-- PLAYER PROFILES
-- =====================================================

-- Player-specific profile data
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  birth_date date,
  gender varchar(10),
  skill_level smallint CHECK (skill_level BETWEEN 1 AND 10),
  play_style varchar(50),
  rating numeric(6,2) DEFAULT 1500,
  total_games_played int DEFAULT 0,
  total_wins int DEFAULT 0,
  total_losses int DEFAULT 0,
  verified_player boolean DEFAULT false,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_user ON players(user_id);
CREATE INDEX idx_players_skill ON players(skill_level);
CREATE INDEX idx_players_rating ON players(rating);

COMMENT ON TABLE players IS 'Extended profile information for players';

-- =====================================================
-- VENUES & COURTS
-- =====================================================

-- Venues table - badminton facilities/locations
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name varchar(200) NOT NULL,
  description text,
  address text,
  city varchar(100) DEFAULT 'Zamboanga City',
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone varchar(20),
  email varchar(255),
  website varchar(255),
  opening_hours jsonb,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_venues_location ON venues USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX idx_venues_owner ON venues(owner_id);
CREATE INDEX idx_venues_active ON venues(is_active) WHERE is_active = true;
CREATE INDEX idx_venues_city ON venues(city);

COMMENT ON TABLE venues IS 'Badminton facilities/locations that contain courts';

-- Individual courts within a venue
CREATE TABLE courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name varchar(100),
  description text,
  surface_type varchar(50),
  court_type varchar(20) CHECK (court_type IN ('indoor', 'outdoor')),
  capacity smallint NOT NULL DEFAULT 4,
  hourly_rate numeric(9,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_courts_venue ON courts(venue_id);
CREATE INDEX idx_courts_active ON courts(is_active) WHERE is_active = true;
CREATE INDEX idx_courts_type ON courts(court_type);

COMMENT ON TABLE courts IS 'Individual courts within a venue';

-- Court amenities lookup table
CREATE TABLE amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  icon varchar(50),
  description text
);

-- Pre-populate common amenities
INSERT INTO amenities (name, icon, description) VALUES
  ('Parking', 'car', 'On-site parking available'),
  ('Restroom', 'bath', 'Clean restroom facilities'),
  ('Shower', 'shower-head', 'Shower facilities available'),
  ('Lockers', 'lock', 'Secure locker storage'),
  ('Water', 'droplet', 'Drinking water/water dispenser'),
  ('Air Conditioning', 'snowflake', 'Air-conditioned facility'),
  ('Lighting', 'lightbulb', 'Good lighting for night play'),
  ('Waiting Area', 'armchair', 'Comfortable waiting area'),
  ('Equipment Rental', 'package', 'Racket and shuttlecock rental'),
  ('First Aid', 'heart-pulse', 'First aid kit available'),
  ('WiFi', 'wifi', 'Free WiFi available'),
  ('Canteen', 'utensils', 'Food and drinks available');

COMMENT ON TABLE amenities IS 'Lookup table for available court/venue amenities';

-- Court-amenities many-to-many relationship
CREATE TABLE court_amenities (
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (court_id, amenity_id)
);

CREATE INDEX idx_court_amenities_court ON court_amenities(court_id);

-- Court images
CREATE TABLE court_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  url varchar(500) NOT NULL,
  alt_text varchar(200),
  is_primary boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_court_images_court ON court_images(court_id);

-- =====================================================
-- RESERVATIONS
-- =====================================================

-- Court reservations
CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  num_players int NOT NULL DEFAULT 1,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  payment_type varchar(20) DEFAULT 'full' CHECK (payment_type IN ('full', 'split')),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  CHECK (end_time > start_time)
);

CREATE INDEX idx_reservations_court ON reservations(court_id);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_time ON reservations(start_time, end_time);

COMMENT ON TABLE reservations IS 'Court booking reservations';

-- =====================================================
-- PAYMENTS
-- =====================================================

-- Main payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(100) UNIQUE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency varchar(3) NOT NULL DEFAULT 'PHP',
  payment_method varchar(50) NOT NULL,
  payment_provider varchar(50) DEFAULT 'paymongo',
  external_id varchar(200),
  qr_code_url varchar(500),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  paid_at timestamptz,
  expires_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_payments_reference ON payments(reference);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_status ON payments(status);

COMMENT ON TABLE payments IS 'All payment transactions';

-- Split payment participants
CREATE TABLE payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email varchar(255) NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_id uuid REFERENCES payments(id),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  paid_at timestamptz,
  payment_link varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_splits_reservation ON payment_splits(reservation_id);
CREATE INDEX idx_payment_splits_user ON payment_splits(user_id);

-- =====================================================
-- QUEUE MANAGEMENT
-- =====================================================

-- Queue sessions
CREATE TABLE queue_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  organizer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  mode varchar(20) NOT NULL DEFAULT 'casual'
    CHECK (mode IN ('casual', 'competitive')),
  game_format varchar(20) DEFAULT 'doubles'
    CHECK (game_format IN ('singles', 'doubles', 'mixed')),
  max_players smallint NOT NULL DEFAULT 12,
  current_players int DEFAULT 0,
  cost_per_game numeric(9,2),
  is_public boolean DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'active', 'paused', 'closed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb DEFAULT '{}',
  CHECK (end_time > start_time)
);

CREATE INDEX idx_queue_sessions_court ON queue_sessions(court_id);
CREATE INDEX idx_queue_sessions_organizer ON queue_sessions(organizer_id);
CREATE INDEX idx_queue_sessions_status ON queue_sessions(status);
CREATE INDEX idx_queue_sessions_time ON queue_sessions(start_time, end_time);

COMMENT ON TABLE queue_sessions IS 'Organized play sessions with player rotation';

-- Queue participants
CREATE TABLE queue_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id uuid NOT NULL REFERENCES queue_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  games_played int DEFAULT 0,
  games_won int DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'playing', 'completed', 'left')),
  payment_status varchar(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  amount_owed numeric(9,2) DEFAULT 0,
  UNIQUE (queue_session_id, user_id)
);

CREATE INDEX idx_queue_participants_session ON queue_participants(queue_session_id);
CREATE INDEX idx_queue_participants_user ON queue_participants(user_id);

-- =====================================================
-- MATCHES/GAMES
-- =====================================================

-- Individual matches
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id uuid REFERENCES queue_sessions(id) ON DELETE SET NULL,
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  match_number int,
  game_format varchar(20) DEFAULT 'doubles',
  team_a_players uuid[] NOT NULL,
  team_b_players uuid[] NOT NULL,
  score_a int,
  score_b int,
  winner varchar(10) CHECK (winner IN ('team_a', 'team_b', 'draw')),
  started_at timestamptz,
  completed_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_matches_queue_session ON matches(queue_session_id);
CREATE INDEX idx_matches_court ON matches(court_id);
CREATE INDEX idx_matches_status ON matches(status);

-- =====================================================
-- RATINGS & REVIEWS
-- =====================================================

-- Court ratings
CREATE TABLE court_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  quality_rating smallint CHECK (quality_rating BETWEEN 1 AND 5),
  cleanliness_rating smallint CHECK (cleanliness_rating BETWEEN 1 AND 5),
  facilities_rating smallint CHECK (facilities_rating BETWEEN 1 AND 5),
  value_rating smallint CHECK (value_rating BETWEEN 1 AND 5),
  review text,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (court_id, user_id, reservation_id)
);

CREATE INDEX idx_court_ratings_court ON court_ratings(court_id);
CREATE INDEX idx_court_ratings_user ON court_ratings(user_id);

-- Player ratings (post-match)
CREATE TABLE player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sportsmanship smallint CHECK (sportsmanship BETWEEN 1 AND 5),
  skill_accuracy smallint CHECK (skill_accuracy BETWEEN 1 AND 5),
  reliability smallint CHECK (reliability BETWEEN 1 AND 5),
  would_play_again boolean,
  comment text,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, rater_id, rated_id)
);

CREATE INDEX idx_player_ratings_rated ON player_ratings(rated_id);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  action_url varchar(500),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_sessions_updated_at BEFORE UPDATE ON queue_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_court_ratings_updated_at BEFORE UPDATE ON court_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- Also create player profile with default role
  INSERT INTO public.players (user_id)
  VALUES (NEW.id);

  -- Assign default player role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'player';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update queue participant count
CREATE OR REPLACE FUNCTION update_queue_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE queue_sessions
    SET current_players = current_players + 1
    WHERE id = NEW.queue_session_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'left') THEN
    UPDATE queue_sessions
    SET current_players = GREATEST(0, current_players - 1)
    WHERE id = COALESCE(NEW.queue_session_id, OLD.queue_session_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_queue_count
AFTER INSERT OR UPDATE OR DELETE ON queue_participants
FOR EACH ROW EXECUTE FUNCTION update_queue_participant_count();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Players policies
CREATE POLICY "Players are viewable by everyone" ON players
  FOR SELECT USING (true);

CREATE POLICY "Users can update own player profile" ON players
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Venues policies
CREATE POLICY "Venues are viewable by everyone" ON venues
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners can manage their venues" ON venues
  FOR ALL USING (auth.uid() = owner_id);

-- Courts policies
CREATE POLICY "Active courts are viewable by everyone" ON courts
  FOR SELECT USING (is_active = true);

CREATE POLICY "Venue owners can manage courts" ON courts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.id = courts.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Amenities policies (public read)
CREATE POLICY "Amenities are viewable by everyone" ON amenities
  FOR SELECT USING (true);

-- Court amenities policies
CREATE POLICY "Court amenities are viewable by everyone" ON court_amenities
  FOR SELECT USING (true);

-- Court images policies
CREATE POLICY "Court images are viewable by everyone" ON court_images
  FOR SELECT USING (true);

-- Reservations policies
CREATE POLICY "Users can view own reservations" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create reservations" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reservations" ON reservations
  FOR UPDATE USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Payment splits policies
CREATE POLICY "Users can view own payment splits" ON payment_splits
  FOR SELECT USING (auth.uid() = user_id);

-- Queue sessions policies
CREATE POLICY "Public queue sessions are viewable" ON queue_sessions
  FOR SELECT USING (is_public = true OR auth.uid() = organizer_id);

CREATE POLICY "Users can create queue sessions" ON queue_sessions
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their sessions" ON queue_sessions
  FOR UPDATE USING (auth.uid() = organizer_id);

-- Queue participants policies
CREATE POLICY "Participants can view session participants" ON queue_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = queue_participants.queue_session_id
      AND (queue_sessions.is_public = true OR queue_sessions.organizer_id = auth.uid())
    )
    OR auth.uid() = user_id
  );

CREATE POLICY "Users can join queues" ON queue_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON queue_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Matches are viewable by participants" ON matches
  FOR SELECT USING (
    auth.uid() = ANY(team_a_players) OR
    auth.uid() = ANY(team_b_players) OR
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = matches.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  );

-- Court ratings policies
CREATE POLICY "Court ratings are viewable by everyone" ON court_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can create ratings" ON court_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON court_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Player ratings policies
CREATE POLICY "Users can view ratings about them" ON player_ratings
  FOR SELECT USING (auth.uid() = rated_id OR auth.uid() = rater_id);

CREATE POLICY "Users can create player ratings" ON player_ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- SAMPLE DATA (for development)
-- =====================================================

-- Sample venues in Zamboanga City
INSERT INTO venues (name, description, address, city, latitude, longitude, phone, email, is_active, is_verified, opening_hours) VALUES
  ('Fewddicts Badminton Court',
   'Premier badminton facility with 4 well-maintained courts',
   'Tetuan, Zamboanga City',
   'Zamboanga City',
   6.9214,
   122.0790,
   '+63 912 345 6789',
   'fewddicts@example.com',
   true,
   true,
   '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "06:00", "close": "22:00"}, "sunday": {"open": "06:00", "close": "22:00"}}'
  ),
  ('Zamboanga Badminton Center',
   'Modern indoor facility with air conditioning',
   'Canelar, Zamboanga City',
   'Zamboanga City',
   6.9104,
   122.0740,
   '+63 917 123 4567',
   'zbc@example.com',
   true,
   true,
   '{"monday": {"open": "07:00", "close": "21:00"}, "tuesday": {"open": "07:00", "close": "21:00"}, "wednesday": {"open": "07:00", "close": "21:00"}, "thursday": {"open": "07:00", "close": "21:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "22:00"}, "sunday": {"open": "08:00", "close": "22:00"}}'
  );

-- Get venue IDs for court creation
DO $$
DECLARE
  fewddicts_id uuid;
  zbc_id uuid;
BEGIN
  SELECT id INTO fewddicts_id FROM venues WHERE name = 'Fewddicts Badminton Court';
  SELECT id INTO zbc_id FROM venues WHERE name = 'Zamboanga Badminton Center';

  -- Courts for Fewddicts
  INSERT INTO courts (venue_id, name, description, surface_type, court_type, capacity, hourly_rate) VALUES
    (fewddicts_id, 'Court 1', 'Main court with premium flooring', 'synthetic', 'indoor', 4, 300),
    (fewddicts_id, 'Court 2', 'Standard court', 'synthetic', 'indoor', 4, 250),
    (fewddicts_id, 'Court 3', 'Standard court', 'synthetic', 'indoor', 4, 250),
    (fewddicts_id, 'Court 4', 'Training court', 'synthetic', 'indoor', 4, 200);

  -- Courts for ZBC
  INSERT INTO courts (venue_id, name, description, surface_type, court_type, capacity, hourly_rate) VALUES
    (zbc_id, 'Court A', 'Competition-grade court', 'wood', 'indoor', 4, 400),
    (zbc_id, 'Court B', 'Competition-grade court', 'wood', 'indoor', 4, 400),
    (zbc_id, 'Court C', 'Standard court', 'synthetic', 'indoor', 4, 300),
    (zbc_id, 'Court D', 'Standard court', 'synthetic', 'indoor', 4, 300);
END $$;

-- Add amenities to courts
DO $$
DECLARE
  court_rec RECORD;
  amenity_rec RECORD;
BEGIN
  -- Add common amenities to all courts
  FOR court_rec IN SELECT id FROM courts LOOP
    FOR amenity_rec IN SELECT id FROM amenities WHERE name IN ('Parking', 'Restroom', 'Water', 'Lighting') LOOP
      INSERT INTO court_amenities (court_id, amenity_id) VALUES (court_rec.id, amenity_rec.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Add AC to indoor courts
  FOR court_rec IN SELECT c.id FROM courts c JOIN venues v ON c.venue_id = v.id WHERE v.name = 'Zamboanga Badminton Center' LOOP
    INSERT INTO court_amenities (court_id, amenity_id)
    SELECT court_rec.id, id FROM amenities WHERE name = 'Air Conditioning'
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
