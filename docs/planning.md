# Rallio Development Planning

## Vision

Build a comprehensive Badminton Court Finder & Queue Management System for Zamboanga City, Philippines, starting with core functionality and expanding to advanced features.

## Development Phases

### Phase 1: Foundation & Core Auth (Current)
**Goal:** Establish project infrastructure and authentication system

- [x] Project scaffolding and monorepo setup
- [x] Shared types, validations, and utilities
- [x] Web folder structure (components, hooks, stores, lib)
- [x] Mobile folder structure (services, hooks, store)
- [x] Database schema design (27 tables)
 - [ ] Supabase project setup and migration (in-progress)
	 - Notes: Added server middleware (`src/middleware.ts`) plan to run session refresh on each request. Next steps: create Supabase project, run `supabase db reset` / apply SQL migrations from `backend/migrations` or `web/supabase/migrations`, and enable RLS policies.
	- Update: Root middleware file was added under `web/src/middleware.ts` to call the existing `updateSession` helper. To apply migrations locally:
		1. Install Supabase CLI: `npm install -g supabase`
		2. Login and link project: `supabase login` then `supabase link --project-ref <ref>`
		3. Run migrations: `supabase db reset --file backend/supabase/migrations/001_initial_schema.sql` (or use `supabase db push` depending on workflow).
		4. Seed data: `psql <seed file>` or use `supabase` CLI seed commands.
- [ ] Authentication flow (signup, login, forgot password)
- [ ] User profile management
- [ ] Player profile with skill level

### Phase 2: Court Discovery & Display
**Goal:** Allow players to find and view courts

- [ ] Venue and court data models
- [ ] Court listing page with filters
- [ ] Mapbox integration for location-based search
- [ ] Court detail page with amenities, pricing, photos
- [ ] Distance calculation and sorting
- [ ] Court availability calendar

### Phase 3: Reservations & Payments
**Goal:** Enable court booking and payment processing

- [ ] Reservation creation flow
- [ ] Time slot selection with conflict prevention
- [ ] PayMongo integration (GCash, Maya, QR codes)
- [ ] Payment confirmation webhooks
- [ ] Booking confirmation and reminders
- [ ] Cancellation and refund flow
- [ ] Split payment system for groups

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

### Phase 6: Admin Dashboards
**Goal:** Management interfaces for all roles

- [ ] Court Admin dashboard (reservations, pricing, analytics)
- [ ] Queue Master dashboard (session management)
- [ ] Global Admin dashboard (platform management)
- [ ] Dynamic pricing configuration
- [ ] Discount and promo code management

### Phase 7: Notifications & Communication
**Goal:** Keep users informed

- [ ] Push notifications (FCM)
- [ ] Email notifications (SendGrid)
- [ ] In-app notification center
- [ ] Queue turn alerts
- [ ] Payment confirmations
- [ ] Booking reminders

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

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Real-time sync issues | Fallback to polling, conflict resolution |
| Payment failures | Retry mechanism, manual reconciliation |
| Low venue adoption | Free tier, comprehensive onboarding |
| Performance issues | Caching, pagination, lazy loading |
| Security breaches | Regular audits, encryption, RBAC |
