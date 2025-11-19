# Rallio Task Tracker

## How to Use This File
- [x] Completed tasks
- [ ] Pending tasks
- Tasks are organized by phase and category
- Update this file as you complete tasks

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
  - Book a court, Compete, Help AI buttons
  - Suggested courts section
  - Near you section with court cards
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

## Phase 2: Court Discovery & Display

### Data Models
- [ ] Create venue API functions
- [ ] Create court API functions
- [ ] Create court amenities lookup
- [ ] Add court images handling

### Court Listing (Web)
- [ ] Create courts listing page
- [ ] Implement court card component
- [ ] Add search input with filters
- [ ] Add filter sidebar (price, type, amenities, indoor/outdoor)
- [ ] Implement pagination or infinite scroll
- [ ] Add sorting options (distance, price, rating)

### Court Listing (Mobile)
- [ ] Create courts list screen
- [ ] Implement court card component
- [ ] Add search and filter UI
- [ ] Implement pull-to-refresh

### Map Integration
- [ ] Set up Mapbox GL JS (web)
- [ ] Create map component with court markers
- [ ] Implement click-to-view court details
- [ ] Add user location marker
- [ ] Create map/list toggle view
- [ ] Set up react-native-maps (mobile)
- [ ] Create mobile map view

### Court Detail Page
- [ ] Create court detail page (web)
- [ ] Display venue information
- [ ] Show amenities list
- [ ] Display pricing information
- [ ] Show photo gallery
- [ ] Display ratings and reviews
- [ ] Show availability calendar
- [ ] Add "Book Now" and "Join Queue" buttons
- [ ] Create court detail screen (mobile)

### Geospatial Search
- [ ] Implement distance calculation on backend
- [ ] Create location-based search API
- [ ] Add radius filter
- [ ] Implement bounding box queries for performance
- [ ] Cache popular search results

---

## Phase 3: Reservations & Payments

### Reservation Flow (Web)
- [ ] Create reservation page
- [ ] Build date picker component
- [ ] Build time slot selector with availability
- [ ] Implement booking conflict detection
- [ ] Create booking confirmation modal
- [ ] Add booking notes field
- [ ] Create my reservations page
- [ ] Implement reservation cancellation

### Reservation Flow (Mobile)
- [ ] Create reservation screen
- [ ] Build mobile date/time pickers
- [ ] Create my reservations screen
- [ ] Implement cancellation flow

### Payment Integration
- [ ] Set up PayMongo account
- [ ] Create payment intent API
- [ ] Implement GCash payment flow
- [ ] Implement Maya payment flow
- [ ] Generate QR code for payment
- [ ] Create webhook endpoint for payment confirmation
- [ ] Handle payment success/failure states
- [ ] Create payment receipt/confirmation

### Split Payments
- [ ] Design split payment UI
- [ ] Implement participant invitation
- [ ] Create payment tracking per participant
- [ ] Implement payment deadline logic
- [ ] Create auto-cancellation for incomplete payments
- [ ] Implement refund flow for failed group bookings
- [ ] Send payment reminders to participants

---

## Phase 4: Queue Management

### Queue Session (Queue Master)
- [ ] Create queue session creation form
- [ ] Implement queue parameter settings
- [ ] Create queue dashboard UI
- [ ] Display pending players list
- [ ] Implement player approval/rejection
- [ ] Create game assignment interface
- [ ] Track games per player
- [ ] Implement session closure flow
- [ ] Generate session summary report

### Queue Participation (Player)
- [ ] Create queue discovery UI
- [ ] Show active queues on court pages
- [ ] Implement queue join flow
- [ ] Display real-time queue position
- [ ] Show estimated wait time
- [ ] Create game notification UI
- [ ] Display current game assignment
- [ ] Implement leave queue functionality

### Real-time Updates
- [ ] Set up Supabase Realtime subscriptions
- [ ] Implement optimistic UI updates
- [ ] Handle reconnection gracefully
- [ ] Create real-time player count updates
- [ ] Implement game status broadcasts

### Skill-Based Matching
- [ ] Create matching algorithm
- [ ] Implement ELO rating updates
- [ ] Create team balancing for doubles
- [ ] Add manual override for Queue Master
- [ ] Track match history

### Queue Payments
- [ ] Calculate per-game costs
- [ ] Split costs among participants
- [ ] Generate payment requests
- [ ] Track payment status per player
- [ ] Create payment summary at session end

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

## Phase 6: Admin Dashboards

### Court Admin Dashboard
- [ ] Create dashboard layout
- [ ] Build reservation calendar view
- [ ] Implement booking approval flow
- [ ] Create pricing management UI
- [ ] Add operating hours configuration
- [ ] Build revenue reports
- [ ] Show booking analytics
- [ ] Implement court status management

### Dynamic Pricing
- [ ] Create pricing rule builder
- [ ] Implement peak/off-peak pricing
- [ ] Add holiday surcharge configuration
- [ ] Create multi-day discount settings
- [ ] Implement promo code management
- [ ] Build early bird discount settings

### Queue Master Dashboard
- [ ] Create session management view
- [ ] Build player management interface
- [ ] Implement dispute resolution UI
- [ ] Create game history viewer
- [ ] Build session analytics

### Global Admin Dashboard
- [ ] Create platform overview dashboard
- [ ] Build user management interface
- [ ] Implement venue approval flow
- [ ] Create dispute escalation handling
- [ ] Build platform analytics
- [ ] Implement system configuration UI

---

## Phase 7: Notifications

### Push Notifications
- [ ] Set up Firebase Cloud Messaging
- [ ] Implement notification sending service
- [ ] Create notification preferences UI
- [ ] Handle notification permissions
- [ ] Implement deep linking from notifications

### Email Notifications
- [ ] Set up SendGrid account
- [ ] Create email templates
- [ ] Implement booking confirmation emails
- [ ] Create payment receipt emails
- [ ] Implement reminder emails
- [ ] Create queue turn notifications

### In-App Notifications
- [ ] Create notification center UI
- [ ] Implement notification badge
- [ ] Create notification list view
- [ ] Add mark as read functionality
- [ ] Implement notification filtering

---

## Phase 8: Mobile App Polish

### Navigation
- [ ] Set up proper tab navigation
- [ ] Implement auth stack
- [ ] Create drawer navigation (if needed)
- [ ] Add deep linking configuration

### Screens
- [ ] Complete all mobile screens to match web functionality
- [ ] Optimize for different screen sizes
- [ ] Add proper loading states
- [ ] Implement error handling UI

### Performance
- [ ] Optimize list rendering with FlatList
- [ ] Implement image caching
- [ ] Add offline support where possible
- [ ] Optimize bundle size

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
