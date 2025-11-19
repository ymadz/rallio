# Current Database Features (V2 Complete Schema)

## 📊 Database Statistics
- **Total Tables:** 26
- **Total Indexes:** 75+
- **Total RLS Policies:** 50+
- **Total Triggers:** 10+
- **Total Functions:** 3

---

## ✅ Features Your Current Database Can Support

### 🔐 **1. Authentication & User Management**

#### **Features:**
- ✅ Supabase Auth integration (email/password, OAuth)
- ✅ User profiles with extended information
- ✅ Role-based access control (Player, Court Admin, Queue Master, Global Admin)
- ✅ Profile completion tracking
- ✅ Multi-language support (preferred_locale)
- ✅ Avatar upload and management
- ✅ Flexible metadata storage

#### **Database Support:**
```
Tables: profiles, roles, user_roles, players
Triggers: handle_new_user (auto-creates profile on signup)
RLS: User-specific data access
```

#### **What You Can Build:**
- User registration with email verification
- Social login (Google, Facebook)
- Profile setup wizard
- Player skill level selection (1-10)
- Play style preferences
- Multi-factor authentication (via Supabase)

---

### 🏢 **2. Venue & Court Management**

#### **Features:**
- ✅ Multi-venue support
- ✅ Multiple courts per venue
- ✅ Geospatial court search (latitude/longitude)
- ✅ Distance calculation (PostGIS earthdistance)
- ✅ Court amenities (12 pre-populated)
- ✅ Court images with ordering
- ✅ Venue verification system
- ✅ Operating hours (JSONB structured)
- ✅ Court surface types (indoor/outdoor, wood/synthetic)
- ✅ Hourly rate pricing per court

#### **Database Support:**
```
Tables: venues, courts, amenities, court_amenities, court_images
Indexes: Geospatial (GIST), active courts, venue owner
Functions: ll_to_earth, earth_distance
```

#### **What You Can Build:**
- Court finder with "Near Me" search
- Distance-based sorting
- Filter by amenities (parking, AC, WiFi, etc.)
- Court gallery with photo carousel
- Venue profiles with contact info
- Court admin dashboard
- Multi-court management

---

### 📅 **3. Reservation & Booking System**

#### **Features:**
- ✅ Time-based court reservations
- ✅ Multi-day bookings
- ✅ Reservation status tracking (pending, confirmed, cancelled, completed, no_show)
- ✅ Split payment support
- ✅ Booking cancellation with reason tracking
- ✅ Reservation notes
- ✅ Flexible metadata storage
- ✅ **Time slot availability tracking** (NEW - Phase 1)
- ✅ **Double-booking prevention** (NEW - Phase 1)

#### **Database Support:**
```
Tables: reservations, court_availabilities (NEW)
Indexes: Time-based lookups, user reservations, court bookings
Constraints: end_time > start_time validation
```

#### **What You Can Build:**
- Calendar-based booking interface
- Real-time availability checking
- Group bookings with multiple participants
- Booking confirmation emails
- Cancellation with refund workflow
- Booking history
- Upcoming reservations dashboard
- Time slot blocking

---

### 💳 **4. Payment & Billing System**

#### **Features:**
- ✅ Full payment tracking
- ✅ Split payment logic
- ✅ PayMongo integration (reference, external_id)
- ✅ QR code payment URLs
- ✅ Payment status workflow
- ✅ Refund tracking with reason
- ✅ Payment expiration
- ✅ Transaction history
- ✅ Multiple payment methods
- ✅ Payment splits for groups
- ✅ Per-participant payment tracking

#### **Database Support:**
```
Tables: payments, payment_splits, reservations (payment_type)
Indexes: Payment reference, user payments, reservation payments
Constraints: Amount validation (>= 0)
```

#### **What You Can Build:**
- PayMongo QR code generation
- GCash/Maya payment flow
- Split payment invitation system
- Payment deadline enforcement
- Auto-refund on failed group bookings
- Payment history dashboard
- Receipt generation
- Payment confirmation webhooks

---

### 💰 **5. Dynamic Pricing & Discounts** (NEW - Phase 1)

#### **Features:**
- ✅ Multi-day booking discounts
- ✅ Group booking discounts
- ✅ Loyalty rewards
- ✅ Early bird discounts
- ✅ Holiday/special event pricing
- ✅ Price multipliers and fixed surcharges
- ✅ Promotional codes
- ✅ Promo code usage tracking
- ✅ Max usage limits (total and per user)
- ✅ Date-based discount validity
- ✅ Discount priority system
- ✅ Venue-specific or platform-wide promos

#### **Database Support:**
```
Tables: discount_rules, holiday_pricing, promo_codes, promo_code_usage
Indexes: Active discounts, venue-specific rules, promo code lookup
Constraints: Date ranges, discount values, usage limits
```

#### **What You Can Build:**
- Automatic discount application
- "Book 3+ days, get 10% off"
- Weekend/holiday surcharges
- Promo code system ("RALLIO50")
- Early bird specials
- Loyalty program
- Dynamic pricing engine
- Discount stacking rules
- Pricing preview calculator

---

### 🎯 **6. Queue Management System**

#### **Features:**
- ✅ Queue session creation (casual/competitive modes)
- ✅ Player join/leave tracking
- ✅ Game format support (singles/doubles/mixed)
- ✅ Max player limits
- ✅ Real-time player count updates
- ✅ Skill-based queue filtering
- ✅ Cost per game tracking
- ✅ Public/private sessions
- ✅ Queue status workflow
- ✅ Game statistics per participant
- ✅ Payment status per participant

#### **Database Support:**
```
Tables: queue_sessions, queue_participants, matches
Triggers: update_queue_participant_count (auto-updates player count)
Indexes: Session status, time-based lookups, user participation
```

#### **What You Can Build:**
- Queue session dashboard
- Real-time player list
- "Join Queue" button
- Queue position tracking
- Skill-based matchmaking
- Auto-team balancing
- Game assignment system
- Per-game billing
- Session summary reports
- Queue Master controls

---

### 🏆 **7. Match & Game Tracking**

#### **Features:**
- ✅ Match creation (singles/doubles)
- ✅ Team composition (array-based)
- ✅ Score tracking
- ✅ Winner determination
- ✅ Match status workflow
- ✅ Match numbering
- ✅ Time tracking (started_at, completed_at)
- ✅ Queue session linking
- ✅ Court assignment

#### **Database Support:**
```
Tables: matches
Arrays: team_a_players[], team_b_players[] (UUID arrays)
Indexes: Match status, queue session matches, court matches
```

#### **What You Can Build:**
- Live match scoreboard
- Match history
- Win/loss records
- Player statistics
- Match scheduling
- Automated matchmaking
- Tournament brackets (future)
- Team balancing algorithm

---

### ⭐ **8. Ratings & Reviews System**

#### **Features:**
- ✅ Court ratings (5-star system)
- ✅ Category ratings (quality, cleanliness, facilities, value)
- ✅ Written reviews
- ✅ Verified booking badge
- ✅ Player-to-player ratings
- ✅ Sportsmanship scoring
- ✅ Skill accuracy verification
- ✅ Reliability tracking
- ✅ "Would play again" indicator
- ✅ Anonymous player ratings
- ✅ **Venue owner responses to reviews** (NEW - Phase 2)
- ✅ **Helpful/not helpful votes on reviews** (NEW - Phase 2)

#### **Database Support:**
```
Tables: court_ratings, player_ratings, rating_responses, rating_helpful_votes
Indexes: Court ratings, user ratings, rating lookup
Constraints: Unique (court, user, reservation) - prevents duplicate reviews
```

#### **What You Can Build:**
- Court review system
- Rating submission forms
- Average rating calculation
- Review moderation
- Venue response system
- Player reputation scores
- Verified player badges
- Post-match rating requests
- Review helpfulness voting
- Rating trends and analytics

---

### 🔔 **9. Notification System**

#### **Features:**
- ✅ In-app notifications
- ✅ Notification types (reservation, queue, payment, rating)
- ✅ Read/unread tracking
- ✅ Action URLs (deep linking)
- ✅ Timestamp tracking
- ✅ **User notification preferences** (NEW - Phase 2)
- ✅ **Channel preferences (email, push, SMS)** (NEW - Phase 2)
- ✅ **Feature-specific toggles** (NEW - Phase 2)

#### **Database Support:**
```
Tables: notifications, notification_preferences
Indexes: Unread notifications, user notifications
```

#### **What You Can Build:**
- Notification center
- Push notifications (with FCM integration)
- Email notifications
- SMS notifications
- Notification preferences page
- "Turn off queue notifications" option
- Booking reminders
- Payment confirmations
- Queue turn alerts
- Rating requests

---

### 📊 **10. Analytics & Audit System** (NEW - Phase 2)

#### **Features:**
- ✅ Platform-wide activity logging
- ✅ User action tracking
- ✅ Resource change tracking
- ✅ Old/new value comparison (JSONB)
- ✅ IP address logging
- ✅ User agent tracking
- ✅ Timestamp-based queries

#### **Database Support:**
```
Tables: audit_logs
Indexes: User actions, resource lookups, action types, time-based
```

#### **What You Can Build:**
- Admin audit dashboard
- Security monitoring
- User activity timeline
- Change history
- Dispute resolution evidence
- Compliance reporting
- Suspicious activity detection
- Performance analytics

---

## 🔒 Security Features

### **Row Level Security (RLS)**
- ✅ 26 tables with RLS enabled
- ✅ 50+ custom policies
- ✅ User-specific data access
- ✅ Role-based permissions
- ✅ Venue owner isolation
- ✅ Queue Master permissions
- ✅ Admin override capability

### **Data Protection**
- ✅ Foreign key constraints
- ✅ Check constraints (dates, amounts, ratings)
- ✅ Unique constraints (prevent duplicates)
- ✅ Cascade delete protection
- ✅ Time validation (end > start)

---

## 🚀 What You Can Build Right Now

### **Player Features:**
1. ✅ Account registration and login
2. ✅ Profile setup with skill level
3. ✅ Court finder with distance search
4. ✅ Filter courts by amenities/price
5. ✅ Book courts for specific times
6. ✅ Split payment with friends
7. ✅ Join queue sessions
8. ✅ Track match history
9. ✅ Rate courts and players
10. ✅ View notifications
11. ✅ Manage notification preferences
12. ✅ Use promo codes

### **Court Admin Features:**
1. ✅ Create venue profiles
2. ✅ Add multiple courts
3. ✅ Set pricing (hourly rates)
4. ✅ Configure amenities
5. ✅ Upload court images
6. ✅ Manage reservations
7. ✅ Set operating hours
8. ✅ Create discount rules
9. ✅ Set holiday pricing
10. ✅ Generate promo codes
11. ✅ Respond to reviews
12. ✅ View revenue analytics

### **Queue Master Features:**
1. ✅ Create queue sessions
2. ✅ Set skill requirements
3. ✅ Approve player requests
4. ✅ Assign players to matches
5. ✅ Track game counts
6. ✅ Calculate per-game costs
7. ✅ Close sessions
8. ✅ Generate session reports

### **Admin Features:**
1. ✅ Platform-wide monitoring
2. ✅ User management
3. ✅ Venue approval
4. ✅ Dispute resolution
5. ✅ Audit log review
6. ✅ Platform analytics
7. ✅ Security monitoring

---

## 📈 Sample Data Included

Your schema includes sample data for:
- ✅ 4 default roles (player, court_admin, queue_master, global_admin)
- ✅ 12 amenities (Parking, Restroom, AC, WiFi, etc.)
- ✅ 2 venues (Fewddicts, Zamboanga Badminton Center)
- ✅ 8 courts (4 per venue)
- ✅ Court-amenity mappings

---

## 🎯 Features NOT Yet Supported (Future)

The following require additional tables:
- ❌ Tournaments and brackets
- ❌ Team management
- ❌ Leagues and seasons
- ❌ Advanced messaging/chat
- ❌ Court equipment rental tracking
- ❌ Membership subscriptions

---

## ✅ Recommendation

**Your database is production-ready for:**
- Court discovery and booking
- Queue management
- Payment processing with splits
- Dynamic pricing and promos
- Ratings and reviews
- Notifications
- Basic analytics

**You can start building your MVP immediately!**
