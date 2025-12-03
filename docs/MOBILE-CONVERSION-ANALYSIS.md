# Rallio Mobile App Conversion - System Analysis
## Player Role Implementation Plan

**Version:** 1.0
**Date:** December 3, 2025
**Scope:** Player role features only
**Platform:** React Native + Expo 54

---

## Executive Summary

This document provides a comprehensive analysis of the Rallio web application to guide the mobile conversion for **Player role features only**. The mobile app will provide full feature parity with the web application while embracing mobile-native patterns and a dark mode design with green accents.

### Key Statistics
- **Web Pages Analyzed:** 18 player-facing pages
- **API Endpoints:** 47 Supabase queries/server actions
- **Real-time Subscriptions:** 3 queue-related channels
- **Third-party Integrations:** Supabase Auth, PayMongo, Maps
- **Database Tables (Player-relevant):** 15 of 27 tables

---

## 1. User Flow Analysis

### 1.1 Authentication Flow

**Web Implementation:**
- Login: `/app/(auth)/login/page.tsx`
- Signup: `/app/(auth)/signup/page.tsx` (multi-step)
- Forgot Password: `/app/(auth)/forgot-password/page.tsx`
- Email Verification: `/app/(auth)/verify-email/page.tsx`
- OAuth Callback: `/app/auth/callback/route.ts`

**Server Actions:**
- `signInWithEmail()` - Email/password login
- `signUpWithEmail()` - Email/password signup
- `signInWithGoogle()` - Google OAuth
- `signOut()` - Logout
- `resetPassword()` - Password reset

**Database Triggers:**
- `handle_new_user()` - Auto-creates `profiles` and `players` records on signup
- Assigns default "player" role via `user_roles` table

**Mobile Mapping:**
```
/app/(auth)/login → /mobile/app/(auth)/login.tsx ✅ (exists, needs enhancement)
/app/(auth)/signup → /mobile/app/(auth)/signup.tsx ✅ (exists, needs enhancement)
/app/(auth)/forgot-password → /mobile/app/(auth)/forgot-password.tsx ✅ (exists, needs enhancement)
```

### 1.2 Profile Setup Flow

**Web Implementation:**
- Setup Profile: `/app/(main)/setup-profile/page.tsx`
- Profile View: `/app/(main)/profile/page.tsx`
- Profile Edit: `/app/(main)/profile/edit/page.tsx`

**Server Actions:**
- `updateProfile()` - Update user profile
- `uploadAvatar()` - Upload avatar to Supabase Storage
- `updatePlayerProfile()` - Update player-specific data (skill level, play style)

**Database Tables:**
- `profiles` - User profile data (name, phone, avatar_url, profile_completed)
- `players` - Player-specific data (birth_date, gender, skill_level, play_style, rating)

**Mobile Screens:**
```
New: /mobile/app/(main)/setup-profile.tsx (onboarding wizard)
New: /mobile/app/(main)/profile/edit.tsx (profile editing)
Enhance: /mobile/app/(tabs)/profile.tsx (profile view)
```

### 1.3 Court Discovery Flow

**Web Implementation:**
- Court List: `/app/(main)/courts/page.tsx`
- Court Map: `/app/(main)/courts/map/page.tsx`
- Court Detail: `/app/(main)/courts/[id]/page.tsx`

**API Endpoints:**
- `getVenues()` - Fetch all venues with courts
- `nearby_venues(lat, lng, radius_km, limit)` - PostGIS RPC function
- `getVenueById(id)` - Fetch single venue with courts
- `searchVenues(query)` - Full-text search

**Components:**
- `VenueMap` (Leaflet) - Map with custom markers
- `CourtCard` - Court list item
- `FilterSidebar` - Price, amenities, type filters
- `ImageGallery` - Swipeable image carousel

**Mobile Screens:**
```
/mobile/app/(tabs)/index.tsx (court list - already exists, needs real data)
/mobile/app/(tabs)/map.tsx (map view - exists, needs react-native-maps)
New: /mobile/app/courts/[id]/index.tsx (court detail)
```

### 1.4 Booking Flow

**Web Implementation:**
- Booking Page: `/app/(main)/courts/[id]/book/page.tsx`
- Checkout: `/app/(main)/checkout/page.tsx`
- Success: `/app/(main)/checkout/success/page.tsx`
- Failed: `/app/(main)/checkout/failed/page.tsx`

**Server Actions:**
- `createReservation()` - Create reservation (status: pending)
- `createPaymentSource()` - GCash/Maya source creation (PayMongo)
- `createPayment()` - Payment intent creation
- `cancelReservation()` - Cancel booking

**Components:**
- `BookingForm` - Date/time selection, notes
- `TimeSlotGrid` - Available time slots
- `PaymentProcessing` - Payment method selection

**Database Protection:**
- Exclusion constraint `no_overlapping_reservations` (migration 004)
- Payment expiration function `expire_old_payments()` (15-minute timeout)

**Mobile Screens:**
```
New: /mobile/app/courts/[id]/book.tsx (booking form)
New: /mobile/app/checkout/[reservationId].tsx (payment)
New: /mobile/app/checkout/success.tsx
New: /mobile/app/checkout/failed.tsx
```

### 1.5 Queue Participation Flow

**Web Implementation:**
- Queue Discovery: `/app/(main)/queue/page.tsx`
- Queue Detail: `/app/(main)/queue/[courtId]/page.tsx`

**Server Actions:**
- `getNearbyQueues(lat, lng)` - Fetch active queues
- `getQueueDetails(id)` - Fetch queue session data
- `joinQueue(sessionId)` - Join queue
- `leaveQueue(sessionId)` - Leave queue (with payment enforcement)
- `calculateQueuePayment(sessionId)` - Calculate amount owed

**Real-time Subscriptions (Supabase):**
- `queue-{id}` - Queue participant updates (INSERT, UPDATE, DELETE)
- `my-queues` - User's queue participation
- `nearby-queues` - Active queues in radius

**Database Tables:**
- `queue_sessions` - Queue session data (format, cost, max_players, status)
- `queue_participants` - Player queue participation (position, games_played, amount_owed)
- `matches` - Match records (players, scores, winners)

**Mobile Screens:**
```
New: /mobile/app/queue/index.tsx (queue discovery)
New: /mobile/app/queue/[id]/index.tsx (queue detail)
```

### 1.6 Booking Management Flow

**Web Implementation:**
- My Bookings: `/app/(main)/bookings/page.tsx`
- Reservations: (integrated into bookings page)

**Server Actions:**
- `getMyReservations()` - Fetch user's reservations
- `cancelReservation(id)` - Cancel booking
- `getReservationDetails(id)` - Fetch single reservation

**Mobile Screens:**
```
New: /mobile/app/bookings/index.tsx (booking history)
```

### 1.7 Match History Flow

**Web Implementation:**
- Matches: `/app/(main)/matches/page.tsx` (partial)

**Server Actions:**
- `getMyMatches()` - Fetch player's match history

**Mobile Screens:**
```
New: /mobile/app/matches/index.tsx (match history)
```

---

## 2. API Endpoint Inventory

### 2.1 Authentication APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `signInWithEmail(email, password)` | Server Action | `{email: string, password: string}` | `{user, session}` |
| `signUpWithEmail(email, password, metadata)` | Server Action | `{email, password, firstName, lastName, phone}` | `{user, session}` |
| `signInWithGoogle()` | Server Action | None | Redirect to OAuth |
| `signOut()` | Server Action | None | `void` |
| `resetPassword(email)` | Server Action | `{email: string}` | `void` |

### 2.2 Profile APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `getProfile(userId)` | Supabase Query | `{userId: UUID}` | `Profile` |
| `updateProfile(data)` | Server Action | `UpdateProfileSchema` | `Profile` |
| `updatePlayerProfile(data)` | Server Action | `UpdatePlayerSchema` | `Player` |
| `uploadAvatar(file)` | Server Action | `File` | `{url: string}` |

### 2.3 Court Discovery APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `getVenues()` | Supabase Query | `{filters?}` | `Venue[]` |
| `nearby_venues(lat, lng, radius, limit)` | RPC Function | `{lat, lng, radius_km, limit}` | `VenueWithDistance[]` |
| `getVenueById(id)` | Supabase Query | `{id: UUID}` | `Venue` |
| `searchVenues(query)` | Supabase Query | `{query: string}` | `Venue[]` |
| `getCourts(venueId)` | Supabase Query | `{venueId: UUID}` | `Court[]` |

### 2.4 Booking APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `createReservation(data)` | Server Action | `CreateReservationSchema` | `Reservation` |
| `getMyReservations()` | Supabase Query | None | `Reservation[]` |
| `getReservationDetails(id)` | Supabase Query | `{id: UUID}` | `Reservation` |
| `cancelReservation(id)` | Server Action | `{id: UUID}` | `void` |
| `checkAvailability(courtId, date, timeSlot)` | Supabase Query | `{courtId, date, timeSlot}` | `boolean` |

### 2.5 Payment APIs (PayMongo)

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `createPaymentSource(method, amount, description)` | Server Action | `{method, amount, description}` | `Source` |
| `createPayment(sourceId, amount, description)` | Server Action | `{sourceId, amount, description}` | `Payment` |
| `handlePaymentWebhook(event)` | Webhook | `PayMongoEvent` | `void` |

### 2.6 Queue APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `getNearbyQueues(lat, lng)` | Server Action | `{lat, lng}` | `QueueSession[]` |
| `getQueueDetails(id)` | Server Action | `{id: UUID}` | `QueueSession` |
| `joinQueue(sessionId)` | Server Action | `{sessionId: UUID}` | `QueueParticipant` |
| `leaveQueue(sessionId)` | Server Action | `{sessionId: UUID}` | `void` |
| `calculateQueuePayment(sessionId)` | Server Action | `{sessionId: UUID}` | `{amount: number}` |
| `initiateQueuePayment(sessionId)` | Server Action | `{sessionId: UUID}` | `PaymentSource` |

### 2.7 Match History APIs

| Endpoint | Type | Request Schema | Response Schema |
|----------|------|----------------|-----------------|
| `getMyMatches()` | Supabase Query | None | `Match[]` |
| `getMatchDetails(id)` | Supabase Query | `{id: UUID}` | `Match` |

---

## 3. Real-time Subscription Requirements

### 3.1 Queue Subscriptions (Supabase Realtime)

**Channel 1: `queue-{sessionId}`**
- **Purpose:** Real-time updates for specific queue session
- **Events:**
  - `INSERT` on `queue_participants` - New player joined
  - `UPDATE` on `queue_participants` - Position change, payment status
  - `DELETE` on `queue_participants` - Player left
  - `UPDATE` on `queue_sessions` - Session status change (paused, closed)
- **Payload:** Full participant or session record

**Channel 2: `my-queues`**
- **Purpose:** Track user's queue participation across all queues
- **Events:**
  - `INSERT` on `queue_participants` WHERE `user_id = auth.uid()`
  - `UPDATE` on `queue_participants` WHERE `user_id = auth.uid()`
  - `DELETE` on `queue_participants` WHERE `user_id = auth.uid()`
- **Payload:** Participant record

**Channel 3: `nearby-queues`**
- **Purpose:** Discover new queues in user's area
- **Events:**
  - `INSERT` on `queue_sessions` - New queue created
  - `UPDATE` on `queue_sessions` - Status change
- **Payload:** Session record

### 3.2 Implementation Pattern (Mobile)

```typescript
// Mobile: /src/hooks/useQueue.ts
const subscribeToQueue = (sessionId: string) => {
  const channel = supabase
    .channel(`queue-${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'queue_participants',
      filter: `session_id=eq.${sessionId}`
    }, (payload) => {
      // Update local state
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'queue_sessions',
      filter: `id=eq.${sessionId}`
    }, (payload) => {
      // Update session state
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
```

---

## 4. State Management Architecture

### 4.1 Zustand Stores (Mobile)

**Auth Store** (`/mobile/src/store/auth-store.ts`)
- Already exists, needs enhancement
- State: `user`, `session`, `profile`, `player`
- Actions: `setUser`, `setSession`, `clearAuth`, `updateProfile`

**Location Store** (New: `/mobile/src/store/location-store.ts`)
- State: `currentLocation`, `permissionStatus`, `nearbyVenues`
- Actions: `setLocation`, `requestPermission`, `updateNearbyVenues`

**Queue Store** (New: `/mobile/src/store/queue-store.ts`)
- State: `activeQueues`, `myQueues`, `currentQueue`
- Actions: `setActiveQueues`, `joinQueue`, `leaveQueue`, `updateQueueStatus`

**Booking Store** (New: `/mobile/src/store/booking-store.ts`)
- State: `myReservations`, `pendingReservation`, `checkoutData`
- Actions: `setReservations`, `addReservation`, `cancelReservation`

### 4.2 Data Persistence (Zustand Persist)

**Persist to AsyncStorage:**
- Auth tokens (session, refresh_token)
- User profile (for offline access)
- Recent search locations
- Cached venue data (with timestamps for stale-while-revalidate)

---

## 5. Form Validation Requirements

### 5.1 Shared Zod Schemas (from `/shared/src/validations/`)

**Auth Schemas:**
- `signupSchema` - Email, password, name, phone validation
- `loginSchema` - Email, password validation
- `forgotPasswordSchema` - Email validation

**Profile Schemas:**
- `updateProfileSchema` - Name, phone, avatar_url validation
- `updatePlayerSchema` - Skill level (1-10), play style, birth date, gender

**Booking Schemas:**
- `createReservationSchema` - Court ID, date, start_time, end_time, notes
- `timeSlotSchema` - Start/end time validation (30-minute increments)

**Queue Schemas:**
- `joinQueueSchema` - Session ID validation
- `leaveQueueSchema` - Session ID, payment validation

### 5.2 React Hook Form Integration (Mobile)

**Example: Signup Form**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema } from '@rallio/shared/validations'

const SignupScreen = () => {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: ''
    }
  })

  const onSubmit = async (data) => {
    // Call signUpWithEmail server action
  }

  return (
    <Controller
      control={control}
      name="email"
      render={({ field }) => (
        <TextInput
          {...field}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      )}
    />
  )
}
```

---

## 6. Third-Party Integration Details

### 6.1 Supabase Client (Mobile)

**Configuration:**
- Already configured: `/mobile/src/services/supabase.ts`
- Uses AsyncStorage for session persistence
- Auto-refresh enabled

**Usage:**
- Direct Supabase client calls (no TanStack Query)
- Server actions from web can be called via REST API (if needed)
- Realtime subscriptions for queues

### 6.2 PayMongo Integration

**Server-Side Only:**
- Payment creation handled by web server actions
- Mobile displays checkout URL or QR code
- Mobile polls payment status or uses webhooks

**Mobile Flow:**
1. Create reservation → Server action
2. Create payment source (GCash/Maya) → Server action
3. Display `checkout_url` in WebView or QR code
4. Poll payment status → Server action
5. Navigate to success/failure screen

**Alternative (Recommended):**
- Use PayMongo SDK directly in mobile app
- Handle payment flow natively with better UX

### 6.3 Maps Integration

**react-native-maps:**
- Display venues as markers
- Custom marker component with pricing badge
- Cluster markers for nearby venues
- User location marker

**expo-location:**
- Request foreground location permission
- Get current location for "Near You" feature
- Watch position for real-time updates (optional)

**Implementation:**
```typescript
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'

const VenueMapScreen = () => {
  const [location, setLocation] = useState(null)
  const [venues, setVenues] = useState([])

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      let location = await Location.getCurrentPositionAsync({})
      setLocation(location)

      // Fetch nearby venues using PostGIS
      const { data } = await supabase.rpc('nearby_venues', {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        radius_km: 10,
        limit: 50
      })
      setVenues(data)
    })()
  }, [])

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: location?.coords.latitude || 6.9214,
        longitude: location?.coords.longitude || 122.0790,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1
      }}
    >
      {venues.map(venue => (
        <Marker
          key={venue.id}
          coordinate={{
            latitude: venue.latitude,
            longitude: venue.longitude
          }}
          title={venue.name}
          description={`₱${venue.min_price}/hr`}
        />
      ))}
    </MapView>
  )
}
```

### 6.4 Notifications (Future Phase)

**expo-notifications:**
- Push notification token registration
- Handle notification permissions
- Listen for foreground/background notifications
- Deep linking to screens

**Server-Side:**
- Supabase Edge Functions to send push notifications
- Triggers: Booking confirmed, queue position updated, payment received

---

## 7. Mobile-Specific Considerations

### 7.1 Offline Support

**Critical Data to Cache:**
- Auth session (already handled by Supabase)
- User profile and player data
- Recent court searches (last 10)
- Cached venue data (with 1-hour stale timeout)

**Offline-First Features:**
- View cached court list
- View booking history (read-only)
- Profile view (read-only)

**Requires Network:**
- Court booking (real-time availability check)
- Queue participation (real-time updates)
- Payment processing

### 7.2 Push Notifications

**Use Cases:**
- Booking confirmed
- Payment received
- Queue position updated (1-2 spots away)
- Match assigned in queue
- Booking reminder (24 hours before)

**Implementation:**
- Register push token on app launch
- Store token in `profiles` table (`push_token` field)
- Send via Supabase Edge Function + FCM

### 7.3 Location Services

**Permissions:**
- Foreground location (for "Near You" feature)
- Background location (optional, for queue proximity alerts)

**Privacy:**
- Only request when needed
- Explain permission purpose clearly
- Allow manual location input as fallback

### 7.4 Performance Optimizations

**List Rendering:**
- Use `FlatList` for court list (lazy rendering)
- Use `SectionList` for grouped data (match history by date)
- Optimize with `getItemLayout` for fixed heights

**Image Loading:**
- Use `<Image>` with progressive loading
- Cache images with `expo-image` (optional)
- Thumbnail → Full resolution pattern

**API Calls:**
- Debounce search inputs (500ms)
- Throttle location updates (5 seconds)
- Cancel stale requests (AbortController)

**State Updates:**
- Use Zustand selectors to prevent unnecessary re-renders
- Memoize expensive calculations
- Use `React.memo` for pure components

### 7.5 Native Interactions

**Gestures:**
- Pull-to-refresh on list screens
- Swipe-to-delete on booking items (not implemented in web)
- Long-press for contextual menus

**Pickers:**
- Native date picker for booking dates
- Native time picker for time slots
- Native select for dropdowns

**Haptics:**
- Light feedback on button press
- Success feedback on booking confirmation
- Error feedback on payment failure

### 7.6 Deep Linking

**URL Scheme:** `rallio://`

**Routes:**
- `rallio://courts/{id}` → Court detail screen
- `rallio://queue/{id}` → Queue detail screen
- `rallio://bookings/{id}` → Booking detail
- `rallio://checkout/{reservationId}` → Payment screen

**Implementation (Expo Router):**
```typescript
// app.json
{
  "expo": {
    "scheme": "rallio",
    "ios": {
      "bundleIdentifier": "com.rallio.app"
    },
    "android": {
      "package": "com.rallio.app"
    }
  }
}
```

---

## 8. Design System (Dark Mode + Green Accents)

### 8.1 Color Palette

```typescript
// /mobile/src/theme/colors.ts
export const colors = {
  // Backgrounds
  background: {
    primary: '#0A1F1C',      // Very dark teal
    secondary: '#0D2926',    // Dark teal
    tertiary: '#15423D',     // Medium dark teal
    card: '#1A3935',         // Card background
  },

  // Text
  text: {
    primary: '#FFFFFF',      // White
    secondary: '#94A3B8',    // Light gray
    tertiary: '#64748B',     // Medium gray
    disabled: '#475569',     // Dark gray
  },

  // Green Accents (Primary Actions)
  primary: {
    main: '#10B981',         // Emerald green
    light: '#34D399',        // Light green
    dark: '#059669',         // Dark green
    contrast: '#FFFFFF',     // White text on green
  },

  // Secondary (Teal Accents)
  secondary: {
    main: '#14B8A6',         // Teal
    light: '#2DD4BF',        // Light teal
    dark: '#0F766E',         // Dark teal
  },

  // Status Colors
  success: '#10B981',        // Green
  error: '#EF4444',          // Red
  warning: '#F59E0B',        // Amber
  info: '#3B82F6',           // Blue

  // Borders
  border: {
    light: '#1E4D48',        // Light border
    main: '#2A5C56',         // Main border
    dark: '#15423D',         // Dark border
  },
}
```

### 8.2 Typography

```typescript
// /mobile/src/theme/typography.ts
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: colors.text.primary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: colors.text.primary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    color: colors.text.primary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.text.tertiary,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: colors.primary.contrast,
  },
}
```

### 8.3 Spacing Scale

```typescript
// /mobile/src/theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}
```

### 8.4 Component Styles

**Button (Green Primary)**
```typescript
const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.button,
    color: colors.primary.contrast,
  },
})
```

**Card (Dark Background)**
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.main,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4, // Android
  },
})
```

---

## 9. Screen-by-Screen Conversion Plan

### Priority 1: Authentication (Enhance Existing)
1. **Login Screen** - `/mobile/app/(auth)/login.tsx`
   - Dark background with green accent button
   - Email/password form with validation
   - Google OAuth button
   - "Forgot Password" link

2. **Signup Screen** - `/mobile/app/(auth)/signup.tsx`
   - Multi-step wizard with progress indicator
   - Step 1: Email, password
   - Step 2: Name, phone
   - Green checkmarks for completed steps

3. **Forgot Password** - `/mobile/app/(auth)/forgot-password.tsx`
   - Simple form with email input
   - Green submit button

### Priority 2: Core Features (New Screens)
4. **Home Screen** - `/mobile/app/(tabs)/index.tsx`
   - Quick actions (Book, Join Queue)
   - "Near You" section with geolocation
   - "Suggested Courts" section
   - "Active Queues Nearby" section

5. **Court List** - `/mobile/app/courts/index.tsx`
   - Court cards with images, pricing, distance
   - Filter button (opens modal)
   - Search bar
   - Pull-to-refresh

6. **Map View** - `/mobile/app/(tabs)/map.tsx`
   - react-native-maps with custom markers
   - Cluster markers
   - Bottom sheet for court details
   - Map/List toggle

7. **Court Detail** - `/mobile/app/courts/[id]/index.tsx`
   - Image carousel (swipeable)
   - Venue info, rating, distance
   - Amenities chips (green outlines)
   - Reviews section
   - "Book Now" green button

8. **Booking Flow** - `/mobile/app/courts/[id]/book.tsx`
   - Calendar date picker (dark theme, green selection)
   - Time slot grid
   - Court selection
   - Booking notes
   - "Proceed to Payment" button

9. **Checkout** - `/mobile/app/checkout/[reservationId].tsx`
   - Booking summary
   - Payment method (GCash, Maya)
   - QR code display
   - "Pay Now" button

10. **Success/Failure** - `/mobile/app/checkout/{success|failed}.tsx`
    - Success: Green checkmark, booking details
    - Failure: Red error icon, retry button

### Priority 3: Queue & History
11. **Queue List** - `/mobile/app/queue/index.tsx`
    - Active queues nearby
    - Queue cards with format, players, cost
    - "Join Queue" buttons

12. **Queue Detail** - `/mobile/app/queue/[id]/index.tsx`
    - Current position (live badge)
    - Players list
    - Games played counter
    - Amount owed
    - "Leave Queue" button

13. **Bookings** - `/mobile/app/bookings/index.tsx`
    - Booking list with filters
    - Upcoming vs Past tabs
    - Swipe-to-cancel

14. **Match History** - `/mobile/app/matches/index.tsx`
    - Match cards with win/loss badges
    - Date, venue, opponents, score
    - Stats dashboard (win rate, total games, ELO)

### Priority 4: Profile & Settings
15. **Profile View** - `/mobile/app/(tabs)/profile.tsx`
    - Avatar, name, rating
    - Stats (games, wins, ELO)
    - Play styles
    - Edit button

16. **Profile Edit** - `/mobile/app/profile/edit.tsx`
    - Avatar upload (camera/gallery)
    - Name, phone, birth date
    - Skill level slider
    - Play style selection
    - "Save" green button

17. **Setup Profile** - `/mobile/app/setup-profile.tsx`
    - Onboarding wizard
    - Step-by-step profile completion
    - Skip option

---

## 10. Implementation Checklist

### Phase 1: Theme & Base Components ✅ (Week 1)
- [ ] Create color palette (`/mobile/src/theme/colors.ts`)
- [ ] Create typography system (`/mobile/src/theme/typography.ts`)
- [ ] Create spacing scale (`/mobile/src/theme/spacing.ts`)
- [ ] Build base Button component (green primary)
- [ ] Build base Card component (dark background)
- [ ] Build base Input component (dark theme)
- [ ] Build base Modal component
- [ ] Build ErrorBoundary component

### Phase 2: Authentication Enhancement ✅ (Week 1)
- [ ] Enhance login screen (dark theme, green button)
- [ ] Enhance signup screen (multi-step wizard)
- [ ] Enhance forgot password screen
- [ ] Test auth flow (email, Google OAuth)
- [ ] Implement profile setup wizard

### Phase 3: Court Discovery ✅ (Week 2)
- [ ] Build court list screen (FlatList, filters)
- [ ] Integrate nearby_venues RPC function
- [ ] Build court card component
- [ ] Add search and filter modal
- [ ] Build court detail screen
- [ ] Add image carousel
- [ ] Implement map view with react-native-maps
- [ ] Add custom markers with clustering

### Phase 4: Booking Flow ✅ (Week 3)
- [ ] Build booking screen (calendar, time slots)
- [ ] Integrate createReservation server action
- [ ] Build checkout screen (payment methods)
- [ ] Integrate PayMongo (checkout URL display)
- [ ] Build success/failure screens
- [ ] Add booking history screen
- [ ] Implement cancel booking functionality

### Phase 5: Queue Features ✅ (Week 4)
- [ ] Build queue discovery screen
- [ ] Build queue detail screen
- [ ] Implement real-time subscriptions (Supabase)
- [ ] Add join/leave queue functionality
- [ ] Build payment enforcement logic
- [ ] Add queue position tracking

### Phase 6: Profile & History ✅ (Week 5)
- [ ] Build profile view screen
- [ ] Build profile edit screen
- [ ] Add avatar upload (camera/gallery)
- [ ] Build match history screen
- [ ] Add stats dashboard
- [ ] Implement win/loss badges

### Phase 7: Polish & Testing ✅ (Week 6)
- [ ] Add pull-to-refresh on all lists
- [ ] Implement loading states
- [ ] Add error handling
- [ ] Implement empty states
- [ ] Test on iOS and Android
- [ ] Fix any bugs
- [ ] Performance optimization

---

## 11. Dependencies to Install

```bash
# Maps
npm install react-native-maps --workspace=mobile

# Date/Time Pickers
npm install @react-native-community/datetimepicker --workspace=mobile

# Calendar
npm install react-native-calendars --workspace=mobile

# Image Picker
npx expo install expo-image-picker --workspace=mobile

# Camera
npx expo install expo-camera --workspace=mobile

# Haptics
npx expo install expo-haptics --workspace=mobile

# WebView (for PayMongo checkout)
npx expo install react-native-webview --workspace=mobile

# Bottom Sheet (optional, for better UX)
npm install @gorhom/bottom-sheet --workspace=mobile

# Form Handling (already installed)
# react-hook-form + @hookform/resolvers

# Date Utilities (use shared package)
# date-fns (already in shared)
```

---

## 12. Known Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| PayMongo SDK mobile support | High | Use WebView for checkout URL (fallback) |
| Real-time subscription battery drain | Medium | Implement smart reconnection, cleanup on unmount |
| Map clustering performance | Medium | Use library optimizations, limit markers to 100 |
| Offline booking creation | High | Show clear "Network required" message |
| iOS/Android design inconsistencies | Low | Use Platform-specific components where needed |
| Push notification setup complexity | Medium | Phase 2 feature, not MVP blocker |

---

## 13. Success Criteria

### Functional Parity
- ✅ All Player role features from web implemented
- ✅ Same business logic (shared validations, utilities)
- ✅ Same API calls (Supabase queries, server actions)
- ✅ Same payment flow (PayMongo GCash/Maya)
- ✅ Real-time queue updates working

### Design Quality
- ✅ Consistent dark mode theme throughout
- ✅ Green accents on all CTAs and active states
- ✅ Modern, clean UI matching reference style
- ✅ Smooth animations and transitions
- ✅ Professional typography and spacing

### Performance
- ✅ App launch time < 2 seconds
- ✅ List scrolling at 60fps
- ✅ Image loading with progressive enhancement
- ✅ No memory leaks (proper cleanup)
- ✅ Offline mode for critical features

### Code Quality
- ✅ Zero TypeScript errors
- ✅ Full type coverage
- ✅ Proper error handling
- ✅ Loading states on all async operations
- ✅ Empty states on all lists
- ✅ Consistent code style

---

## 14. Next Steps (After Approval)

1. **Set up theme system** (colors, typography, spacing)
2. **Build base UI components** (Button, Card, Input)
3. **Enhance authentication screens** (dark theme + green)
4. **Implement court discovery** (list + map)
5. **Build booking flow** (calendar + payment)
6. **Add queue features** (join, track, leave)
7. **Build profile management** (view, edit, setup)
8. **Polish and test** (iOS + Android)

---

## 15. Timeline Estimate

- **Week 1:** Theme setup, base components, auth enhancement
- **Week 2:** Court discovery (list, map, detail)
- **Week 3:** Booking flow (calendar, payment, confirmation)
- **Week 4:** Queue features (discovery, join, real-time)
- **Week 5:** Profile management, match history
- **Week 6:** Polish, testing, bug fixes

**Total:** 6 weeks for full Player role mobile app

---

**END OF MOBILE CONVERSION SYSTEM ANALYSIS**
