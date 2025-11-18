-- =====================================================
-- RALLIO DATABASE SCHEMA
-- Version: 1.0
-- Database: PostgreSQL 16+
-- Purpose: Badminton Court Finder & Queue Management System
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Geospatial support for court location searches
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

-- Main users table - stores all user accounts
-- Supports players, court admins, queue masters, and global admins
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  display_name varchar(100) NOT NULL,
  phone varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  profile_completed boolean NOT NULL DEFAULT false,
  preferred_locale varchar(10) DEFAULT 'en',
  avatar_url varchar(500),
  metadata jsonb DEFAULT '{}',
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

COMMENT ON TABLE users IS 'Main user accounts for all user types in the system';
COMMENT ON COLUMN users.metadata IS 'Flexible JSON field for additional user data (preferences, settings, etc.)';

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
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

COMMENT ON TABLE user_roles IS 'Maps users to their assigned roles (many-to-many relationship)';

-- =====================================================
-- PLAYER PROFILES
-- =====================================================

-- Player-specific profile data
-- Extends user data with badminton-specific information
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birth_date date,
  gender varchar(10),
  skill_level smallint CHECK (skill_level BETWEEN 1 AND 10),
  play_style varchar(50), -- casual, competitive, singles, doubles, mixed
  rating numeric(6,2) DEFAULT 1500, -- ELO-style rating
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
COMMENT ON COLUMN players.skill_level IS 'Player skill level from 1 (beginner) to 10 (elite)';
COMMENT ON COLUMN players.rating IS 'ELO-style rating that evolves with performance, starts at 1500';
COMMENT ON COLUMN players.verified_player IS 'Badge for players with high ratings and active participation';

-- =====================================================
-- VENUES & COURTS
-- =====================================================

-- Venues table - badminton facilities/locations
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name varchar(200) NOT NULL,
  description text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone varchar(20),
  email varchar(255),
  website varchar(255),
  opening_hours jsonb, -- {"monday": {"open": "08:00", "close": "22:00"}, ...}
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Geospatial index for location-based searches
CREATE INDEX idx_venues_location ON venues USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX idx_venues_owner ON venues(owner_user_id);
CREATE INDEX idx_venues_active ON venues(is_active) WHERE is_active = true;

COMMENT ON TABLE venues IS 'Badminton facilities/locations that contain courts';
COMMENT ON COLUMN venues.opening_hours IS 'JSON object with opening hours per day of week';

-- Individual courts within a venue
CREATE TABLE courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name varchar(100), -- "Court 1", "Court A", etc.
  description text,
  surface_type varchar(50), -- wood, synthetic, concrete
  court_type varchar(20) CHECK (court_type IN ('indoor','outdoor')),
  capacity smallint NOT NULL DEFAULT 4, -- max players at once
  hourly_rate numeric(9,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_courts_venue ON courts(venue_id);
CREATE INDEX idx_courts_active ON courts(is_active) WHERE is_active = true;

COMMENT ON TABLE courts IS 'Individual courts within a venue';
COMMENT ON COLUMN courts.capacity IS 'Maximum number of players that can play simultaneously';
COMMENT ON COLUMN courts.hourly_rate IS 'Base hourly rental rate in PHP';

-- Court amenities lookup table
CREATE TABLE court_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  icon varchar(50), -- icon identifier for UI
  description text
);

-- Pre-populate common amenities
INSERT INTO court_amenities (name, icon, description) VALUES
  ('Parking', 'parking', 'On-site parking available'),
  ('Restroom', 'restroom', 'Clean restroom facilities'),
  ('Shower', 'shower', 'Shower facilities available'),
  ('Lockers', 'locker', 'Secure locker storage'),
  ('Water', 'water', 'Drinking water/water dispenser'),
  ('AC', 'ac_unit', 'Air-conditioned facility'),
  ('Lighting', 'lightbulb', 'Good lighting for night play'),
  ('Waiting Area', 'chair', 'Comfortable waiting area'),
  ('Equipment Rental', 'sports', 'Racket and shuttlecock rental'),
  ('First Aid', 'medical', 'First aid kit available');

COMMENT ON TABLE court_amenities IS 'Lookup table for available court amenities';

-- Court-amenities many-to-many relationship
CREATE TABLE court_amenity_map (
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES court_amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (court_id, amenity_id)
);

CREATE INDEX idx_court_amenity_court ON court_amenity_map(court_id);
CREATE INDEX idx_court_amenity_amenity ON court_amenity_map(amenity_id);

COMMENT ON TABLE court_amenity_map IS 'Maps courts to their available amenities';

-- =====================================================
-- COURT AVAILABILITY & RESERVATIONS
-- =====================================================

-- Court availability slots
CREATE TABLE court_availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_reserved boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false, -- manually blocked by court admin
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CHECK (end_time > start_time)
);

CREATE INDEX idx_avail_court_time ON court_availabilities(court_id, start_time, end_time);
CREATE INDEX idx_avail_reserved ON court_availabilities(is_reserved);

COMMENT ON TABLE court_availabilities IS 'Time slots for court availability and blocking';
COMMENT ON COLUMN court_availabilities.is_blocked IS 'Manually blocked by admin for maintenance, events, etc.';

-- Court reservations
CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_availability_id uuid NOT NULL REFERENCES court_availabilities(id) ON DELETE RESTRICT,
  organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  reserved_for int NOT NULL DEFAULT 1, -- number of people
  payment_type varchar(20) DEFAULT 'full' CHECK (payment_type IN ('full', 'split')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  discount_applied numeric(12,2) DEFAULT 0,
  discount_reason varchar(200),
  status varchar(20) NOT NULL DEFAULT 'confirmed' 
    CHECK (status IN ('created', 'partially_paid', 'fully_paid', 'confirmed', 'cancelled', 'completed', 'expired')),
  payment_deadline timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_reservations_availability ON reservations(court_availability_id);
CREATE INDEX idx_reservations_organizer ON reservations(organizer_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_payment_deadline ON reservations(payment_deadline) 
  WHERE status = 'partially_paid';

COMMENT ON TABLE reservations IS 'Court booking reservations made by users';
COMMENT ON COLUMN reservations.payment_type IS 'Whether payment is full upfront or split among participants';
COMMENT ON COLUMN reservations.status IS 'Reservation lifecycle state';

-- =====================================================
-- PAYMENTS (Moved here to avoid circular dependency)
-- =====================================================

-- Main payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(100) UNIQUE NOT NULL, -- external payment reference
  payer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency varchar(3) NOT NULL DEFAULT 'PHP',
  payment_method varchar(50) NOT NULL, -- gcash, maya, card, cash
  payment_method_details jsonb, -- additional payment details
  qr_code_url varchar(500), -- for QR payments
  expires_at timestamptz, -- for QR code expiration
  status varchar(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  payment_intent_id varchar(200), -- PayMongo/Stripe payment intent ID
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_payments_reference ON payments(reference);
CREATE INDEX idx_payments_payer ON payments(payer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

COMMENT ON TABLE payments IS 'All payment transactions in the system';
COMMENT ON COLUMN payments.qr_code_url IS 'PayMongo QR code URL for GCash/Maya payments';
COMMENT ON COLUMN payments.payment_intent_id IS 'External payment provider transaction ID';

-- Split payment participants
CREATE TABLE reservation_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email varchar(255) NOT NULL,
  phone varchar(20),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_id uuid REFERENCES payments(id),
  status varchar(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  paid_at timestamptz,
  payment_link varchar(500),
  reminder_sent_count int DEFAULT 0,
  last_reminder_sent timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservation_splits_reservation ON reservation_splits(reservation_id);
CREATE INDEX idx_reservation_splits_user ON reservation_splits(user_id);
CREATE INDEX idx_reservation_splits_status ON reservation_splits(status);

COMMENT ON TABLE reservation_splits IS 'Individual participant shares in split payment reservations';
COMMENT ON COLUMN reservation_splits.payment_link IS 'Unique payment link sent to each participant';

-- =====================================================
-- QUEUE MANAGEMENT
-- =====================================================

-- Queue sessions - organized play sessions at courts
CREATE TABLE queue_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  organizer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  mode varchar(20) NOT NULL DEFAULT 'casual' 
    CHECK (mode IN ('casual', 'competitive')),
  game_format varchar(20) DEFAULT 'doubles' 
    CHECK (game_format IN ('singles', 'doubles', 'mixed')),
  max_players smallint NOT NULL DEFAULT 12,
  current_players_count int DEFAULT 0,
  total_games_played int DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'open' 
    CHECK (status IN ('draft', 'open', 'active', 'paused', 'closed', 'cancelled')),
  cost_per_game numeric(9,2),
  is_public boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb DEFAULT '{}',
  CHECK (end_time > start_time)
);

CREATE INDEX idx_queue_court ON queue_sessions(court_id);
CREATE INDEX idx_queue_organizer ON queue_sessions(organizer_id);
CREATE INDEX idx_queue_time ON queue_sessions(start_time, end_time);
CREATE INDEX idx_queue_status ON queue_sessions(status);
CREATE INDEX idx_queue_public ON queue_sessions(is_public) WHERE is_public = true;

COMMENT ON TABLE queue_sessions IS 'Organized play sessions where players rotate through games';
COMMENT ON COLUMN queue_sessions.mode IS 'Casual (first-come-first-serve) or competitive (skill-based matching)';
COMMENT ON COLUMN queue_sessions.game_format IS 'Singles (2 players), doubles (4 players), or mixed';
COMMENT ON COLUMN queue_sessions.settings IS 'Additional session settings (skill range, auto-match rules, etc.)';

-- Queue participants - players who join a queue session
CREATE TABLE queue_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id uuid NOT NULL REFERENCES queue_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  skill_at_join smallint, -- snapshot of skill level when joined
  games_played int DEFAULT 0,
  games_won int DEFAULT 0,
  games_lost int DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'waiting' 
    CHECK (status IN ('waiting', 'playing', 'completed', 'left')),
  payment_status varchar(20) NOT NULL DEFAULT 'unpaid' 
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  amount_owed numeric(9,2) DEFAULT 0,
  notes text,
  UNIQUE (queue_session_id, user_id)
);

CREATE INDEX idx_queue_participants_session ON queue_participants(queue_session_id);
CREATE INDEX idx_queue_participants_user ON queue_participants(user_id);
CREATE INDEX idx_queue_participants_status ON queue_participants(status);

COMMENT ON TABLE queue_participants IS 'Players participating in a queue session';
COMMENT ON COLUMN queue_participants.skill_at_join IS 'Snapshot of player skill for fair matching during session';
COMMENT ON COLUMN queue_participants.amount_owed IS 'Total amount owed based on games played';

-- =====================================================
-- MATCHES/GAMES
-- =====================================================

-- Individual matches/games played
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id uuid REFERENCES queue_sessions(id) ON DELETE SET NULL,
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  match_number int, -- sequence number within session (Game 1, Game 2, etc.)
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  game_format varchar(20) DEFAULT 'doubles' 
    CHECK (game_format IN ('singles', 'doubles')),
  player_a uuid[] NOT NULL, -- team A player IDs (1 for singles, 2 for doubles)
  player_b uuid[] NOT NULL, -- team B player IDs
  score_a int,
  score_b int,
  winner varchar(10) CHECK (winner IN ('team_a', 'team_b', 'draw')),
  duration_minutes int, -- actual game duration
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_matches_queue_session ON matches(queue_session_id);
CREATE INDEX idx_matches_court ON matches(court_id);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);
CREATE INDEX idx_matches_status ON matches(status);

COMMENT ON TABLE matches IS 'Individual badminton games/matches';
COMMENT ON COLUMN matches.player_a IS 'Array of user IDs for team A (1 player for singles, 2 for doubles)';
COMMENT ON COLUMN matches.match_number IS 'Sequential game number within a queue session';

-- Match participants (denormalized for easier querying)
CREATE TABLE match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team varchar(10) NOT NULL CHECK (team IN ('team_a', 'team_b')),
  won boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_participants_match ON match_participants(match_id);
CREATE INDEX idx_match_participants_user ON match_participants(user_id);

COMMENT ON TABLE match_participants IS 'Individual player participation in matches (denormalized for queries)';

-- =====================================================
-- PAYMENT SPLITS (for queue sessions)
-- =====================================================

-- Payment splits (for queue session cost sharing)
CREATE TABLE payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  queue_session_id uuid REFERENCES queue_sessions(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  settled boolean NOT NULL DEFAULT false,
  settled_at timestamptz
);

CREATE INDEX idx_payment_splits_payment ON payment_splits(payment_id);
CREATE INDEX idx_payment_splits_user ON payment_splits(user_id);
CREATE INDEX idx_payment_splits_settled ON payment_splits(settled);

COMMENT ON TABLE payment_splits IS 'Individual payment shares for split payments (queue sessions, reservations)';

-- =====================================================
-- PRICING & DISCOUNTS
-- =====================================================

-- Discount rules for venues
CREATE TABLE discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  discount_type varchar(50) NOT NULL 
    CHECK (discount_type IN ('multi_day', 'early_bird', 'group', 'loyalty', 'promotional')),
  conditions jsonb NOT NULL, -- {"min_days": 3, "max_days": 4} or {"advance_days": 7}
  discount_percentage numeric(5,2),
  discount_amount numeric(12,2),
  priority int DEFAULT 0, -- for conflict resolution (higher = higher priority)
  is_active boolean DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses int,
  current_uses int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  CHECK ((discount_percentage IS NOT NULL AND discount_amount IS NULL) OR 
         (discount_percentage IS NULL AND discount_amount IS NOT NULL))
);

CREATE INDEX idx_discount_rules_venue ON discount_rules(venue_id);
CREATE INDEX idx_discount_rules_type ON discount_rules(discount_type);
CREATE INDEX idx_discount_rules_active ON discount_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE discount_rules IS 'Configurable discount rules for venues';
COMMENT ON COLUMN discount_rules.conditions IS 'JSON conditions for discount eligibility (varies by type)';
COMMENT ON COLUMN discount_rules.priority IS 'Used to resolve conflicts when multiple discounts apply';

-- Holiday and special event pricing
CREATE TABLE holiday_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  pricing_type varchar(20) NOT NULL CHECK (pricing_type IN ('surcharge', 'discount')),
  adjustment_type varchar(20) NOT NULL CHECK (adjustment_type IN ('percentage', 'fixed')),
  adjustment_value numeric(12,2) NOT NULL,
  applies_to_days varchar(50)[], -- ['monday', 'tuesday', ...] or NULL for all days
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_holiday_pricing_venue ON holiday_pricing(venue_id);
CREATE INDEX idx_holiday_pricing_dates ON holiday_pricing(start_date, end_date);
CREATE INDEX idx_holiday_pricing_active ON holiday_pricing(is_active) WHERE is_active = true;

COMMENT ON TABLE holiday_pricing IS 'Special pricing for holidays and events';
COMMENT ON COLUMN holiday_pricing.applies_to_days IS 'Specific days of week, NULL means all days in date range';

-- Promotional codes
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE, -- NULL means platform-wide
  description text,
  discount_percentage numeric(5,2),
  discount_amount numeric(12,2),
  min_booking_amount numeric(12,2),
  max_discount_amount numeric(12,2),
  max_uses int,
  max_uses_per_user int,
  current_uses int DEFAULT 0,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  CHECK ((discount_percentage IS NOT NULL AND discount_amount IS NULL) OR 
         (discount_percentage IS NULL AND discount_amount IS NOT NULL))
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_venue ON promo_codes(venue_id);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active, valid_from, valid_until) 
  WHERE is_active = true;

COMMENT ON TABLE promo_codes IS 'Promotional discount codes';

-- Promo code usage tracking
CREATE TABLE promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  discount_applied numeric(12,2) NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_usage_code ON promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_usage_user ON promo_code_usage(user_id);

COMMENT ON TABLE promo_code_usage IS 'Tracks promo code redemptions';

-- =====================================================
-- RATINGS & REVIEWS
-- =====================================================

-- Main ratings table (for venues, courts, and players)
CREATE TABLE ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating_type varchar(20) NOT NULL CHECK (rating_type IN ('venue', 'court', 'player')),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  court_id uuid REFERENCES courts(id) ON DELETE CASCADE,
  rated_player_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL, -- for verification
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL, -- for player ratings
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  categories jsonb, -- {"quality": 5, "cleanliness": 4, "facilities": 5, "value": 4}
  review text,
  photos text[], -- array of image URLs
  verified_booking boolean DEFAULT false,
  helpful_count int DEFAULT 0,
  is_anonymous boolean DEFAULT false, -- for player ratings
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (rating_type = 'venue' AND venue_id IS NOT NULL AND court_id IS NULL AND rated_player_id IS NULL) OR
    (rating_type = 'court' AND court_id IS NOT NULL AND venue_id IS NULL AND rated_player_id IS NULL) OR
    (rating_type = 'player' AND rated_player_id IS NOT NULL AND venue_id IS NULL AND court_id IS NULL)
  )
);

CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_type ON ratings(rating_type);
CREATE INDEX idx_ratings_venue ON ratings(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX idx_ratings_court ON ratings(court_id) WHERE court_id IS NOT NULL;
CREATE INDEX idx_ratings_player ON ratings(rated_player_id) WHERE rated_player_id IS NOT NULL;
CREATE INDEX idx_ratings_verified ON ratings(verified_booking) WHERE verified_booking = true;

COMMENT ON TABLE ratings IS 'Reviews and ratings for venues, courts, and players';
COMMENT ON COLUMN ratings.categories IS 'Breakdown ratings by category (varies by type)';
COMMENT ON COLUMN ratings.verified_booking IS 'True if rater actually made a booking (prevents fake reviews)';

-- Player-specific ratings (more detailed for mutual post-match ratings)
CREATE TABLE player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sportsmanship_score smallint CHECK (sportsmanship_score BETWEEN 1 AND 5),
  skill_accuracy_score smallint CHECK (skill_accuracy_score BETWEEN 1 AND 5),
  reliability_score smallint CHECK (reliability_score BETWEEN 1 AND 5),
  would_play_again boolean,
  comments text,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, rater_id, rated_id)
);

CREATE INDEX idx_player_ratings_match ON player_ratings(match_id);
CREATE INDEX idx_player_ratings_rated ON player_ratings(rated_id);

COMMENT ON TABLE player_ratings IS 'Detailed post-match player ratings (mutual ratings)';

-- Rating responses (venue owners can respond to reviews)
CREATE TABLE rating_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id uuid NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rating_responses_rating ON rating_responses(rating_id);
CREATE INDEX idx_rating_responses_responder ON rating_responses(responder_id);

COMMENT ON TABLE rating_responses IS 'Venue owner responses to reviews';

-- Rating helpful votes
CREATE TABLE rating_helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id uuid NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rating_id, user_id)
);

CREATE INDEX idx_rating_helpful_rating ON rating_helpful_votes(rating_id);

COMMENT ON TABLE rating_helpful_votes IS 'Users can mark reviews as helpful or not helpful';

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- User notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL, -- reservation_confirmed, queue_turn, payment_required, etc.
  title varchar(200) NOT NULL,
  message text NOT NULL,
  action_url varchar(500), -- deep link to relevant screen
  payload jsonb, -- additional notification data
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_via varchar(50)[], -- ['push', 'email', 'sms']
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at);

COMMENT ON TABLE notifications IS 'In-app and external notifications for users';
COMMENT ON COLUMN notifications.sent_via IS 'Delivery channels used for this notification';

-- =====================================================
-- AUDIT & LOGGING
-- =====================================================

-- Audit log for important actions
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL, -- created_reservation, cancelled_queue, updated_pricing, etc.
  object_type varchar(50), -- reservation, queue_session, venue, etc.
  object_id uuid,
  old_values jsonb, -- snapshot before change
  new_values jsonb, -- snapshot after change
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_object ON audit_logs(object_type, object_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of important system actions';

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

-- Venue rating statistics
CREATE MATERIALIZED VIEW venue_rating_stats AS
SELECT 
  venue_id,
  COUNT(*) as total_reviews,
  AVG(rating) as average_rating,
  COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
  COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
  COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
  COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
  COUNT(*) FILTER (WHERE rating = 1) as one_star_count,
  COUNT(*) FILTER (WHERE verified_booking = true) as verified_review_count
FROM ratings
WHERE rating_type = 'venue' AND venue_id IS NOT NULL
GROUP BY venue_id;

CREATE UNIQUE INDEX ON venue_rating_stats(venue_id);

COMMENT ON MATERIALIZED VIEW venue_rating_stats IS 'Aggregated rating statistics for venues (refresh periodically)';

-- Player statistics
CREATE MATERIALIZED VIEW player_stats AS
SELECT 
  p.id as player_id,
  p.user_id,
  p.total_games_played,
  p.total_wins,
  p.total_losses,
  CASE 
    WHEN p.total_games_played > 0 
    THEN ROUND((p.total_wins::numeric / p.total_games_played::numeric) * 100, 2)
    ELSE 0 
  END as win_rate,
  p.rating,
  COUNT(DISTINCT qp.queue_session_id) as sessions_attended,
  AVG(pr.sportsmanship_score) as avg_sportsmanship,
  AVG(pr.skill_accuracy_score) as avg_skill_accuracy,
  AVG(pr.reliability_score) as avg_reliability
FROM players p
LEFT JOIN queue_participants qp ON p.user_id = qp.user_id
LEFT JOIN player_ratings pr ON p.user_id = pr.rated_id
GROUP BY p.id, p.user_id, p.total_games_played, p.total_wins, p.total_losses, p.rating;

CREATE UNIQUE INDEX ON player_stats(player_id);

COMMENT ON MATERIALIZED VIEW player_stats IS 'Aggregated player statistics and ratings';

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

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
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

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update reservation status based on splits
CREATE OR REPLACE FUNCTION update_reservation_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_splits int;
  paid_splits int;
  reservation_record RECORD;
BEGIN
  -- Get reservation details
  SELECT * INTO reservation_record
  FROM reservations
  WHERE id = NEW.reservation_id;

  -- Only process if payment_type is 'split'
  IF reservation_record.payment_type = 'split' THEN
    -- Count total and paid splits
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'paid')
    INTO total_splits, paid_splits
    FROM reservation_splits
    WHERE reservation_id = NEW.reservation_id;

    -- Update reservation status
    IF paid_splits = total_splits THEN
      UPDATE reservations
      SET status = 'fully_paid', total_paid = total_amount
      WHERE id = NEW.reservation_id;
    ELSIF paid_splits > 0 THEN
      UPDATE reservations
      SET status = 'partially_paid',
          total_paid = (
            SELECT COALESCE(SUM(amount), 0)
            FROM reservation_splits
            WHERE reservation_id = NEW.reservation_id
            AND status = 'paid'
          )
      WHERE id = NEW.reservation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reservation_on_split_payment
AFTER INSERT OR UPDATE ON reservation_splits
FOR EACH ROW
EXECUTE FUNCTION update_reservation_payment_status();

-- Function to update queue participant count
CREATE OR REPLACE FUNCTION update_queue_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE queue_sessions
    SET current_players_count = current_players_count + 1
    WHERE id = NEW.queue_session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE queue_sessions
    SET current_players_count = GREATEST(0, current_players_count - 1)
    WHERE id = OLD.queue_session_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_queue_count_on_participant_change
AFTER INSERT OR DELETE ON queue_participants
FOR EACH ROW
EXECUTE FUNCTION update_queue_participant_count();

-- Function to update player total games
CREATE OR REPLACE FUNCTION update_player_game_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update all participating players
    UPDATE players
    SET 
      total_games_played = total_games_played + 1,
      total_wins = total_wins + CASE 
        WHEN mp.won = true THEN 1 
        ELSE 0 
      END,
      total_losses = total_losses + CASE 
        WHEN mp.won = false THEN 1 
        ELSE 0 
      END
    FROM match_participants mp
    WHERE players.user_id = mp.user_id
    AND mp.match_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_stats_on_match_complete
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_game_stats();

-- Function to update rating helpful count
CREATE OR REPLACE FUNCTION update_rating_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ratings
    SET helpful_count = helpful_count + CASE WHEN NEW.is_helpful THEN 1 ELSE -1 END
    WHERE id = NEW.rating_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE ratings
    SET helpful_count = helpful_count + CASE 
      WHEN NEW.is_helpful AND NOT OLD.is_helpful THEN 2
      WHEN NOT NEW.is_helpful AND OLD.is_helpful THEN -2
      ELSE 0
    END
    WHERE id = NEW.rating_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ratings
    SET helpful_count = helpful_count + CASE WHEN OLD.is_helpful THEN -1 ELSE 1 END
    WHERE id = OLD.rating_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_helpful_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON rating_helpful_votes
FOR EACH ROW
EXECUTE FUNCTION update_rating_helpful_count();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Players can read their own player profile
CREATE POLICY players_select_own ON players
  FOR SELECT
  USING (auth.uid() = user_id);

-- Players can update their own player profile
CREATE POLICY players_update_own ON players
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can read their own reservations
CREATE POLICY reservations_select_own ON reservations
  FOR SELECT
  USING (auth.uid() = organizer_id);

-- Users can read their own queue participations
CREATE POLICY queue_participants_select_own ON queue_participants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (auth.uid() = payer_id);

-- Users can read their own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- SAMPLE DATA (for development/testing)
-- =====================================================

-- Note: This section should be removed or commented out in production

-- Sample venue
INSERT INTO venues (name, description, address, latitude, longitude, phone, email, is_active) VALUES
  ('Fewddicts Badminton Court', 
   'Premier badminton facility in Zamboanga City with modern amenities',
   'Tetuan, Zamboanga City, Philippines',
   6.9214,
   122.0790,
   '+63 912 345 6789',
   'fewddicts@example.com',
   true);

COMMENT ON DATABASE rallio IS 'Rallio - Badminton Court Finder and Queue Management System';
