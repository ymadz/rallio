# V1 vs V2 Schema Changes

## 🔄 Major Architectural Changes

### **1. Authentication System**
**V1 (Custom Auth):**
- `users` table with `password_hash` column
- Manual password management
- Custom email verification

**V2 (Supabase Auth):**
- `profiles` table linked to `auth.users` (Supabase's built-in auth)
- No password_hash in our tables (handled by Supabase)
- Automatic trigger creates profile on signup
- Integrated OAuth support (Google, etc.)

```sql
-- V1
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,  ❌ REMOVED
  ...
);

-- V2
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  ✅ Links to Supabase Auth
  email varchar(255) UNIQUE NOT NULL,
  -- No password_hash - handled by Supabase
  ...
);
```

---

## 📊 Table Changes Summary

### **Removed Tables (V1 → V2)**
1. ❌ `users` → Replaced by `profiles`
2. ❌ `match_participants` → Integrated into `matches.team_a_players[]` and `matches.team_b_players[]`
3. ❌ `ratings` → Split into `court_ratings` and `player_ratings`
4. ❌ `queue_entries` → Replaced by `queue_participants`
5. ❌ `court_amenity_map` → Renamed to `court_amenities`

### **Renamed Tables**
- `users` → `profiles`
- `queue_entries` → `queue_participants`
- `court_amenity_map` → `court_amenities`

### **New Tables in V2**
1. ✅ `profiles` (replaces users)
2. ✅ `court_ratings` (split from ratings)
3. ✅ `player_ratings` (split from ratings)
4. ✅ `queue_participants` (replaces queue_entries)
5. ✅ `court_availabilities` (NEW - Phase 1)
6. ✅ `discount_rules` (NEW - Phase 1)
7. ✅ `holiday_pricing` (NEW - Phase 1)
8. ✅ `promo_codes` (NEW - Phase 1)
9. ✅ `promo_code_usage` (NEW - Phase 2)
10. ✅ `audit_logs` (NEW - Phase 2)
11. ✅ `rating_responses` (NEW - Phase 2)
12. ✅ `rating_helpful_votes` (NEW - Phase 2)
13. ✅ `notification_preferences` (NEW - Phase 2)

---

## 🔍 Detailed Table Changes

### **1. users → profiles**

**V1 Structure:**
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  display_name varchar(100),
  phone varchar(20),
  avatar_url varchar(500),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**V2 Structure:**
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  display_name varchar(100),
  first_name varchar(50),              -- ✅ NEW
  middle_initial varchar(5),           -- ✅ NEW
  last_name varchar(50),               -- ✅ NEW
  phone varchar(20),
  avatar_url varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  profile_completed boolean NOT NULL DEFAULT false,  -- ✅ NEW
  preferred_locale varchar(10) DEFAULT 'en',        -- ✅ NEW
  metadata jsonb DEFAULT '{}',                      -- ✅ NEW
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()     -- ✅ NEW
);
```

**Key Changes:**
- ❌ Removed `password_hash` (Supabase handles auth)
- ✅ Added `first_name`, `middle_initial`, `last_name`
- ✅ Added `profile_completed` flag
- ✅ Added `preferred_locale` for i18n
- ✅ Added `metadata` JSONB for flexibility
- ✅ Added `updated_at` with auto-update trigger
- ✅ Foreign key to `auth.users(id)`

---

### **2. players Table**

**V1 → V2 Changes:**
```sql
-- V1
user_id uuid REFERENCES users(id)  ❌

-- V2
user_id uuid REFERENCES profiles(id)  ✅
```

**Key Change:**
- Foreign key now points to `profiles` instead of `users`

---

### **3. ratings → court_ratings + player_ratings**

**V1 Structure (Single Table):**
```sql
CREATE TABLE ratings (
  id uuid PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id),
  match_id uuid REFERENCES matches(id),
  rater_id uuid REFERENCES users(id),
  rated_id uuid REFERENCES users(id),
  rating_type varchar(20),  -- 'court', 'player'
  overall_rating smallint,
  sportsmanship smallint,
  skill_accuracy smallint,
  comment text,
  created_at timestamptz
);
```

**V2 Structure (Split Tables):**

**court_ratings:**
```sql
CREATE TABLE court_ratings (
  id uuid PRIMARY KEY,
  court_id uuid NOT NULL REFERENCES courts(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  reservation_id uuid REFERENCES reservations(id),
  overall_rating smallint NOT NULL,
  quality_rating smallint,        -- ✅ NEW
  cleanliness_rating smallint,    -- ✅ NEW
  facilities_rating smallint,     -- ✅ NEW
  value_rating smallint,          -- ✅ NEW
  review text,
  is_verified boolean DEFAULT false,  -- ✅ NEW
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,    -- ✅ NEW
  UNIQUE (court_id, user_id, reservation_id)
);
```

**player_ratings:**
```sql
CREATE TABLE player_ratings (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id),
  rater_id uuid NOT NULL REFERENCES profiles(id),
  rated_id uuid NOT NULL REFERENCES profiles(id),
  sportsmanship smallint,
  skill_accuracy smallint,
  reliability smallint,           -- ✅ NEW
  would_play_again boolean,       -- ✅ NEW
  comment text,
  is_anonymous boolean DEFAULT true,  -- ✅ NEW
  created_at timestamptz NOT NULL,
  UNIQUE (match_id, rater_id, rated_id)
);
```

**Key Changes:**
- ✅ Split into specialized tables
- ✅ Court ratings: Added category ratings (quality, cleanliness, facilities, value)
- ✅ Player ratings: Added reliability, would_play_again
- ✅ Added anonymity option for player ratings
- ✅ Added verification badge for court ratings

---

### **4. matches Table**

**V1 Structure:**
```sql
-- Used match_participants junction table
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  ...
);

CREATE TABLE match_participants (
  match_id uuid REFERENCES matches(id),
  player_id uuid REFERENCES players(id),
  team varchar(10),  -- 'team_a', 'team_b'
  ...
);
```

**V2 Structure:**
```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  queue_session_id uuid REFERENCES queue_sessions(id),
  court_id uuid REFERENCES courts(id),
  match_number int,
  game_format varchar(20) DEFAULT 'doubles',
  team_a_players uuid[] NOT NULL,  -- ✅ Array instead of junction table
  team_b_players uuid[] NOT NULL,  -- ✅ Array instead of junction table
  score_a int,
  score_b int,
  winner varchar(10),
  started_at timestamptz,
  completed_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'
);
```

**Key Changes:**
- ✅ Replaced junction table with UUID arrays
- ✅ Simplified schema (fewer joins)
- ✅ Added `match_number` for sequencing
- ✅ Added `metadata` JSONB

---

### **5. queue_entries → queue_participants**

**V1 → V2 Changes:**
```sql
-- V1
CREATE TABLE queue_entries (
  queue_session_id uuid REFERENCES queue_sessions(id),
  player_id uuid REFERENCES players(id),
  ...
);

-- V2
CREATE TABLE queue_participants (
  queue_session_id uuid REFERENCES queue_sessions(id),
  user_id uuid REFERENCES profiles(id),  -- ✅ References profiles directly
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,                    -- ✅ NEW
  games_played int DEFAULT 0,
  games_won int DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'waiting',
  payment_status varchar(20) NOT NULL DEFAULT 'unpaid',  -- ✅ NEW
  amount_owed numeric(9,2) DEFAULT 0,                    -- ✅ NEW
  ...
);
```

**Key Changes:**
- ✅ Renamed to `queue_participants`
- ✅ References `profiles` instead of `players`
- ✅ Added `left_at` for tracking departures
- ✅ Added `payment_status` and `amount_owed`

---

### **6. reservations Table**

**V1 → V2 Changes:**
```sql
-- V1
user_id uuid REFERENCES users(id)  ❌

-- V2
user_id uuid REFERENCES profiles(id)  ✅
payment_type varchar(20) DEFAULT 'full',  -- ✅ NEW
metadata jsonb DEFAULT '{}',              -- ✅ NEW
```

**Key Changes:**
- ✅ References `profiles`
- ✅ Added `payment_type` ('full', 'split')
- ✅ Added `metadata` for flexibility

---

### **7. payments Table**

**V1 → V2 Changes:**
```sql
-- V2 Added:
qr_code_url varchar(500),          -- ✅ NEW (PayMongo QR)
expires_at timestamptz,            -- ✅ NEW
refunded_at timestamptz,           -- ✅ NEW
refund_reason text,                -- ✅ NEW
metadata jsonb DEFAULT '{}'        -- ✅ NEW
```

---

### **8. venues Table**

**V1 → V2 Changes:**
```sql
-- V2 Added:
opening_hours jsonb,               -- ✅ NEW (structured schedule)
metadata jsonb DEFAULT '{}'        -- ✅ NEW
```

---

## 🆕 Completely New Tables (Phase 1 & 2)

### **Phase 1: Critical Features**

#### **1. court_availabilities**
```sql
-- Prevents double-booking by tracking time slots
CREATE TABLE court_availabilities (
  court_id uuid REFERENCES courts(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_reserved boolean DEFAULT false,
  reservation_id uuid REFERENCES reservations(id)
);
```

#### **2. discount_rules**
```sql
-- Multi-day, group, loyalty, early bird discounts
CREATE TABLE discount_rules (
  venue_id uuid REFERENCES venues(id),
  name varchar(100),
  discount_type varchar(20),  -- 'multi_day', 'group', 'loyalty', 'early_bird'
  discount_value numeric(5,2),
  discount_unit varchar(10),  -- 'percent', 'fixed'
  min_days int,
  min_players int,
  ...
);
```

#### **3. holiday_pricing**
```sql
-- Holiday surcharges and special event pricing
CREATE TABLE holiday_pricing (
  venue_id uuid REFERENCES venues(id),
  name varchar(100),
  start_date date,
  end_date date,
  price_multiplier numeric(4,2),
  fixed_surcharge numeric(9,2)
);
```

#### **4. promo_codes**
```sql
-- Promotional discount codes
CREATE TABLE promo_codes (
  code varchar(50) UNIQUE,
  discount_type varchar(10),  -- 'percent', 'fixed'
  discount_value numeric(9,2),
  max_uses int,
  max_uses_per_user int,
  valid_from timestamptz,
  valid_until timestamptz
);
```

### **Phase 2: Enhanced Features**

#### **5. promo_code_usage**
```sql
-- Tracks who used which promo codes
CREATE TABLE promo_code_usage (
  promo_code_id uuid REFERENCES promo_codes(id),
  user_id uuid REFERENCES profiles(id),
  reservation_id uuid REFERENCES reservations(id),
  discount_amount numeric(9,2),
  used_at timestamptz
);
```

#### **6. audit_logs**
```sql
-- Platform-wide activity tracking
CREATE TABLE audit_logs (
  user_id uuid REFERENCES profiles(id),
  action varchar(50),
  resource_type varchar(50),
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text
);
```

#### **7. rating_responses**
```sql
-- Venue owner responses to reviews
CREATE TABLE rating_responses (
  rating_id uuid REFERENCES court_ratings(id),
  venue_id uuid REFERENCES venues(id),
  responder_id uuid REFERENCES profiles(id),
  response text
);
```

#### **8. rating_helpful_votes**
```sql
-- Community votes on review helpfulness
CREATE TABLE rating_helpful_votes (
  rating_id uuid REFERENCES court_ratings(id),
  user_id uuid REFERENCES profiles(id),
  is_helpful boolean
);
```

#### **9. notification_preferences**
```sql
-- User notification channel preferences
CREATE TABLE notification_preferences (
  user_id uuid REFERENCES profiles(id),
  email_enabled boolean,
  push_enabled boolean,
  sms_enabled boolean,
  reservation_reminders boolean,
  queue_notifications boolean
);
```

---

## 📈 Statistics

### **V1 Schema**
- Total Tables: **18**
- Custom Auth: ❌ Yes (password_hash)
- Dynamic Pricing: ❌ Limited
- Availability Tracking: ❌ No
- Audit Logging: ❌ No

### **V2 Schema (Complete)**
- Total Tables: **26**
- Supabase Auth: ✅ Yes
- Dynamic Pricing: ✅ Full (discounts, holidays, promos)
- Availability Tracking: ✅ Yes
- Audit Logging: ✅ Yes
- Enhanced Ratings: ✅ Yes (responses, votes)
- Notification Prefs: ✅ Yes

---

## 🔐 RLS Policy Changes

**V1:**
- Basic RLS policies
- Manual auth token checking

**V2:**
- Comprehensive RLS on all 26 tables
- Uses Supabase `auth.uid()` function
- More granular permissions
- Venue owner specific policies

---

## 🚀 Migration Path

1. **Drop all V1 tables** using `drop_all_tables_complete.sql`
2. **Run V2 schema** with `001_initial_schema_v2.sql`
3. **Data migration** (if preserving data):
   - Export V1 `users` → Transform → Import to V2 `profiles`
   - Create Supabase Auth users programmatically
   - Link profiles via trigger

---

## ✅ Recommendation

**Use V2 Schema** - It provides:
- ✅ Modern auth (Supabase)
- ✅ Complete pricing system
- ✅ Better security (RLS)
- ✅ Scalable architecture
- ✅ Full feature support for your docs
