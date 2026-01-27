# Rallio Mobile App - Development Tasks

**Last Updated:** January 27, 2026  
**Target:** React Native + Expo 54 (Player role only)  
**Estimated Duration:** 7 weeks

---

## Phase 1: Foundation (Week 1)

### 1.1 Theme & Base Components
- [ ] Create `constants/Colors.ts` with dark theme palette
- [ ] Create `constants/Spacing.ts` with spacing scale
- [ ] Build `components/ui/Card.tsx` (glassmorphism)
- [ ] Build `components/ui/Button.tsx` (primary/secondary)
- [ ] Build `components/ui/Input.tsx` (with error states)
- [ ] Build `components/ui/Avatar.tsx`
- [ ] Create loading, empty, and error state components

### 1.2 Supabase Setup
- [ ] Create `lib/supabase.ts` with AsyncStorage session
- [ ] Configure auth state listener
- [ ] Test session persistence on app restart
- [ ] Set up environment variables

### 1.3 Authentication Screens
- [ ] Build Login screen (`app/(auth)/login.tsx`)
  - [ ] Email input with validation
  - [ ] Password input with show/hide
  - [ ] Login button with loading state
  - [ ] "Forgot password" link
  - [ ] Google OAuth button
- [ ] Build Signup screen (`app/(auth)/signup.tsx`)
  - [ ] Multi-field form (name, email, password, phone)
  - [ ] Zod validation from `@rallio/shared`
  - [ ] Terms checkbox
  - [ ] Google OAuth option
- [ ] Build Forgot Password screen
- [ ] Implement Google OAuth with `expo-auth-session`
- [ ] Add biometric auth option (Face ID/Touch ID)

### 1.4 Auth Store
- [ ] Create `store/auth-store.ts` with Zustand
- [ ] Implement sign in action
- [ ] Implement sign out action
- [ ] Persist session to AsyncStorage
- [ ] Auto-login on app launch

---

## Phase 2: Court Discovery (Week 2)

### 2.1 Home Screen
- [ ] Create Home screen (`app/(tabs)/index.tsx`)
  - [ ] Welcome header with user avatar
  - [ ] Quick action buttons (Book, Queue, Map)
  - [ ] "Near You" courts section
  - [ ] "Active Queues" section

### 2.2 Courts List
- [ ] Build CourtCard component
  - [ ] Venue image
  - [ ] Name, distance, price
  - [ ] Rating stars
  - [ ] Court type badge
- [ ] Create Courts list screen (`app/(tabs)/courts.tsx`)
  - [ ] FlatList with CourtCards
  - [ ] Pull-to-refresh
  - [ ] Search input (debounced)
  - [ ] Empty state
- [ ] Implement filter bottom sheet
  - [ ] Court type (indoor/outdoor)
  - [ ] Price range
  - [ ] Distance
  - [ ] Amenities
- [ ] Add sorting (distance, price, rating)

### 2.3 Map View
- [ ] Install react-native-maps
- [ ] Build Map screen (`app/(tabs)/map.tsx`)
  - [ ] MapView with Google provider
  - [ ] Current location button
  - [ ] Court markers
- [ ] Add marker clustering
- [ ] Implement marker tap → bottom sheet

### 2.4 Venue Details
- [ ] Create Venue screen (`app/courts/[id]/index.tsx`)
  - [ ] Image carousel
  - [ ] Name, address, distance
  - [ ] Operating hours
  - [ ] Amenities list
  - [ ] Price info
  - [ ] Reviews preview
- [ ] Add "Book" and "Join Queue" buttons

---

## Phase 3: Booking Flow (Week 3)

### 3.1 Date Selection
- [ ] Create Book screen (`app/courts/[id]/book.tsx`)
- [ ] Build date picker component
  - [ ] Calendar month view
  - [ ] Today/Tomorrow quick buttons
  - [ ] Blocked dates handling

### 3.2 Time Slots
- [ ] Build time slot selector
  - [ ] Horizontal scroll of slots
  - [ ] Available/unavailable states
  - [ ] Price per slot
  - [ ] One-tap selection

### 3.3 Booking Confirmation
- [ ] Create confirmation modal
  - [ ] Court summary
  - [ ] Date/time selected
  - [ ] Total amount
  - [ ] Payment method selector
- [ ] Implement reservation creation API call

### 3.4 Payment Integration
- [ ] Create checkout screen (`app/checkout/[reservationId].tsx`)
- [ ] Integrate PayMongo checkout URL
  - [ ] WebView option
  - [ ] Deep link to GCash/Maya apps
- [ ] Build success screen with haptic feedback
- [ ] Build failed screen with retry option

### 3.5 Booking Management
- [ ] Create Bookings screen (`app/(tabs)/bookings.tsx`)
  - [ ] FlatList of reservations
  - [ ] Filter by status
  - [ ] Pull-to-refresh
- [ ] Implement cancellation flow
  - [ ] Confirm modal
  - [ ] 24-hour window enforcement
  - [ ] Success/error feedback

---

## Phase 4: Queue System (Week 4)

### 4.1 Queue Discovery
- [ ] Create Queue screen (`app/queue/index.tsx`)
  - [ ] Nearby active queues list
  - [ ] Real-time participant counts
  - [ ] Search by venue

### 4.2 QueueCard Component
- [ ] Build QueueCard component
  - [ ] Venue name, court
  - [ ] Format (singles/doubles)
  - [ ] Participant count / max
  - [ ] Cost per game
  - [ ] Join button

### 4.3 Queue Participation
- [ ] Create Queue Detail screen (`app/queue/[id]/index.tsx`)
  - [ ] Session info card
  - [ ] Participant list
  - [ ] Current position indicator
  - [ ] Estimated wait time
- [ ] Implement join queue action
  - [ ] Confirmation modal
  - [ ] Loading state
  - [ ] Success feedback

### 4.4 Real-time Updates
- [ ] Set up Supabase Realtime subscription
  - [ ] Listen to queue_participants changes
  - [ ] Update position in real-time
  - [ ] Handle session status changes

### 4.5 Leave Queue
- [ ] Implement leave queue action
  - [ ] Payment check if games played
  - [ ] Queue payment modal
  - [ ] PayMongo integration
- [ ] Handle payment completion

---

## Phase 5: Notifications (Week 5)

### 5.1 Push Setup
- [ ] Install expo-notifications
- [ ] Configure Android (FCM)
- [ ] Configure iOS (APNs)
- [ ] Request notification permissions

### 5.2 Token Management
- [ ] Register push token on login
- [ ] Store token in `profiles.push_token`
- [ ] Update token on change

### 5.3 Notification Handling
- [ ] Handle foreground notifications
- [ ] Handle background notifications
- [ ] Implement deep linking from notifications

### 5.4 Notification Screen
- [ ] Build Notifications screen
  - [ ] List of notifications
  - [ ] Mark as read
  - [ ] Clear all

---

## Phase 6: Profile & Polish (Week 6)

### 6.1 Profile Screen
- [ ] Enhance Profile tab (`app/(tabs)/profile.tsx`)
  - [ ] User avatar and name
  - [ ] Skill level badge
  - [ ] Match stats (wins/losses)
  - [ ] Play style tags
- [ ] Add logout button

### 6.2 Profile Edit
- [ ] Create Edit Profile screen
  - [ ] Avatar upload (camera/gallery)
  - [ ] Name editing
  - [ ] Skill level slider
  - [ ] Play style selection

### 6.3 Match History
- [ ] Build Match History screen
  - [ ] List of matches
  - [ ] Filter by result
  - [ ] Stats summary

### 6.4 Settings
- [ ] Create Settings screen
  - [ ] Notification preferences
  - [ ] Privacy settings
  - [ ] About/Version info
  - [ ] Logout

---

## Phase 7: Launch Prep (Week 7)

### 7.1 Offline Support
- [ ] Implement caching with React Query + AsyncStorage
- [ ] Add offline indicators
- [ ] Queue mutations for sync

### 7.2 Performance
- [ ] Profile and fix slow screens
- [ ] Optimize FlatList renders
- [ ] Add image caching

### 7.3 Visual Polish
- [ ] Add loading skeletons
- [ ] Implement haptic feedback
- [ ] Add micro-animations
- [ ] Test dark mode consistency

### 7.4 App Store Prep
- [ ] Create app icon
- [ ] Create splash screen
- [ ] Generate store screenshots (iPhone, Android)
- [ ] Write app store description

### 7.5 Build & Deploy
- [ ] Configure EAS Build
- [ ] Test production build on device
- [ ] Fix any production-only issues
- [ ] Submit for review

---

## Acceptance Criteria

### MVP Must Have
- [ ] User can login/signup with email or Google
- [ ] User can browse and search courts
- [ ] User can view courts on map
- [ ] User can book court with GCash/Maya
- [ ] User can view and cancel bookings
- [ ] User can join and leave queues
- [ ] User sees real-time queue position

### Nice to Have for MVP
- [ ] Push notifications for queue turns
- [ ] Biometric login
- [ ] Match history screen
- [ ] Offline court list viewing

---

## Technical Debt Tracking

| Issue | Priority | Notes |
|-------|----------|-------|
| Add unit tests | High | After MVP, before v1.1 |
| Error boundary coverage | Medium | Wrap all screens |
| Performance monitoring | Medium | Add Sentry after launch |
| i18n setup | Low | Future feature |
