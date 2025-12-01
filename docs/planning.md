# Rallio Development Planning

## Vision

Build a comprehensive Badminton Court Finder & Queue Management System for Zamboanga City, Philippines, starting with core functionality and expanding to advanced features.

---

## ✅ Verification Status (Dec 1, 2025)

**Build Status:** ✅ PASSING (Zero TypeScript errors)
**Phases 1-3 Status:** ✅ VERIFIED & OPERATIONAL

### Quick Status:
- **Phase 1 (Auth)**: 100% Complete ✅
- **Phase 2 (Discovery)**: 85% Complete ✅
- **Phase 3 (Payments)**: 85% Complete ✅
- **Phase 4 (Queues)**: 70% Complete 🚧
- **Phase 6 (Admin)**: 60% Complete 🚧 (Recent work completed)
- **Phase 7 (Notifications)**: 40% Complete 🚧 (In-app notifications done)

### Recent Completions (Dec 2025):
1. **Court Admin Multi-Venue Support** ✅
   - VenueSelector component created
   - Applied to 4 pages (Analytics, Pricing, Availability, Reviews)
   - URL param-based filtering
   - Testing guide created (31 test cases)

2. **In-App Notification System** ✅
   - Real-time Supabase subscriptions
   - NotificationBell with dropdown
   - Queue approval notifications
   - Mark as read functionality
   - Type-based icons and colors

3. **Queue Approval Workflow** ✅
   - Migration 012 applied
   - Database triggers for automatic notifications
   - 48-hour expiration
   - Court Admin approval interface

### Verification Documentation:
- `/VERIFICATION-PHASES-1-2-3.md` - Comprehensive verification report
- `/TESTING-PHASE-1-2.md` - 31 test cases for recent work

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

### Phase 4: Queue Management
**Goal:** Real-time queue sessions for pickup games

- [ ] Queue session creation (Queue Master)
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

### Phase 6: Admin Dashboards - 60% COMPLETE 🚧
**Goal:** Management interfaces for all roles

#### Court Admin Dashboard ✅ IMPLEMENTED (Dec 2025)
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

#### Queue Master Dashboard 🚧 40% COMPLETE
- [x] Queue Master dashboard basics
- [x] Session management view
- [ ] Player management interface (needs UI improvements)
- [ ] Dispute resolution UI
- [ ] Session analytics dashboard

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

### Phase 7: Notifications & Communication - 40% COMPLETE 🚧
**Goal:** Keep users informed

#### In-App Notifications ✅ COMPLETE (Dec 1, 2025)
- [x] In-app notification center
  - Real-time Supabase subscriptions
  - Notification bell with badge
  - Dropdown notification list
  - Mark as read functionality
  - Type-based icons and colors
  - Click-to-navigate functionality
  - Empty and loading states
  - Integration with Court Admin layout
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
## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Real-time sync issues | Fallback to polling, conflict resolution |
| Payment failures | Retrys
| Low venue adoption | Free tier, comprehensive onboarding |
| Performance issues | Caching, pagination, lazy loading |
| Security breaches | Regular audits, encryption, RBAC |
