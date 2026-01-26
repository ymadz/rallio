# Rallio Development Planning

## Vision

Build a comprehensive Badminton Court Finder & Queue Management System for Zamboanga City, Philippines, starting with core functionality and expanding to advanced features.

---

## ✅ Verification Status (Jan 26, 2026 - Full Audit)

**Build Status:** ✅ PASSING (Zero TypeScript errors)
**Last Audit:** January 26, 2026

### Phase Completion Summary:
| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1 (Auth) | ✅ Complete | 100% |
| Phase 2 (Discovery) | ✅ Complete | 90% |
| Phase 3 (Payments) | ✅ Complete | 90% |
| Phase 4 (Queues) | ✅ Complete | 90% |
| Phase 5 (Ratings) | ⏳ Not Started | 0% |
| Phase 6 (Admin) | ✅ Complete | 90% |
| Phase 7 (Notifications) | 🚧 Partial | 50% |
| Phase 8 (Mobile) | 🚧 In Progress | 30% |
| Testing & QA | ❌ Critical Gap | 0% |

### What's Working (Jan 2026):
1. ✅ **Authentication** - Email + Google OAuth, auto profile creation
2. ✅ **Court Discovery** - Leaflet maps, PostGIS search, filters working
3. ✅ **Full Booking Flow** - Calendar, PayMongo webhooks fixed
4. ✅ **Queue System** - Real-time position, match recording, payments
5. ✅ **Court Admin Dashboard** - Multi-venue, pricing, analytics
6. ✅ **Queue Master Dashboard** - Session mgmt, score recording
7. ✅ **Global Admin Dashboard** - User/venue mgmt, moderation, settings
8. ✅ **In-App Notifications** - Real-time bell with badge

### Critical Issues Found:
1. 🔴 No test coverage (zero tests)
2. 🔴 100+ console.log statements in production code
3. 🔴 In-memory rate limiter won't scale
4. 🔴 Role assignment duplicate key error
5. 🟡 Duplicate Supabase service client files
6. 🟡 Email notifications not implemented
7. 🟡 Payment expiration not automated

---

## Development Phases

### Phase 1: Foundation & Core Auth ✅ COMPLETE
**Goal:** Establish project infrastructure and authentication system

- [x] Project scaffolding and monorepo setup
- [x] Shared types, validations, and utilities
- [x] Web folder structure (components, hooks, stores, lib)
- [x] Mobile folder structure (services, hooks, store)
- [x] Database schema design (27 tables)
- [x] Supabase project setup and migration
	- ✅ V2 schema applied via `supabase db push`
	- ✅ Database confirmed up to date
	- ✅ All tables created with RLS policies
	- ✅ Sample data inserted (2 venues, 8 courts)
- [x] Authentication flow (signup, login, forgot password)
	- ✅ Supabase Auth integrated
	- ✅ Google OAuth supported
	- ✅ Auto-profile creation via triggers
	- ✅ Fixed users→profiles table references
- [x] User profile management
	- ✅ Profile onboarding flow complete
	- ✅ Avatar upload to Supabase Storage
- [x] Player profile with skill level
	- ✅ Skill level selection (1-10)
	- ✅ Play styles, birth date, gender

### Phase 2: Court Discovery & Display - 85% COMPLETE ✅
**Goal:** Allow players to find and view courts

- [x] Venue and court data models (API client in `/lib/api/`)
- [x] Court listing page with filters (`/courts/page.tsx`)
- [x] Leaflet integration for location-based search (OpenStreetMap tiles)
- [x] Court detail page with amenities, pricing, photos (`/courts/[id]/page.tsx`)
- [x] Distance calculation and sorting (PostGIS `nearby_venues()` function)
- [x] Court availability calendar (integrated into booking flow)
- [ ] Enhanced filtering (price range sliders, amenity checkboxes)
- [ ] Mobile implementation

**Key Achievements:**
- Leaflet map with custom markers and clustering
- PostGIS geospatial queries for efficient radius search
- Dynamic venue detail pages with image galleries
- SSR handling for client-only map components

### Phase 3: Reservations & Payments - 85% COMPLETE ✅
**Goal:** Enable court booking and payment processing

- [x] Reservation creation flow (`/courts/[id]/book/`)
- [x] Time slot selection with conflict prevention
  - Calendar UI component with date picker
  - TimeSlotGrid component with real-time availability
  - Database exclusion constraint prevents double booking
- [x] PayMongo integration (GCash, Maya)
  - Custom PayMongo client library (`/lib/paymongo/`)
  - Payment source creation (GCash, Maya)
  - Checkout URL generation with QR codes
- [x] Payment confirmation webhooks (`/api/webhooks/paymongo/`)
  - Handles `source.chargeable`, `payment.paid`, `payment.failed`
  - ✅ **Fixed webhook signature verification** (uses `te=` and `li=` fields)
  - ✅ **Fixed source.type** (uses literal `'source'` instead of payment method)
  - Idempotency handling for duplicate events
  - Webhooks now properly accept with 200 status
  - Payment flow fully functional: pending → completed
- [x] Booking management pages (`/bookings`, `/reservations`)
- [x] Cancellation flow (server action)
- [x] Database-level double booking prevention (migration 004)
  - Exclusion constraint using btree_gist
  - Validation triggers
  - Active reservations and payment summary views
- [x] Payment expiration function (15-minute timeout)
- [x] Home page enhancements
  - "Queue" button linking to `/queue`
  - Real venue data for "Suggested Courts" section
  - Geolocation-based "Near You" section
  - "Active Queues Nearby" section
- [ ] Payment receipt email notifications
- [ ] Booking reminder notifications
- [ ] Split payment system backend implementation
- [ ] Refund flow for cancellations
- [ ] Payment expiration automation (Edge Function/cron job)
- [ ] QR code image generation (currently using PayMongo URLs)

**Key Achievements:**
- Complete booking flow from court selection to payment
- Robust double booking prevention at database level
- ✅ **Fully functional PayMongo webhook integration** with proper signature verification
- ✅ **Payment status updates working correctly** (pending → completed → confirmed)
- Real-time availability checking
- Split payment database schema ready (UI partial, backend incomplete)
- Enhanced home page with real venue data and geolocation

**Technical Debt & Known Issues:**
- Migration 005 (RLS policies) created but not applied
- Payment expiration function exists but not automated (needs scheduled job)
- Split payment UI designed but backend logic incomplete
- No email/SMS notifications yet
- Cash payment handling not implemented

### Phase 4: Queue Management - 85% COMPLETE ✅
**Goal:** Real-time queue sessions for pickup games

#### User Queue Features ✅ COMPLETE
- [x] Queue discovery dashboard
- [x] Browse nearby active queues
- [x] View queue details (court, venue, players, wait time)
- [x] Join queue with validation
- [x] Leave queue with payment enforcement
- [x] Real-time position updates
- [x] Estimated wait time calculation
- [x] View all participants

#### Queue Master Features ✅ 90% COMPLETE
- [x] Queue session creation form
  - Court selection, time range, mode, format
  - Max players (4-20), cost per game
  - Public/private toggle
- [x] Session management (pause/resume/close)
- [x] Session dashboard with metrics
- [x] Match assignment from queue
  - Visual player selection
  - Auto-balanced teams
  - Skill level display
- [x] Score recording with auto-winner detection
- [x] Payment tracking and management
- [x] Waive fee functionality
- [x] Analytics dashboard
  - Revenue tracking
  - Top players
  - Game distribution charts
- [x] Real-time updates via Supabase
- [x] Queue approval workflow (requires Court Admin approval)

#### Backend & Database ✅ 95% COMPLETE
- [x] Server actions for all queue operations
- [x] Database schema (queue_sessions, queue_participants, matches)
- [x] RLS policies for security
- [x] Real-time Supabase subscriptions
- [x] Comprehensive error handling
- [x] Payment enforcement logic

#### Pending Items
- [ ] PayMongo integration for queue payments (placeholder exists)
- [ ] Session summary reports
- [ ] Enhanced dispute resolution UI
- [ ] Player notifications when matches assigned
- [ ] Mobile queue implementation
- [ ] Player join/leave queue
- [ ] Real-time queue updates (Supabase Realtime)
- [ ] Skill-based team balancing algorithm
- [ ] Game assignment and tracking
- [ ] Per-game cost calculation
- [ ] Session closure and summary

### Phase 5: Ratings & Reviews
**Goal:** Build trust through ratings

- [ ] Court rating system (quality, cleanliness, facilities, value)
- [ ] Player rating system (sportsmanship, skill, reliability)
- [ ] Review moderation
- [ ] Venue owner response to reviews
- [ ] Rating analytics and trends

### Phase 5: Ratings & Reviews - 0% NOT STARTED ⏳
**Goal:** Build trust through ratings

- [ ] Court rating system (quality, cleanliness, facilities, value)
- [ ] Player rating system (sportsmanship, skill, reliability)
- [ ] Review moderation
- [ ] Venue owner response to reviews
- [ ] Rating analytics and trends

### Phase 6: Admin Dashboards - 70% COMPLETE 🚧
**Goal:** Management interfaces for all roles

#### Court Admin Dashboard ✅ 90% COMPLETE (Dec 2025)
- [x] Court Admin dashboard (reservations, pricing, analytics)
  - Dashboard with revenue stats and analytics
  - Reservations management page
  - Venue management (create, edit, delete)
  - Court management
  - Pricing management with discount rules
  - Availability management with blocked dates
  - Reviews management
  - Queue approval workflow
- [x] Multi-venue support (VenueSelector component) ✅ **Phase 1 Complete** (Dec 1, 2025)
  - VenueSelector component for venue selection
  - URL param-based venue filtering
  - Auto-selection for single venue owners
  - Empty state with CTA for no venues
  - Applied to: Analytics, Pricing, Availability, Reviews pages
- [x] In-app notification system ✅ **Phase 2 Complete** (Dec 1, 2025)
  - NotificationBell component with unread badge
  - Real-time notifications via Supabase subscriptions
  - NotificationList with empty/loading states
  - NotificationItem with type-based icons/colors
  - Mark as read functionality (single and bulk)
  - Click to navigate to action URL
  - Integration with Court Admin layout header
- [x] Queue approval workflow (Migration 012) ✅
  - `requires_approval` flag on queue sessions
  - `approval_status` field (pending/approved/rejected)
  - 48-hour automatic expiration
  - Database triggers for notifications
  - Court Admin approval interface
- [x] Blocked dates management (Migration 014) ✅
  - Moved from metadata to dedicated table
  - Better querying and management
  - RLS policies for court admins
- [x] Dynamic pricing configuration
  - Discount rules system
  - Holiday pricing
  - Multi-day discounts
  - Early bird pricing
  - Promo code management (partial)

#### Queue Master Dashboard ✅ 90% COMPLETE (Nov 2025)
- [x] Queue Master dashboard with metrics
- [x] Session creation form
- [x] Session management view (list with filters)
- [x] Session details page with real-time updates
- [x] Match assignment interface
- [x] Score recording modal
- [x] Payment tracking and management
- [x] Waive fee functionality
- [x] Analytics dashboard (revenue, top players, charts)
- [x] Real-time Supabase subscriptions
- [ ] PayMongo QR generation for payments (placeholder)
- [ ] Enhanced dispute resolution UI
- [ ] Session summary reports

#### Global Admin Dashboard ⏳ PENDING
- [ ] Platform overview dashboard
- [ ] User management interface
- [ ] Venue approval flow
- [ ] Platform analytics

**Recent Achievements (Dec 2025):**
- 🎉 VenueSelector pattern implemented across 4 pages
- 🎉 Real-time notification system with Supabase subscriptions
- 🎉 Queue approval workflow with automatic notifications
- 🎉 Blocked dates moved to proper table structure
- 🎉 Comprehensive testing documentation created
- 🎉 Build verified with zero TypeScript errors

**Pending Work:**
- Queue-reservation conflict prevention (double booking risk)
- Refund processing via PayMongo API
- Email/SMS notification integration
- Complete promo code functionality

### Phase 7: Notifications & Communication - 50% COMPLETE 🚧
**Goal:** Keep users informed

#### In-App Notifications ✅ COMPLETE (Dec 1, 2025)
- [x] In-app notification center
  - Real-time Supabase subscriptions
  - Notification bell with badge
  - Dropdown notification list
  - Mark as read functionality (single and bulk)
  - Type-based icons and colors
  - Click-to-navigate functionality
  - Empty and loading states
  - Integration with Court Admin layout
- [x] Database triggers for automatic notifications
  - Queue approval requests
  - Approval decisions (approved/rejected)
- [x] Notification types system (10 types defined)
- [x] Server actions (get, mark read, delete)
- [x] useNotifications hook with real-time updates
- [x] Queue approval notifications (via database triggers)
  - Court Admin notified on new queue request
  - Organizer notified on approval/rejection
  - Automatic notifications via triggers
- [x] Notification types system
  - 10 notification types defined
  - Icon/color mapping
  - Action URL support

#### Pending Notifications
- [ ] Push notifications (FCM)
- [ ] Email notifications (SendGrid)
  - [ ] Booking confirmations
  - [ ] Payment receipts
  - [ ] Queue turn alerts
  - [ ] Reminder emails
- [ ] SMS notifications (optional)
- [ ] Notification preferences UI

### Phase 8: Mobile App Polish
**Goal:** Full-featured mobile experience

- [ ] Mobile auth flows
- [ ] Mobile court discovery with maps
- [ ] Mobile reservations
- [ ] Mobile queue participation
- [ ] Mobile profile and stats

### Phase 9: Advanced Features
**Goal:** AI and advanced functionality

- [ ] AI-powered court recommendations
- [ ] Player auto-matching improvements
- [ ] Analytics dashboards
- [ ] Performance optimization
- [ ] Advanced search (Elasticsearch)

### Phase 10: Launch Preparation
**Goal:** Production readiness

- [ ] Security audit
- [ ] Performance testing
- [ ] Documentation completion
- [ ] Beta testing with real venues
- [ ] Production deployment
- [ ] Monitoring and error tracking

## Technical Approach

### API Strategy
- Use Supabase for auth, database, and real-time
- Edge functions for complex business logic
- PayMongo webhooks for payment confirmation

### Real-time Strategy
- Supabase Realtime for queue updates
- Optimistic UI updates for better UX
- Reconnection handling for mobile

### Mobile Strategy
- Expo Router for navigation
- Shared business logic with web via shared package
- Native maps and location services

### Testing Strategy
- Unit tests for utilities and hooks
- Integration tests for API flows
- E2E tests for critical user journeys

## Success Metrics

- User registration and retention
- Court bookings per week
- Queue session participation
- Payment completion rate
- Average court rating
- App store ratings (mobile)
m
## What's Next - Priority Roadmap

### 🔥 High Priority (Next Sprint)

#### 1. Complete Queue System Polish (Remaining 15%)
- [ ] PayMongo integration for queue payments
- [ ] Session summary reports
- [ ] Player notifications when matches assigned
- [ ] Queue-reservation conflict prevention

#### 2. Phase 5: Ratings & Reviews System (0% → 80%)
- [ ] Court rating system (quality, cleanliness, facilities, value)
- [ ] Player rating system (sportsmanship, skill, reliability)
- [ ] Review submission UI for players
- [ ] Rating analytics for Court Admins
- [ ] Rating display on court detail pages

#### 3. Email/SMS Notifications (Phase 7: 50% → 75%)
- [ ] Set up SendGrid for emails
- [ ] Booking confirmation emails
- [ ] Payment receipt emails
- [ ] Queue turn alert emails
- [ ] Reminder emails (24 hours before booking)
- [ ] SMS notifications via Twilio/Semaphore (optional)

### 🎯 Medium Priority (Next Month)

#### 4. Court Admin Enhancements
- [ ] Refund processing UI via PayMongo
- [ ] Complete promo code system
- [ ] Court photo management UI
- [ ] Advanced analytics (conversion rates, booking trends)
- [ ] Staff management (assign staff to venues)

#### 5. Player Experience Improvements
- [ ] Split payment backend completion
- [ ] Booking modification/rescheduling
- [ ] Enhanced court filtering (price sliders, amenity checkboxes)
- [ ] Favorite venues feature
- [ ] Booking history export

#### 6. Global Admin Features
- [ ] Venue approval workflow
- [ ] Dispute escalation system
- [ ] Financial reconciliation dashboard
- [ ] Advanced system health monitoring
- [ ] Promotional campaign management

### 📱 Lower Priority (Later)

#### 7. Mobile App Development (0% → 80%)
- [ ] Port authentication flows to mobile
- [ ] Mobile court discovery with react-native-maps
- [ ] Mobile booking flow
- [ ] Mobile queue participation
- [ ] Mobile profile management
- [ ] Push notifications (FCM)
- [ ] App store deployment (iOS/Android)

#### 8. Advanced Features (Phase 9)
- [ ] AI-powered court recommendations
- [ ] Player auto-matching based on skill level
- [ ] Tournament management system
- [ ] Team/club features
- [ ] Coaching marketplace
- [ ] Equipment rental integration

#### 9. Launch Preparation (Phase 10)
- [ ] Security audit
- [ ] Performance testing & optimization
- [ ] Documentation completion
- [ ] Beta testing with 5-10 venues
- [ ] Production deployment checklist
- [ ] Monitoring setup (Sentry, Datadog)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Real-time sync issues | Fallback to polling, conflict resolution |
| Payment failures | Retry logic, webhook idempotency, manual reconciliation |
| Low venue adoption | Free tier, comprehensive onboarding, marketing support |
| Performance issues | Caching, pagination, lazy loading, CDN for images |
| Security breaches | Regular audits, encryption, RBAC, rate limiting |
| Double bookings | Database exclusion constraints, real-time availability checks |
| Payment disputes | Clear refund policy, admin override tools, audit logs |

---

## Recent Achievements Summary

### What Works Right Now (Dec 1, 2025):
1. ✅ **Complete Authentication** - Email, Google OAuth, profile management
2. ✅ **Court Discovery** - Map view, filters, distance search with PostGIS
3. ✅ **Full Booking Flow** - Calendar selection, payment via GCash/Maya, webhooks working
4. ✅ **Queue System** - Join queues, manage sessions, assign matches, track payments
5. ✅ **Court Admin Dashboard** - Multi-venue support, pricing, availability, approvals
6. ✅ **Queue Master Dashboard** - Session management, analytics, score recording
7. ✅ **Global Admin Dashboard** - User/venue management, moderation, settings, audit logs
8. ✅ **In-App Notifications** - Real-time bell, queue approvals, mark as read

### What's Missing for MVP Launch:
1. ⚠️ Email notifications (critical)
2. ⚠️ Rating & review system (important for trust)
3. ⚠️ Mobile app (can launch web-first)
4. ⚠️ Refund processing (manual workaround possible)
5. ⚠️ Split payment backend (can launch without)

**Recommendation:** Focus on ratings/reviews and email notifications for MVP launch. Mobile can follow in Phase 2.
