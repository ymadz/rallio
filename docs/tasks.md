# Rallio Task Tracker

**Last Updated:** January 27, 2026  
**Current Branch:** main  
**Build Status:** ✅ PASSING (Zero TypeScript errors)  
**Last Audit:** January 27, 2026 (Full mobile analysis completed)

## ⚠️ Critical Action Items (Jan 2026 Audit)

| Priority | Issue | Impact | Action Required | Est. Time |
|----------|-------|--------|-----------------|-----------|
| 🔴 P0 | No test coverage | High regression risk | Add Jest + Vitest + Playwright | 2-3 days |
| 🔴 P0 | 100+ console.logs in production | Security leak, perf | Create logger utility | 2-3 hours |
| 🔴 P0 | Role assignment duplicate error | UX bug (logged 23505) | Check before INSERT | 30 min |
| 🟡 P1 | Mobile app needs rebuild | Fresh template only | Follow mobile roadmap | 7 weeks |
| 🟡 P1 | Duplicate Supabase service client | Code duplication | Consolidate to server.ts | 1 hour |
| 🟡 P1 | In-memory rate limiter | Won't scale | Replace with Redis/Upstash | 1 day |
| 🟡 P1 | Email notifications missing | Poor UX | Set up SendGrid | 1 day |
| 🟡 P1 | Payment expiration not automated | Data integrity | Add pg_cron or Edge Function | 2-3 hours |
| 🟢 P3 | React 18/19 version mismatch | Potential issues | Align versions | 30 min |
| 🟢 P3 | Unused TanStack Query | Dead dependency | Remove or implement | 15 min |

## Quick Overview

| Phase | Status | Completion | Key Notes |
|-------|--------|------------|-----------|
| Phase 1: Auth & Foundation | ✅ Complete | 100% | Email/password + Google OAuth, profile system |
| Phase 2: Court Discovery | ✅ Complete | 90% | Leaflet maps, PostGIS search, filters |
| Phase 3: Bookings & Payments | ✅ Complete | 90% | PayMongo (GCash/Maya), webhooks fixed |
| Phase 4: Queue Management | ✅ Complete | 90% | User & Queue Master features, real-time |
| Phase 5: Ratings & Reviews | 🟡 Partial | 30% | Backend complete, UI built, flow needs testing |
| Phase 6: Admin Dashboards | ✅ Complete | 90% | Court Admin, Queue Master, Global Admin |
| Phase 7: Notifications | 🚧 Partial | 50% | In-app done, push/email pending |
| Phase 8: Mobile App | 🔄 Restarted | 5% | Fresh Expo template, roadmap defined |
| **Testing & QA** | ❌ Not Started | 0% | **No tests exist - CRITICAL GAP** |

## 🚧 Capacitor Android (Web-Parity) Track

Goal: ship Android APK with player-role web parity using Capacitor pure web shell.

- [x] Create dedicated feature branch (`feature/capacitor-web-parity-android`)
- [x] Add Capacitor bootstrap config (`web/capacitor.config.ts`)
- [x] Add Capacitor scripts/dependencies in `web/package.json`
- [x] Install dependencies and validate CLI (`npm run cap:doctor --workspace=web`)
- [ ] Add Android platform (`npm run cap:add:android --workspace=web`)
- [ ] Configure `CAPACITOR_SERVER_URL` for dev/staging/prod app shells
- [ ] Validate auth flow in WebView (login/logout/session restore)
- [ ] Validate PayMongo callback bridge (`/mobile-payment/callback`) end-to-end
- [ ] Validate booking + queue parity paths for player role
- [ ] Build internal test APK and run device smoke test

## How to Use This File
- [x] Completed tasks
- [ ] Pending tasks
- Tasks are organized by phase and category
- Update this file as you complete tasks

## Technical Debt & Code Quality Issues

### 🔴 Must Fix Before Production
- [ ] **Add test infrastructure** - Zero tests exist (unit, integration, E2E)
- [ ] **Create logger utility** - 100+ console.log statements in production code:
  - `web/src/app/actions/payments.ts` (~25 logs)
  - `web/src/app/actions/queue-actions.ts`
  - `web/src/app/api/webhooks/paymongo/route.ts` (~30 logs)
  - `web/src/lib/rate-limiter.ts`
  - `web/src/hooks/use-queue.ts`
- [ ] **Fix role assignment duplicate error** - Auth callback logs `23505` error
- [ ] **Fix CSS linting** - `@theme` at-rule warning in `globals.css` (Tailwind v4)

### 🟡 Should Fix Soon
- [ ] **Consolidate Supabase service clients** - Duplicate definitions in:
  - `web/src/lib/supabase/server.ts` (line 27)
  - `web/src/lib/supabase/service.ts` (entire file - DELETE)
- [ ] **Remove unused TanStack Query** - Listed in package.json but never imported
- [ ] **Add Redis rate limiting** - Current in-memory store won't scale multi-server
- [ ] **Align React versions** - web uses 18.3.1, root overrides to 19.1.0
- [ ] **Review `force-dynamic` usage** - Home page disables all caching unnecessarily

### 🟢 Nice to Have
- [ ] Add Zod validation to ALL server action inputs (some missing)
- [ ] Implement React Query for venue/court caching
- [ ] Add error boundary components throughout app
- [ ] Improve loading/empty states consistency
- [ ] Update README.md (says Next.js 14, actually 15)

---

## Current System Capabilities

### 🎾 For Players (Web App)
**What's Built:**
- ✅ Sign up with email/password or Google OAuth
- ✅ Complete profile with avatar, skill level (1-10), play style
- ✅ Browse courts on interactive Leaflet map
- ✅ Filter courts by distance, price, amenities, court type
- ✅ View court details with photos, pricing, amenities
- ✅ Book time slots with calendar date picker
- ✅ Pay via GCash or Maya (QR code checkout)
- ✅ View booking history and manage reservations
- ✅ Join queue sessions at courts
- ✅ See real-time position in queue
- ✅ Pay per game after playing in queue
- ✅ Leave queue (with payment enforcement if games played)

**What's Missing:**
- ⚠️ Rate and review courts/players (Phase 5)
- ⚠️ Email notifications for bookings
- ⚠️ Modify/reschedule bookings
- ⚠️ Split payment with friends
- ⚠️ Mobile app (30% complete - auth only, no booking/queue/maps)

### 🏟️ For Court Admins
**What's Built:**
- ✅ Dashboard with revenue stats and booking metrics
- ✅ Multi-venue support (VenueSelector for multiple venues)
- ✅ View and manage reservations (approve/reject/cancel)
- ✅ Configure pricing (hourly rates, discounts, holiday pricing)
- ✅ Set availability (operating hours, blocked dates)
- ✅ Create and edit venues/courts
- ✅ Approve/reject Queue Master session requests
- ✅ Real-time in-app notifications with badge
- ✅ View and respond to reviews
- ✅ Analytics dashboard (revenue, bookings, peak hours)

**What's Missing:**
- ⚠️ Email notifications for new bookings
- ⚠️ Refund processing UI
- ⚠️ Complete promo code system
- ⚠️ Court photo management
- ⚠️ Staff management

### 👥 For Queue Masters
**What's Built:**
- ✅ Create queue sessions (format, cost, max players)
- ✅ Manage sessions (pause/resume/close)
- ✅ View session dashboard with metrics
- ✅ Assign players from queue to matches (auto-balanced teams)
- ✅ Record match scores with auto-winner detection
- ✅ Track player payments and games played
- ✅ Waive fees for players
- ✅ Analytics dashboard (revenue, top players, charts)
- ✅ Real-time updates via Supabase subscriptions
- ✅ Requires Court Admin approval to start sessions

**What's Missing:**
- ⚠️ PayMongo QR generation for queue payments
- ⚠️ Session summary reports
- ⚠️ Enhanced dispute resolution UI
- ⚠️ Player notifications when matches assigned

### 🌐 For Global Admins
**What's Built:**
- ✅ Platform overview dashboard (users, revenue, bookings)
- ✅ User management (CRUD, roles, ban/suspend)
- ✅ Venue management (CRUD, verification)
- ✅ Content moderation (flagged reviews, batch operations)
- ✅ Platform settings (fees, terms, policies)
- ✅ Audit logs (track all admin actions)
- ✅ Analytics dashboard (user growth, booking trends)
- ✅ Amenity management (platform-wide)

**What's Missing:**
- ⚠️ Venue approval workflow (auto-approved for now)
- ⚠️ Dispute escalation system
- ⚠️ Financial reconciliation tools
- ⚠️ Advanced system health monitoring

---

## Phase 1: Foundation & Core Auth

### Infrastructure Setup
- [x] Create monorepo with npm workspaces
- [x] Set up root package.json with workspace scripts
- [x] Create tsconfig.base.json for shared TypeScript config
- [x] Add Prettier configuration
- [x] Add ESLint ignore patterns
- [x] Create .env.example files for web and mobile

### Shared Package
- [x] Create shared package.json with dependencies
- [x] Create shared tsconfig.json
- [x] Create shared types (User, Court, Venue, Reservation, etc.)
- [x] Create Zod validation schemas
- [x] Create utility functions (date, currency, distance, ELO)

### Web Setup
- [x] Create web folder structure (lib, hooks, stores, components, types, constants)
- [x] Set up Supabase client (browser and server)
- [x] Create middleware for auth session refresh
- [x] Create base UI components (Button)
- [x] Create auth store (Zustand)
- [x] Create UI store (Zustand)
- [x] Add path aliases for shared package
- [x] Install and configure shadcn/ui CLI
- [x] Add more base UI components (Input, Card, Form, Alert, Spinner, Separator, Avatar, Label)
- [x] Fix Tailwind/PostCSS build error (removed invalid @apply and aligned CSS variables)
- [x] Add root middleware file and matcher (created `web/src/middleware.ts` to call the Supabase session updater)

### Mobile Setup
- [x] Create mobile src folder structure
- [x] Set up Supabase client with AsyncStorage
- [x] Create auth hooks
- [x] Create location hooks
- [x] Create auth store (Zustand)
- [x] Add path aliases for shared package
- [x] Set up Expo Router file structure
  - Created app/_layout.tsx (root layout with auth state management)
  - Created app/index.tsx (entry point with auth redirect)
  - Created app/(auth)/ with login, signup, forgot-password screens
  - Created app/(tabs)/ with courts, map, reservations, profile tabs
- [x] Configure app.json for proper navigation
  - Set app name to "Rallio"
  - Added scheme for deep linking (rallio://)
  - Configured bundle identifiers (com.rallio.app)
  - Added location and notification permissions
  - Configured expo-location and expo-notifications plugins

### Database Setup
- [x] Copy database schema to migrations folder
- [x] Create Supabase project
  - Project URL: https://angddotiqwhhktqdkiyx.supabase.co
- [x] Run initial migration (apply 001_initial_schema.sql via SQL Editor or CLI)
  - All migrations applied successfully via `supabase db push`
  - Database confirmed up to date
- [x] Set up Row Level Security (RLS) policies (created 002_rls_policies.sql with comprehensive policies)
  - Policies for users, players, venues, courts, and amenities
  - Commented stubs for reservations and queue_sessions (add when tables are created)
- [x] Create database seed data for development (created 001_dev_seed.sql with sample venues, courts, players)
  - 2 test venues, 8 courts, 3 test users, amenity mappings
  - UUIDs: player1@example.com, player2@example.com, admin@venue.com
- [x] Configure environment variables
  - Created `web/.env.local` with Supabase URL and keys
  - Created `mobile/.env` with Expo-prefixed Supabase credentials
- [ ] Test database connections from web and mobile
  - Run `npm run dev:web` and check that app loads
  - Run `npm run dev:mobile` and verify auth flow

### Authentication (Web)
- [x] Create login page UI
  - Split-screen layout with branding
  - Email/password form with show/hide toggle
  - Google OAuth button
  - Forgot password link
- [x] Create signup page UI
  - Multi-step form (details → phone number)
  - First name, middle initial, last name, email, password
  - Terms and conditions checkbox
  - Google OAuth option
- [x] Create forgot password page UI
- [x] Create reset password page UI
- [x] Create email verification page UI
- [x] Implement login with Supabase Auth
- [x] Implement signup with email verification
- [x] Implement signup with automatic user/player profile creation
  - Creates users table record with full name and phone
  - Creates players table record with default skill level
- [x] Implement forgot password flow
- [x] Implement social login (Google)
- [x] Create auth callback handler
- [x] Create signout route
- [x] Create protected dashboard layout
- [x] Update theme with Rallio brand colors (teal/cyan)

### Authentication (Mobile)
- [ ] Create login screen UI
- [ ] Create signup screen UI
- [ ] Create forgot password screen UI
- [ ] Implement auth flows with Supabase
- [ ] Handle deep links for email verification
- [ ] Create auth navigation guard

### User Profile
- [x] Create profile setup onboarding flow
  - Welcome screen
  - Details review (read-only from auth)
  - Player info (birth date, gender, initial rating)
  - Play styles selection (multi-select)
  - Skill level selection (Beginner/Intermediate/Advanced/Elite)
  - Match preferences (formats, frequency, location)
- [x] Create home page with quick actions
  - ✅ **Updated "Compete" button to "Queue" button** (links to `/queue`) (2025-11-25)
  - ✅ **Implemented real venue data for "Suggested Courts"** (2025-11-25)
  - ✅ **Implemented geolocation-based "Near You" section** (2025-11-25)
  - ✅ **Added "Active Queues Nearby" section** (2025-11-25)
- [x] Create profile page UI
  - User info with avatar
  - Stats (Queue Matches, Won Matches, Skill Level)
  - Player badges placeholder
  - Play styles tags
  - Skill level tier badge
  - Recent queue sessions
- [x] Create main navigation
  - Desktop header with logo, nav links, user dropdown, notifications
  - Mobile bottom tab navigation (Home, My Match, Profile)
  - Logout functionality
- [x] **Phase 1 Complete: Foundation & Core Auth** ✅
  - Full signup → email verification → profile setup flow
  - User and player profiles auto-created on signup via database triggers
  - Fixed critical users→profiles table bug in 3 files
  - Navigation redirects work correctly
  - Supabase database synced and ready with V2 schema
  - Avatar upload to Supabase Storage working
- [ ] Implement profile update functionality (edit existing profile)
- [ ] Implement profile viewing for other users (public profiles)

---

## Phase 2: Court Discovery & Display - 85% Complete ✅

### Data Models
- [x] Create venue API functions
- [x] Create court API functions
- [x] Create court amenities lookup
- [x] Add court images handling

### Court Listing (Web)
- [x] Create courts listing page
- [x] Implement court card component
- [x] Add search input with filters
- [x] Add filter sidebar (price, type, amenities, indoor/outdoor)
- [x] Implement pagination or infinite scroll
- [x] Add sorting options (distance, price, rating)
- [ ] Enhanced filtering (price range sliders, amenities checkboxes)
- [ ] Improved pagination with page numbers

### Court Listing (Mobile)
- [ ] Create courts list screen
- [ ] Implement court card component
- [ ] Add search and filter UI
- [ ] Implement pull-to-refresh

### Map Integration
- [x] Set up Leaflet (web) - using OpenStreetMap tiles instead of Mapbox
- [x] Create map component with court markers
- [x] Implement click-to-view court details
- [x] Add user location marker
- [x] Create map/list toggle view
- [x] Custom marker clustering implementation
- [ ] Set up react-native-maps (mobile)
- [ ] Create mobile map view

### Court Detail Page
- [x] Create court detail page (web)
- [x] Display venue information
- [x] Show amenities list
- [x] Display pricing information
- [x] Show photo gallery
- [x] Display ratings and reviews placeholder
- [x] Show availability calendar (integrated into booking flow)
- [x] Add "Book Now" button
- [ ] Add "Join Queue" button
- [ ] Create court detail screen (mobile)

### Geospatial Search
- [x] Implement distance calculation on backend (PostGIS)
- [x] Create location-based search API (nearby_venues RPC)
- [x] Add radius filter
- [x] Implement efficient geospatial queries with PostGIS
- [ ] Cache popular search results

---

## Phase 3: Reservations & Payments - 85% Complete ✅

### Reservation Flow (Web)
- [x] Create reservation page (booking flow)
  - Located at `/courts/[id]/book/page.tsx`
- [x] Build date picker component (Calendar UI component)
- [x] Build time slot selector with availability (TimeSlotGrid component)
- [x] Implement booking conflict detection (database-level exclusion constraint)
- [x] Create booking confirmation flow
- [x] Add booking notes field
- [x] Create my bookings page (`/bookings`)
  - Displays user's booking history with filtering
- [x] Create my reservations page (`/reservations`)
  - Shows active and past reservations
- [x] Implement reservation cancellation (server action)
  - Server action at `/app/actions/reservations.ts`
- [ ] Implement booking modification/rescheduling
- [ ] Add booking reminder notifications

### Reservation Flow (Mobile)
- [ ] Create reservation screen
- [ ] Build mobile date/time pickers
- [ ] Create my reservations screen
- [ ] Implement cancellation flow

### Payment Integration
- [x] Set up PayMongo account and credentials
- [x] Create PayMongo client library (`/lib/paymongo/`)
  - `client.ts` - Payment creation, source generation
  - `types.ts` - TypeScript definitions for PayMongo API
- [x] Implement GCash payment flow
- [x] Implement Maya payment flow
- [x] Generate QR code for payment (PayMongo checkout URL)
- [x] Create payment server actions (`/app/actions/payments.ts`)
  - `createPaymentSource()` - GCash/Maya source creation
  - `createPaymentIntent()` - Payment intent creation
  - ✅ **Fixed source.type to use literal 'source'** (2025-11-25)
- [x] Create webhook endpoint for payment confirmation
  - Located at `/app/api/webhooks/paymongo/route.ts`
  - Handles `source.chargeable`, `payment.paid`, `payment.failed` events
  - ✅ **Fixed webhook signature verification** (uses `te=` and `li=` fields) (2025-11-25)
  - Idempotency handling to prevent duplicate processing
  - Webhooks now properly accept with 200 status
- [x] Handle payment success/failure states
  - ✅ **Payment flow fully functional** (pending → completed → confirmed) (2025-11-25)
- [x] Create payment success page (`/checkout/success`)
- [x] Create payment failure page (`/checkout/failed`)
- [x] Add payment expiration function (`expire_old_payments()`)
  - Database function in migration 004
  - Expires payments older than 15 minutes
  - Automatically cancels associated reservations
- [x] Add database indexes for payment performance
  - `idx_payments_pending_created`
  - `idx_payments_status_expires`
  - `idx_reservations_court_time_status`
- [x] Add webhook idempotency handling ✅
- [x] Add PAYMONGO_WEBHOOK_SECRET to .env.example
- [x] **Payment webhook integration fully functional** ✅ (2025-11-25)
  - Webhook signature parsing fixed
  - Payment source creation fixed
  - Reservation status updates working
  - Bookings persist after successful payment
- [ ] Create payment receipt email
- [ ] Add payment expiration automation (scheduled job/Edge Function)
- [ ] Implement QR code image generation (currently using PayMongo URLs)
- [ ] Add payment status polling for real-time updates
- [ ] Handle cash payment option

### Split Payments
- [x] Design split payment database schema
  - `payment_splits` table created in initial schema
  - Tracks individual participant payments
- [x] Design split payment UI (in checkout flow)
  - Participant input fields
  - Split calculation logic
- [ ] Implement participant invitation system
  - Email/SMS invitations
  - Deep links to payment pages
- [ ] Create payment tracking per participant
  - Individual payment status tracking
  - Partial payment handling
- [ ] Implement payment deadline logic
  - Deadline enforcement
  - Automatic cancellation for incomplete payments
- [ ] Implement refund flow for failed group bookings
- [ ] Send payment reminders to participants

### Database & Security
- [x] Add exclusion constraint to prevent double booking (migration 004)
  - `no_overlapping_reservations` constraint using btree_gist
  - Prevents overlapping reservations for same court
- [x] Add validation triggers for overlapping reservations
  - `validate_reservation_no_overlap()` function
  - Triggers on INSERT and UPDATE
- [x] Create active_reservations view
  - Shows pending/confirmed reservations with venue details
- [x] Create payment_summary view
  - Shows all payments with reservation and user info
- [x] Add comprehensive RLS policies (migration 005 created)
  - DELETE policy for reservations (24-hour cancellation window)
  - Court admin SELECT/UPDATE policies for venue management
  - INSERT/UPDATE policies for payments (webhook support)
  - INSERT policy for payment_splits (reservation owner only)
  - Enhanced SELECT policy for payment_splits (includes reservation owner)
- [x] Create migration verification script (VERIFY_MIGRATIONS_004_005.sql)
- [x] Document migration status and requirements (MIGRATION_STATUS_REPORT.md)
- [ ] Verify migrations 004 and 005 applied to production (run verification script)
- [ ] Test all RLS policies with different user roles
- [ ] Set up payment expiration scheduled job (Edge Function or pg_cron)

---

## Phase 4: Queue Management - ✅ 85% Complete

### Backend Infrastructure ✅ 100% Complete (2025-11-26)
- [x] Create queue-actions.ts with server actions (getQueueDetails, joinQueue, leaveQueue, getMyQueues, getNearbyQueues, calculateQueuePayment)
- [x] Create match-actions.ts with server actions (assignMatchFromQueue, startMatch, recordMatchScore, getActiveMatch)
- [x] Replace mock hooks with real Supabase queries in use-queue.ts
- [x] Implement Supabase Realtime subscriptions (queue_participants, queue_sessions)
- [x] Integrate queue payments with PayMongo (initiateQueuePaymentAction)
- [x] Fix current user identification in queue-details-client.tsx
- [x] Position calculation and tracking
- [x] Estimated wait time calculation
- [x] Games played counter and stats tracking
- [x] Payment enforcement before leaving queue

### Queue Session (Queue Master) - ✅ 90% Complete
- [x] Track games per player (backend complete)
- [x] Create game assignment interface (backend logic complete)
- [x] Create queue session creation form (UI complete at `/queue-master/create`)
- [x] Implement queue parameter settings (UI complete)
- [x] Create queue dashboard UI (UI complete with metrics)
- [x] Display pending players list (UI exists, backend connected)
- [x] Session management (pause/resume/close)
- [x] Match assignment modal with team balancing
- [x] Score recording modal with auto-winner detection
- [x] Payment tracking and waive fee functionality
- [x] Analytics dashboard with charts
- [x] Real-time updates via Supabase subscriptions
- [ ] PayMongo QR generation for queue payments (placeholder exists)
- [ ] Enhanced dispute resolution UI (future feature)
- [ ] Generate session summary report (future feature)

### Queue Participation (Player) - ✅ 85% Complete
- [x] Create queue discovery UI (dashboard exists, now uses real data)
- [x] Show active queues on court pages (integrated with useQueue hook)
- [x] Implement queue join flow (server action + UI complete)
- [x] Display real-time queue position (real-time subscriptions working)
- [x] Show estimated wait time (calculated server-side)
- [x] Implement leave queue functionality (with payment validation)
- [ ] Create game notification UI (future feature)
- [ ] Display current game assignment (partial - needs match state in UI)

### Real-time Updates ✅ 100% Complete
- [x] Set up Supabase Realtime subscriptions (3 channels: queue-{id}, my-queues, nearby-queues)
- [x] Implement optimistic UI updates (auto-refresh on participant changes)
- [x] Handle reconnection gracefully (Supabase handles automatically)
- [x] Create real-time player count updates (subscription-based)
- [x] Implement game status broadcasts (queue_sessions UPDATE events)

### Skill-Based Matching - 🚧 30% Complete
- [x] Track match history (matches table with results)
- [x] Create team balancing for doubles (basic sequential split implemented)
- [ ] Create matching algorithm (needs skill-based improvement)
- [ ] Implement ELO rating updates (placeholder exists, needs @rallio/shared integration)
- [ ] Add manual override for Queue Master (future feature)

### Queue Payments ✅ 90% Complete
- [x] Calculate per-game costs (server action implemented)
- [x] Generate payment requests (initiateQueuePaymentAction)
- [x] Track payment status per player (payment_status in queue_participants)
- [x] Payment integration with PayMongo (GCash, Maya)
- [x] Payment enforcement before leaving
- [ ] Create payment success/failure pages for queues (/queue/payment/success, /queue/payment/failed)
- [ ] Create payment summary at session end (future feature)

---

## Phase 5: Ratings & Reviews

### Court Ratings
- [ ] Create rating submission form
- [ ] Implement star rating component
- [ ] Add category ratings (quality, cleanliness, facilities, value)
- [ ] Create review text field
- [ ] Implement photo upload for reviews
- [ ] Display ratings on court pages
- [ ] Show rating breakdown by category
- [ ] Calculate and display average rating

### Player Ratings
- [ ] Create post-game rating prompt
- [ ] Implement player rating form
- [ ] Add sportsmanship, skill, reliability scores
- [ ] Make ratings anonymous
- [ ] Display player reputation on profiles
- [ ] Track rating history

### Review Moderation
- [ ] Create report review functionality
- [ ] Build moderation queue for admins
- [ ] Implement venue owner response feature
- [ ] Add verified booking badge to reviews
- [ ] Create review editing/deletion

---

## Phase 6: Admin Dashboards - 85% COMPLETE ✅

### Court Admin Dashboard ✅ 90% COMPLETE (Dec 2025)
- [x] Create dashboard layout
  - ✅ Court Admin sidebar with navigation
  - ✅ Header with notification bell
  - ✅ Mobile bottom navigation
- [x] Build reservation calendar view (integrated into reservations page)
- [x] Implement booking approval flow (approve/reject server actions)
- [x] Create pricing management UI
  - ✅ Discount rules management
  - ✅ Holiday pricing
  - ✅ Multi-day discounts
  - ✅ Early bird pricing
- [x] Add operating hours configuration (in availability management)
- [x] Build revenue reports (in analytics dashboard)
- [x] Show booking analytics
  - ✅ Revenue charts
  - ✅ Booking statistics
  - ✅ Court performance metrics
  - ✅ Peak hours analysis
- [x] Implement court status management (in venue/court pages)
- [x] Create venue management UI
  - ✅ Venue list, create, edit, delete
  - ✅ Court list, create, edit, delete
  - ✅ Image uploads
  - ✅ Amenity management
- [x] Create availability management page
  - ✅ Operating hours configuration
  - ✅ Blocked dates management (using dedicated table)
  - ✅ Holiday blocking
- [x] Create reviews management page
  - ✅ Review list with filtering
  - ✅ Respond to reviews
  - ✅ Rating analytics
- [x] Implement queue approval workflow
  - ✅ Pending queue approvals list
  - ✅ Approve/reject actions
  - ✅ Automatic notifications
  - ✅ 48-hour expiration

### Multi-Venue Support ✅ COMPLETE (Dec 1, 2025)
- [x] Create VenueSelector component
  - ✅ Dropdown for venue selection
  - ✅ Auto-selection for single venue owners
  - ✅ Empty state with CTA
  - ✅ URL param-based filtering
- [x] Apply VenueSelector to all venue-scoped pages
  - ✅ Analytics page
  - ✅ Pricing page
  - ✅ Availability page
  - ✅ Reviews page
- [x] Create testing documentation (31 test cases in TESTING-PHASE-1-2.md)

### Dynamic Pricing ✅ COMPLETE
- [x] Create pricing rule builder
- [x] Implement peak/off-peak pricing
- [x] Add holiday surcharge configuration
- [x] Create multi-day discount settings
- [x] Build early bird discount settings
- [ ] Implement promo code management (partial - needs completion)

### Queue Master Dashboard ✅ 90% COMPLETE (Nov 2025)
- [x] Create session management view (complete with filters)
- [x] Build player management interface (complete)
- [x] Session creation form (complete)
- [x] Session details page with real-time updates
- [x] Match assignment interface with visual selection
- [x] Score recording modal
- [x] Payment tracking and waive fee functionality
- [x] Analytics dashboard with charts (revenue, top players, distribution)
- [x] Real-time Supabase subscriptions
- [ ] PayMongo QR generation for payments
- [ ] Enhanced dispute resolution UI
- [ ] Session summary reports

### Global Admin Dashboard ✅ 80% COMPLETE (Dec 2025)
- [x] Create platform overview dashboard
  - ✅ User stats (total, active, new this month)
  - ✅ Revenue metrics (total, this month, growth)
  - ✅ Booking trends (total, pending, confirmed)
  - ✅ System health indicators
  - ✅ Recent activity feed
- [x] Build user management interface
  - ✅ User list with search and filtering
  - ✅ User detail modal (roles, activity, stats)
  - ✅ Assign/remove user roles
  - ✅ Ban/suspend/deactivate users
  - ✅ Create users manually
  - ✅ Update user profiles and player data
  - ✅ Verify/unverify players
  - ✅ Reset user passwords
  - ✅ Reactivate deactivated users
- [x] Build venue management interface
  - ✅ Venue list with filtering and search
  - ✅ Venue details panel
  - ✅ Create/update/delete venues
  - ✅ Court management (create/update/delete)
  - ✅ Toggle venue/court verification
  - ✅ Toggle venue/court active status
  - ✅ Bulk venue updates
  - ✅ Amenity management (platform-wide CRUD)
- [x] Implement content moderation
  - ✅ Flagged reviews dashboard
  - ✅ Moderation statistics
  - ✅ Resolve flagged content (approve/remove)
  - ✅ Ban user from posting reviews
  - ✅ Batch delete reviews
  - ✅ Banned users list with unban
  - ✅ Recent moderation activity log
- [x] Build platform settings
  - ✅ Platform fee configuration (percentage, enabled/disabled)
  - ✅ Terms & conditions editor (rich text)
  - ✅ Refund policy editor (rich text)
  - ✅ General settings (maintenance mode, site name, contact)
  - ✅ Notification settings (email/sms/push toggles)
  - ✅ Payment settings (min/max amounts, methods)
  - ✅ Calculate platform fee helper
- [x] Implement audit logs
  - ✅ Complete admin action tracking (automatic)
  - ✅ Filter by admin, action type, target type, date range
  - ✅ Export to CSV functionality
  - ✅ Action type list
  - ✅ Target type list
  - ✅ Admin list
  - ✅ Audit statistics
- [x] Build analytics dashboard
  - ✅ Analytics summary (users, bookings, revenue, queues)
  - ✅ User growth chart (30 days)
  - ✅ Recent activity log
  - ✅ Top venues by bookings
  - ✅ Revenue trends
- [ ] Implement venue approval flow (future feature)
- [ ] Create dispute escalation handling (future feature)
- [ ] Financial reconciliation tools
- [ ] Advanced system health monitoring
- [ ] API rate limiting dashboard

### Database Migrations (Global Admin)
- [x] Migration 018: Assign user roles helper ✅
- [x] Migration 019: Global admin elevation policies ✅
- [x] Migration 020: Fix is_active default ✅
- [x] Migration 021: Global admin venue/court insert/delete policies ✅
- [x] Migration 022: Court verification system ✅
- [x] Migration 023: Metadata for moderation ✅
- [x] Migration 024: Platform settings table ✅

### Database Migrations (Court Admin)
- [x] Migration 012: Queue session approval workflow ✅
- [x] Migration 013: Queue approval RLS policies ✅
- [x] Migration 014: Blocked dates table ✅
- [x] Migration 015: Discount fields to reservations ✅

---

## Phase 7: Notifications - 50% COMPLETE 🚧

### In-App Notifications ✅ COMPLETE (Dec 1, 2025)
- [x] Create notification types and interfaces (`/types/notifications.ts`)
- [x] Create notification server actions (`/app/actions/notification-actions.ts`)
  - ✅ getNotifications()
  - ✅ getUnreadCount()
  - ✅ markNotificationAsRead()
  - ✅ markAllNotificationsAsRead()
  - ✅ deleteNotification()
- [x] Create useNotifications hook (`/hooks/useNotifications.ts`)
  - ✅ Real-time Supabase subscriptions (INSERT, UPDATE, DELETE)
  - ✅ Auto-fetch on mount
  - ✅ Optimistic updates
- [x] Create NotificationBell component
  - ✅ Bell icon with unread badge
  - ✅ Click to open/close dropdown
  - ✅ Click-outside-to-close functionality
- [x] Create NotificationList component
  - ✅ Scrollable list (max 600px)
  - ✅ "Mark all read" button
  - ✅ Empty state
  - ✅ Loading state
- [x] Create NotificationItem component
  - ✅ Type-based icons and colors
  - ✅ Relative time formatting (date-fns)
  - ✅ Click to mark as read and navigate
  - ✅ Visual unread indicator
- [x] Integrate with Court Admin layout header
- [x] Implement notification badge (unread count)
- [x] Create notification list view (dropdown)
- [x] Add mark as read functionality (single and bulk)
- [x] Implement real-time updates (Supabase subscriptions)
- [x] Create testing documentation (24 test cases in TESTING-PHASE-1-2.md)

### Queue Approval Notifications ✅ COMPLETE (Migration 012)
- [x] Database triggers for queue approval workflow
  - ✅ notify_court_admin_new_queue_approval() - Notifies Court Admin
  - ✅ notify_organizer_approval_decision() - Notifies organizer
  - ✅ Automatic notifications on INSERT/UPDATE
- [x] Notification types:
  - ✅ queue_approval_request
  - ✅ queue_approval_approved
  - ✅ queue_approval_rejected
- [x] Action URLs for navigation
  - ✅ `/court-admin/approvals/{id}` for Court Admin
  - ✅ `/queue/{id}` for organizer

### Push Notifications ⏳ PENDING
- [ ] Set up Firebase Cloud Messaging
- [ ] Implement notification sending service
- [ ] Create notification preferences UI
- [ ] Handle notification permissions
- [ ] Implement deep linking from notifications

### Email Notifications ⏳ PENDING
- [ ] Set up SendGrid account
- [ ] Create email templates
- [ ] Implement booking confirmation emails
- [ ] Create payment receipt emails
- [ ] Implement reminder emails
- [ ] Create queue turn notifications

### Notification System Features
- [x] Notification filtering (by type - client-side)
- [ ] Notification pagination (currently loads max 50)
- [ ] Delete individual notifications (server action exists, UI missing)
- [ ] Notification preferences (opt-in/opt-out)
- [ ] Notification grouping ("5 new reservations")
- [ ] Notification sounds/vibrations
- [ ] Email digests for unread notifications

---

## Phase 8: Mobile App - 🔄 RESTARTED (Jan 27, 2026)

### Project Status
The mobile app has been **reinitialized** with a fresh Expo tabs template due to Metro bundler issues caused by npm workspace hoisting. Mobile is now independent (not in npm workspaces) with isolated `node_modules`.

### Technical Setup ✅ COMPLETE
- [x] Fresh Expo 54 project with tabs template
- [x] Removed from npm workspaces (isolated deps)
- [x] Metro config for monorepo (`@rallio/shared` support)
- [x] `.env` configured with Supabase keys
- [x] `@rallio/shared` linked via `file:../shared`

### Mobile App Roadmap

#### Phase M1: Foundation (Week 1) - NOT STARTED
- [ ] **Theme & UI Components**
  - [ ] Dark-centered theme (bg: #0A0A0F, surface: #12121A)
  - [ ] Glassmorphism cards (5% white bg, 10% border, blur: 8px)
  - [ ] Button, Input, Card, Avatar components
  - [ ] Loading, Empty, Error states
- [ ] **Supabase Setup**
  - [ ] Create `lib/supabase.ts` with AsyncStorage
  - [ ] Auth state listener
  - [ ] Session persistence
- [ ] **Auth Screens**
  - [ ] Login screen (email/password)
  - [ ] Signup screen
  - [ ] Forgot password screen
  - [ ] Google OAuth (expo-auth-session)
  - [ ] Biometric auth (Face ID/Touch ID)

#### Phase M2: Court Discovery (Week 2) - NOT STARTED
- [ ] **Home Screen**
  - [ ] Welcome header with avatar
  - [ ] Quick actions (Book, Queue, Map)
  - [ ] Nearby courts preview
  - [ ] Active queues nearby
- [ ] **Courts List Screen**
  - [ ] FlatList with court cards
  - [ ] Pull-to-refresh
  - [ ] Search input
  - [ ] Filter bottom sheet
  - [ ] Sort by distance/price/rating
- [ ] **Map Screen**
  - [ ] react-native-maps integration
  - [ ] Court markers with clustering
  - [ ] Current location button
  - [ ] Bottom sheet on marker tap
- [ ] **Venue Details Screen**
  - [ ] Image carousel
  - [ ] Amenities list
  - [ ] Operating hours
  - [ ] Reviews preview
  - [ ] Book/Queue buttons

#### Phase M3: Booking Flow (Week 3) - NOT STARTED
- [ ] **Date Selection**
  - [ ] Calendar component
  - [ ] Today/Tomorrow quick buttons
  - [ ] Blocked dates handling
- [ ] **Time Slot Selection**
  - [ ] Horizontal scroll time slots
  - [ ] Available/unavailable states
  - [ ] Price display per slot
- [ ] **Booking Confirmation**
  - [ ] Summary card
  - [ ] Payment method selector
  - [ ] GCash/Maya deep linking
- [ ] **Booking Management**
  - [ ] My Bookings list
  - [ ] Booking detail screen
  - [ ] Cancellation flow
- [ ] **Profile Screen**
  - [ ] Avatar and basic info
  - [ ] Skill level display
  - [ ] Match stats
  - [ ] Settings link

#### Phase M4: Queue System (Week 4) - NOT STARTED
- [ ] **Queue Dashboard**
  - [ ] Active queues list
  - [ ] Queue card with position
  - [ ] Estimated wait time
- [ ] **Join Queue Flow**
  - [ ] Queue details screen
  - [ ] Join confirmation
  - [ ] Real-time position updates
- [ ] **In-Queue Experience**
  - [ ] Position tracker
  - [ ] Participant list
  - [ ] Leave queue (with payment check)
- [ ] **Queue Payments**
  - [ ] Payment summary
  - [ ] PayMongo integration

#### Phase M5: Notifications (Week 5) - NOT STARTED
- [ ] **Push Notifications Setup**
  - [ ] expo-notifications config
  - [ ] FCM/APNs tokens
  - [ ] Token storage in Supabase
- [ ] **Notification Handling**
  - [ ] Background handlers
  - [ ] Deep linking from notifications
  - [ ] Notification list screen
- [ ] **Notification Types**
  - [ ] Booking confirmations
  - [ ] Queue turn alerts
  - [ ] Payment reminders

#### Phase M6: Polish (Weeks 6-7) - NOT STARTED
- [ ] **Match History Screen**
  - [ ] Match list
  - [ ] Stats summary
  - [ ] Filter by result
- [ ] **Ratings & Reviews**
  - [ ] Post-game rating prompt
  - [ ] Court review submission
- [ ] **Offline Support**
  - [ ] React Query with AsyncStorage persister
  - [ ] Offline mutation queue
  - [ ] Sync status indicator
- [ ] **Performance**
  - [ ] Image caching
  - [ ] List virtualization
  - [ ] Bundle size optimization
- [ ] **App Store Prep**
  - [ ] App icons and splash
  - [ ] Store screenshots
  - [ ] Privacy policy
  - [ ] EAS Build config

### Mobile UI/UX Guidelines

#### Dark Theme Colors
```
Background:  #0A0A0F (near-black)
Surface:     #12121A (cards)
Primary:     #FF6B35 (Rallio orange)
Text:        #FFFFFF / #A1A1AA / #71717A
Success:     #22C55E
Error:       #EF4444
```

#### Glassmorphism Rules
- Cards: 5% white bg, 10% white border, borderRadius: 16
- Modals: 60% black overlay, blur: 8px
- Nav bar: 80% opacity, frosted effect
- NO heavy glow or excessive blur

#### Accessibility
- 44×44pt minimum touch targets
- 4.5:1 contrast ratio
- System font scaling support
- VoiceOver/TalkBack labels

### Web → Mobile Feature Mapping

| Web Feature | Mobile Enhancement |
|-------------|-------------------|
| Login page | + Biometric (Face ID/Touch ID) |
| Courts listing | + Pull-to-refresh, location sort |
| Map view | + Current location button, clusters |
| Venue details | + Bottom sheet on map tap |
| Date picker | + Today/Tomorrow quick buttons |
| Time slots | + Horizontal scroll, one-tap book |
| Payments | + Deep link to GCash/Maya app |
| Queue position | + Push notification on turn |

### Key Libraries
- **Navigation**: expo-router (file-based)
- **Maps**: react-native-maps
- **State**: Zustand + AsyncStorage
- **Forms**: react-hook-form + zod
- **UI**: react-native-reanimated, expo-blur, @gorhom/bottom-sheet
- **Notifications**: expo-notifications

---

## Phase 9: Advanced Features

### AI Recommendations
- [ ] Design recommendation algorithm
- [ ] Implement court suggestions
- [ ] Create player matching improvements
- [ ] Add preference learning

### Analytics
- [ ] Set up analytics tracking
- [ ] Create usage dashboards
- [ ] Implement conversion tracking
- [ ] Build retention metrics

### Search Improvements
- [ ] Evaluate Elasticsearch need
- [ ] Implement full-text search
- [ ] Add search suggestions
- [ ] Create saved searches

---

## Phase 10: Launch Preparation

### Security
- [ ] Conduct security audit
- [ ] Review RLS policies
- [ ] Implement rate limiting
- [ ] Add API request validation
- [ ] Set up security monitoring

### Testing
- [ ] Write unit tests for utilities
- [ ] Write integration tests for API
- [ ] Create E2E tests for critical flows
- [ ] Perform load testing
- [ ] Conduct user acceptance testing

### Documentation
- [ ] Complete API documentation
- [ ] Write user guides
- [ ] Create admin documentation
- [ ] Document deployment process

### Deployment
- [ ] Set up production Supabase project
- [ ] Configure Vercel for web deployment
- [ ] Set up EAS for mobile builds
- [ ] Configure monitoring (Sentry)
- [ ] Set up error alerting
- [ ] Create deployment checklists

### Beta Testing
- [ ] Recruit beta venues
- [ ] Create feedback collection system
- [ ] Track and fix beta issues
- [ ] Iterate based on feedback

---

## Phase 11: Testing & Quality Assurance - 0% COMPLETE ❌

### Test Infrastructure (CRITICAL - No tests exist)
- [ ] Set up Jest + Testing Library
- [ ] Set up Playwright for E2E
- [ ] Configure test database/mocking for Supabase
- [ ] Add CI test pipeline (GitHub Actions)

### Unit Tests (Priority Order)
1. [ ] `web/src/app/actions/payment-actions.ts` - Payment flow
2. [ ] `web/src/app/actions/reservation-actions.ts` - Booking logic
3. [ ] `web/src/app/actions/queue-actions.ts` - Queue management
4. [ ] `shared/src/validations/` - Zod schemas
5. [ ] `shared/src/utils/` - Utility functions

### Integration Tests
- [ ] Auth flow (signup → verify → login)
- [ ] Booking flow (select → pay → confirm)
- [ ] Queue flow (join → play → pay → leave)
- [ ] Admin operations (CRUD for venues/courts)

### E2E Tests (Playwright)
- [ ] Complete booking journey
- [ ] Payment webhook simulation
- [ ] Queue master session management
- [ ] Court admin dashboard operations
- [ ] Global admin user management

### Manual Test Documentation
- [x] 31 test cases documented in `docs/TESTING-PHASE-1-2.md`
- [ ] Automate documented test cases

---

## Backlog (Future Considerations)

- [ ] Social login (Facebook, Apple)
- [ ] SMS notifications (Twilio/Semaphore)
- [ ] Tournament management
- [ ] Team/club features
- [ ] Coaching services marketplace
- [ ] Equipment rental integration
- [ ] Multi-language support
- [ ] Expansion to other cities
- [ ] Progressive Web App (PWA)
- [ ] Offline mode improvements
