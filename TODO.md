# Rallio - Development TODO List
*Last Updated: December 2, 2025*

## ✅ COMPLETED ITEMS

### USER Features
- [x] **Venue ratings and reviews** - reviews-section.tsx fixed, BookingReviewButton exists, ReviewModal works, migration 025 created for notifications
- [x] **Multi-hour booking (7pm-10pm example)** - booking-form.tsx has duration selector (1-6 hours), TimeSlotGrid shows multi-hour availability, validates consecutive slots, backend handles multi-hour bookings

### QUEUE MASTER Features
- [x] **Queue session approval workflow** - Migration 012 implements Court Admin approval requirement, approval page exists in court-admin area
- [x] **Queue session marks timeslot as booked** - Creates confirmed reservation when queue session is created, prevents double booking

### COURT ADMIN Features
- [x] **Reviews and ratings working** - reviews-management.tsx exists, Court Admins can view/respond to reviews, flag inappropriate content

---

## 🔴 HIGH PRIORITY (Must Fix)

### USER Features

#### Profile & Notifications
- [ ] **Make notifications functional**
  - Status: Not started
  - Description: Verify notification system is fully functional with real-time updates and proper notification creation
  - Notes: System exists but needs verification

#### Venue & Booking
- [x] **Venue finder map filters**
  - Status: ✅ COMPLETED
  - Description: Map filters now properly apply to venue results. Filters work for: search query, price range, amenities (AND logic), and minimum rating.
  - Implementation: Added allVenues state for original data, venues state for filtered display. Filters apply via useEffect when any filter changes.

- [x] **Venue photo album functionality**
  - Status: ✅ COMPLETED (Already working)
  - Description: Photo album correctly fetches and displays court images from database. Shows image gallery with lightbox, thumbnails, and navigation. Falls back to placeholder if no images exist.
  - Implementation: /courts/[id]/page.tsx collects all court_images, sorts by is_primary and display_order, passes to ImageGallery component.

- [ ] ~~**Play Together / Pay Together feature**~~
  - Status: **DISABLED - FUTURE FEATURE**
  - Priority: ~~HIGH~~ FUTURE
  - Requirements:
    1. Split payment UI
    2. Show participants payment status
    3. Reserve court when first person pays
    4. Require full payment from all before confirming
  - Current Issue: Pays full amount instead of splitting
  - **Note: Feature disabled for current release, planned for future version**

- [x] **Add platform fee to booking summary**
  - Status: ✅ COMPLETED (Already implemented)
  - Description: Platform fee system fully functional - shows in booking summary, admin can modify percentage/enable-disable
  - Implementation:
    - `BookingSummaryCard` displays "Platform Fee (X%)" line item
    - Admin dashboard at `/admin/settings` has "Platform Fees" tab for configuration
    - Fee stored in `platform_settings` table (migration 024)
    - Calculated via `checkout-store` using `getPlatformFeeAmount()`
    - Helper functions in `/lib/platform-settings.ts`
    - Default: 5% enabled, can be configured 0-100%

#### Queue System
- [x] **Queue dashboard - replace best position/shortest wait**
  - Status: ✅ COMPLETED
  - Description: Replaced 'best position' and 'shortest wait' stats with more useful metrics
  - Implementation:
    - Added "Games Played" stat - shows total games across all active queues
    - Added "Outstanding Balance" stat - shows total amount owed with orange warning when balance > 0
    - Modified `getMyQueues()` to include `userGamesPlayed` and `userAmountOwed` from participant record
    - Updated QueueSession interface with new optional fields

- [ ] **Queue payment & outstanding balance**
  - Status: Partially complete (2/3)
  - Requirements:
    1. ✅ User can't leave queue with unpaid balance - Already implemented in `leaveQueue()` backend action
    2. ❌ When queue ends, credit balance to account - **NOT IMPLEMENTED** (requires wallet system + migration)
    3. ✅ Show outstanding balance in queue dashboard - Added balance warning to queue cards and dashboard summary

#### Matches & Player Management
- [x] **Matches page with win/loss tracking**
  - Status: ✅ COMPLETED (Already implemented)
  - Priority: HIGH
  - Implementation:
    - Full matches page at `/matches` with filtering (all/wins/losses/draws)
    - `MatchStatsCard` shows: total games, wins, losses, draws, win rate
    - `MatchCard` displays individual match details with teams, scores, venue
    - Backend: `getPlayerMatchHistory()` and `getPlayerStats()` actions
    - Database: `matches` table tracks team compositions, scores, winners
    - **Competitive vs Casual**: Database has `mode` field ('casual'/'competitive') in queue_sessions - ✅ READY FOR ELO
    - Player ratings tracked in `players.rating` (default 1500)

- [x] **Skill level change validation**
  - Status: ✅ COMPLETED (Already implemented)
  - Priority: HIGH
  - Implementation:
    - Migration 025 adds `skill_level_updated_at` tracking column
    - `profile-actions.ts` enforces two restrictions:
      1. **±2 level limit**: Can only change by max 2 levels at once
      2. **30-day cooldown**: Must wait 30 days between changes
    - Both profile and settings pages enforce validation
    - Returns clear error messages to users

- [x] **Match results affect skill level**
  - Status: ✅ COMPLETED
  - Description: Automatic ELO rating and skill level updates now implemented for competitive matches
  - Implementation:
    - ✅ `recordMatchScore()` now updates player ratings and stats automatically
    - ✅ ELO calculation using standard chess formula (K-factor 32) from `@rallio/shared/utils`
    - ✅ Rating updates based on opponent's average rating
    - ✅ Skill level auto-adjusted based on rating thresholds (±2 level max per match):
      - Level 1: < 1200 | Level 2: 1200-1299 | Level 3: 1300-1399
      - Level 4: 1400-1499 | Level 5: 1500-1599 | Level 6: 1600-1699
      - Level 7: 1700-1799 | Level 8: 1800-1899 | Level 9: 1900-1999 | Level 10: 2000+
    - ✅ Only applies to **competitive** queue sessions (casual matches don't affect ELO)
    - ✅ Updates `players.total_wins`, `total_losses`, `total_games_played` for all matches
    - ✅ Draws don't affect ELO rating
    - ✅ Respects ±2 level change limit to prevent exploitation

#### UI/UX Improvements
- [x] **Graceful double booking handling**
  - Status: ✅ COMPLETED (Already implemented)
  - Description: Double booking errors are handled gracefully with proper UI feedback
  - Implementation:
    - **Backend Protection** (`reservations.ts`):
      - Pre-flight conflict check before creating reservation
      - Filters out duplicate attempts from same user (< 2 minutes)
      - Database exclusion constraint catches race conditions (error code 23P01)
      - Returns user-friendly error: "This time slot is already booked" or "just been reserved"
    - **Frontend Error Display** (`payment-processing.tsx` lines 322-392):
      - Dedicated error state with red alert styling
      - Error-specific guidance for "already booked" conflicts
      - **"Choose Different Time" button** - returns user to booking form
      - **"Return to Court" button** - navigates back to venue page
      - Auto-retry logic for transient errors (excludes booking conflicts)
      - Debug info panel in development mode
    - **Booking Form Validation** (`booking-form.tsx`):
      - Error message display at line 287-291
      - Validates multi-hour slot availability before submission
      - Clear error messages: "Failed to load available time slots" or "slot is not fully available"

---

## 🟡 QUEUE MASTER FEATURES

- [x] **Navbar UI black line bug**
  - Status: ✅ COMPLETED
  - Description: Fixed darker vertical line appearing on Queue Master sidebar when expanded
  - Issue Found:
    - Queue Master sidebar (`queue-master-sidebar.tsx` line 57) had duplicate border
    - Expanded overlay div had `border-r border-primary-dark` creating darker vertical line
    - Main sidebar container already had the border, causing double border effect
  - Fix Applied:
    - Removed `border-r border-primary-dark` from expanded overlay div
    - Kept only the shadow effect for depth
    - Main container's border now properly shows without duplication

- [x] **Queue session marks timeslot as booked**
  - Status: ✅ COMPLETED
  - Priority: HIGH
  - Description: Creating queue session now creates a confirmed reservation to prevent double booking
  - Implementation: Creates reservation with metadata `is_queue_session_reservation: true` and links it to queue session
  - Rollback: Deletes reservation if queue session creation fails

- [x] **Auto-end queue when duration is up**
  - Status: ✅ COMPLETED (Already implemented)
  - Description: Queue sessions automatically close when duration expires with proper notifications
  - Implementation:
    - **Migration 007** (`auto_close_expired_sessions.sql`):
      - PostgreSQL function `auto_close_expired_sessions()` closes expired sessions
      - Runs query: `WHERE end_time < now() AND status IN ('open', 'active', 'paused')`
      - Calculates session statistics: total games, revenue, participants, unpaid balances
      - Updates status to 'closed' with summary in metadata
      - Returns JSON with closed session count and details
    - **Session Summary Storage**:
      - Stores totalGames, totalRevenue, totalParticipants, unpaidBalances
      - Records closedAt timestamp, closedBy: 'system', closedReason: 'automatic_expiration'
      - Summary saved in `queue_sessions.settings` JSONB field
    - **View** `expired_queue_sessions` - easy way to check which sessions need closing
    - **Execution**: Can be called via Supabase Edge Function (scheduled), external cron, or manually
    - **Note**: Needs scheduled execution setup (Edge Function or cron job) to run automatically

- [x] **Queue end summary page**
  - Status: ✅ COMPLETED
  - Priority: HIGH
  - Description: Comprehensive end-of-queue page showing all participants, payment status, outstanding balances, match results
  - Implementation:
    - ✅ Backend: `getQueueSessionSummary()` server action fetches session details, participants, matches
    - ✅ Frontend: Created `/queue-master/sessions/[id]/summary` page route
    - ✅ UI Component: `QueueSessionSummaryClient` shows:
      - Session overview with date, duration, mode, cost
      - Statistics cards (total games, participants, revenue, outstanding balance)
      - Participant table with skill level, games played, wins, win rate, payment status
      - Match results with team compositions, scores, winners
      - Outstanding payments alert section
    - ✅ Export functionality: CSV export with all session data
    - ✅ Print functionality: Print-friendly layout
    - ✅ Navigation: "View Session Summary" button in session management page and dashboard for closed sessions

---

## 🟢 COURT ADMIN FEATURES

- [ ] **Manage Venues button color**
  - Status: Not started
  - Priority: LOW
  - Description: Change manage venues button to match navbar blue color

---

## 🔵 GLOBAL FEATURES

- [ ] **Audit logs for all main features**
  - Status: Not started
  - Priority: MEDIUM
  - Description: Add comprehensive audit logging system for all main features (bookings, payments, queue sessions, admin actions, etc.)

---

## 🔍 VERIFICATION NEEDED

- [x] **Court amenities assignment during creation**
  - Status: ✅ COMPLETED
  - Priority: HIGH
  - Description: Amenities can now be assigned when creating courts (not venues)
  - Implementation:
    - ✅ Database: Amenities stored at court level via `court_amenities` junction table
    - ✅ Display: Venue pages show aggregated amenities from all courts
    - ✅ Court Admin: Court creation form includes amenity checkbox grid (2 columns, scrollable)
    - ✅ Global Admin: Court form modal includes amenity selection (2-3 columns)
    - ✅ Backend: Both `createCourt()` actions handle amenity insertion:
      - `court-admin-court-actions.ts` accepts `amenities: string[]`
      - `global-admin-venue-actions.ts` accepts `amenity_ids: string[]`
    - ✅ UI Features: Selection counter, empty state message, hover effects
  - Architecture: Amenities tied to individual courts, aggregated for venue display (de-duplicated)

- [ ] **Queue sessions require Court Admin approval**
  - Status: Needs full testing
  - Priority: HIGH
  - Description: Verify queue sessions don't go live immediately until Court Admin approves them
  - Current State:
    - ✅ Database: Migration 012 & 016 implemented approval workflow
    - ✅ Backend: `createQueueSession()` checks `venues.requires_queue_approval` flag
    - ✅ Status Flow: `pending_approval` → `approved`/`rejected`
    - ✅ UI: Session management shows "Pending Approval" banner
    - ✅ Court Admin: Queue approvals management page exists
    - ⚠️ Default: `requires_queue_approval = true` for all venues
  - Action Required: **Full end-to-end testing** - Create session → Verify pending state → Test approval/rejection flow

- [x] **New venues require Global Admin approval**
  - Status: ✅ COMPLETED
  - Priority: HIGH
  - Description: Venues created by Court Admins don't go live until Global Admin approves them
  - Implementation:
    - ✅ Database: Migration 019 added `approval_status` column, Migration 026 filters in `nearby_venues()` RPC
    - ✅ Court Admin: `createVenue()` sets `is_verified: false` (requires admin verification)
    - ✅ **Public venue filtering enforced** - All venue queries filter by `is_verified = true`:
      - `getVenues()` - Main venue listing
      - `getVenueById()` - Venue detail page  
      - `nearby_venues()` RPC function
      - Home page suggested venues
      - Map page venues
      - Queue Master venue selection
    - ✅ **Court Admin UI**: `venue-list.tsx` shows "Pending Approval" badge (orange, Clock icon) for unverified venues with warning message
    - ✅ **Global Admin UI**: 
      - `admin/venues/page.tsx` has "Pending Approvals" tab with live count badge
      - `pending-venue-approvals.tsx` component with full approval workflow:
        - List of unverified venues with owner info
        - Expandable venue details (description, address, courts, amenities)
        - Approve button with notification to owner
        - Reject button with required reason + notification to owner

---
## 📊 PROGRESS SUMMARY

**Total Items**: 24
- ✅ Completed: 18 (75%)
- 🔴 High Priority: 0 (0%)
- 🟡 Queue Master: 0 (0%)
- 🟢 Court Admin: 1 (4%)
- 🔵 Global: 1 (4%)
- 🔍 Verification Needed: 1 (4%)
- 🔮 Future Features: 1 (4%)

**Active Work**: 3 items
**Deferred**: 1 item

---

## 🎯 RECOMMENDED WORK ORDER

1. ~~**Play Together/Pay Together**~~ - **DEFERRED TO FUTURE RELEASE**
2. ~~**Queue session creates reservation**~~ - ✅ **COMPLETED**
3. **Skill level change validation** - Prevents unfair gameplay
4. **Matches page & tracking** - Core feature for competitive play
5. **Queue payment & balance** - Important for queue system integrity
6. **Notifications functionality** - User engagement feature
7. ~~**Photo album**~~ - ✅ **COMPLETED (Already working)**
8. ~~**Map filters**~~ - ✅ **COMPLETED**
9. ~~**Platform fee**~~ - ✅ **COMPLETED (Already implemented)**
10. **Queue end summary** - Queue master workflow
11. Remaining UI/UX improvements
12. Audit logs

---

## 📝 NOTES

- Migration 025 (review notifications) created but needs to be applied via SQL Editor
- Player ratings UI components created: PlayerRatingModal and RateOpponentsCard
- Multi-hour booking fully functional - no further work needed
- Queue approval workflow fully functional - no further work needed
- Map filters fixed - now properly filter by search, price, amenities, and rating
- Photo album already working - fetches actual court images from database, not just defaults
- Platform fee system fully implemented - shows in booking summary, configurable in admin settings (default 5%)
- ✅ **Blocked dates validation** now integrated into `getAvailableTimeSlots()` - Courts with blocked dates (maintenance, holidays, private events) will show those time slots as unavailable
- ✅ **Venue approval filtering** now enforced - Unverified venues hidden from all public listings (getVenues, getVenueById, nearby_venues RPC, home page, map page, queue master). Migration 026 created for PostgreSQL function update.
