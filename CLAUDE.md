# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules

**Before starting any coding task, ALWAYS check these documentation files first:**
1. `CLAUDE.md` - This file for project guidelines and patterns
2. `docs/planning.md` - Development phases and approach
3. `docs/tasks.md` - Current tasks and progress tracking
4. `docs/system-analysis/` - Feature specifications and database schema

This ensures you understand:
- What has already been completed
- What tasks are currently in progress
- The project's architecture and conventions
- Any specific implementation details or constraints

**After completing any task or answering a question:**
- Check `docs/tasks.md` for the current progress
- Suggest what to do next based on the task list
- Offer to continue with the next logical task or let the user choose

## Debugging Methodology

When encountering bugs or issues, follow this systematic approach:

### 1. Observe & Gather Evidence
- **Read terminal logs carefully** - Look for error messages, stack traces, and unexpected behavior
- **Check what's actually happening** vs what should happen
- **Identify patterns** - Is it failing consistently? At what point?
- **Collect examples** - Save error messages, request/response data, relevant logs

### 2. Add Comprehensive Logging
Before trying to fix anything, add detailed logging to understand the flow:
- **Log at every critical step** - function entry, before/after API calls, conditionals
- **Log both success and failure paths** - Don't just log errors
- **Include context** - Log relevant variables, IDs, statuses
- **Use visual markers** - Emojis (🚨, ✅, ❌, 🔍) make logs easier to scan
- **Show data structure** - Log object shapes, not just values

Example:
```typescript
console.log('🚨🚨🚨 [Function] Critical point reached!')
console.log('🔍 [Function] Input data:', { id, status, ...relevantFields })
console.log('✅ [Function] Success:', result)
console.log('❌ [Function] Error:', error.message, error.code)
```

### 3. Isolate the Problem
- **Narrow down the location** - Which file? Which function? Which line?
- **Test assumptions** - Is the data in the format you expect?
- **Check for null/undefined** - Are all required values present?
- **Verify external dependencies** - Are APIs returning what you expect?

### 4. Research & Understand
- **Read the API documentation** - What does the external service actually expect?
- **Check type definitions** - Does TypeScript reveal the expected shape?
- **Look for similar issues** - Has this been solved before in the codebase?
- **Test in isolation** - Can you reproduce with a minimal test case?

### 5. Fix with Precision
- **Make targeted changes** - Don't refactor while debugging
- **Fix one thing at a time** - Multiple changes make it hard to know what worked
- **Validate assumptions** - Add assertions or checks for edge cases
- **Keep logging in place** - It helps verify the fix works

### 6. Verify & Document
- **Test the fix thoroughly** - Does it work in all scenarios?
- **Check for side effects** - Did the fix break anything else?
- **Update documentation** - Add notes to prevent future confusion
- **Clean up debug logs** - Remove excessive logging but keep useful diagnostics

### Example: PayMongo Webhook Debugging Process

**Problem:** Payments completing but bookings disappearing

**Step 1 - Observe:**
```
Payment initiation: ✅ Working
Webhook received: ✅ Working
Webhook signature: ❌ Failing (401)
```

**Step 2 - Add Logging:**
```typescript
console.log('🔐 [verifyWebhookSignature] Signature header:', signature)
console.log('🔐 [verifyWebhookSignature] Parsed components:', { timestamp, sig })
```

**Step 3 - Isolate:**
Discovered signature header has `te=` and `li=` fields, not `s=`

**Step 4 - Research:**
Found PayMongo docs showing format is `t={timestamp},te={test_sig},li={live_sig}`

**Step 5 - Fix:**
Changed parsing from `p.startsWith('s=')` to handle `te=` and `li=`

**Step 6 - Verify:**
Tested payment flow, confirmed webhooks accepted with 200 status

### Key Principles

- **Logs are your best friend** - When in doubt, log more
- **Don't guess** - Verify your assumptions with actual data
- **Follow the data** - Trace the flow from input to output
- **Read error messages carefully** - They often tell you exactly what's wrong
- **Test incrementally** - Verify each step works before moving to the next
- **Document as you go** - Future you (or others) will thank you

## Project Overview

Rallio is a Badminton Court Finder & Queue Management System for Zamboanga City, Philippines. It's a full-stack monorepo with web (Next.js), mobile (React Native/Expo), and backend (Supabase/PostgreSQL) applications.

**Key Files to Reference:**
- `docs/planning.md` - Development phases and approach
- `docs/tasks.md` - Current tasks and progress tracking

## Commands

### Root Level (Workspace)
```bash
npm install              # Install all workspace dependencies
npm run dev:web          # Start web development server
npm run dev:mobile       # Start mobile Expo server
npm run build:web        # Production build for web
npm run lint             # Lint entire project
npm run format           # Format code with Prettier
npm run typecheck        # TypeScript type checking
```

### Web Application (`/web`)
```bash
npm run dev --workspace=web      # Start development server (localhost:3000)
npm run build --workspace=web    # Production build
npm run lint --workspace=web     # Run ESLint
```

### Mobile Application (`/mobile`)
```bash
npm run start --workspace=mobile    # Start Expo dev server
npm run android --workspace=mobile  # Run on Android emulator
npm run ios --workspace=mobile      # Run on iOS simulator
```

## Architecture

### Monorepo Structure
```
rallio/
├── shared/          # Shared types, validations, utilities
├── web/             # Next.js 16 web application
├── mobile/          # React Native + Expo 54 mobile app
├── backend/         # Supabase migrations & edge functions
└── docs/            # Documentation, planning, tasks
```

### Tech Stack
- **Web**: Next.js 16.0.3, React 19.1, TypeScript 5, Tailwind CSS 4, Zustand, React Hook Form + Zod, Leaflet + React Leaflet
- **Mobile**: React Native 0.81.5, React 19.1, Expo 54, Expo Router, react-native-maps, expo-location, expo-notifications, Zustand
- **Backend**: Supabase Auth (JWT), PostgreSQL with PostGIS extensions, Supabase Edge Functions
- **Payments**: PayMongo integration (GCash, Maya, QR codes)
- **Shared**: Types, Zod validations, utility functions (date-fns)

**Note:** TanStack Query (React Query) is installed but not currently used. All data fetching is done through direct Supabase client calls.

### Database
- 27-table PostgreSQL schema in `backend/supabase/migrations/001_initial_schema_v2.sql`
- Uses UUID primary keys, geospatial indexing (PostGIS), JSONB metadata columns
- Core entities: users, roles, players, venues, courts, reservations, queue sessions, payments, ratings

### Key Integrations
- **Supabase**: Auth, database, edge functions, real-time subscriptions
- **Leaflet**: Interactive maps with OpenStreetMap tiles for court discovery and location-based search
- **PayMongo**: Payment processing with QR code generation (GCash, Maya)

## Code Patterns

### Imports & Path Aliases
- Web: `@/*` → `./src/*`, `@rallio/shared` → `../shared/src`
- Mobile: `@/*` → `./src/*`, `@rallio/shared` → `../shared/src`

### Form Handling
- React Hook Form + Zod validation with `@hookform/resolvers`
- Shared validations in `shared/src/validations/`

### State Management
- Zustand for client state (web & mobile)
- Supabase client for server state (web & mobile)

### Styling
- Web: Tailwind CSS 4 with CSS variables for theming
- Mobile: React Native StyleSheet with shared color constants

### Database Conventions
- `created_at`, `updated_at` audit columns on all tables
- `is_active` boolean for soft deletes
- `metadata` JSONB for flexible extensibility
- UUID primary keys with `gen_random_uuid()`

### Map Implementation (Leaflet)
- **SSR Constraint**: Leaflet doesn't support server-side rendering
  - Use `dynamic()` import with `ssr: false` for all map components
  - Example: `const VenueMap = dynamic(() => import('./venue-map'), { ssr: false })`
- **Error Handling**: Wrap map components in `ErrorBoundary` for crash protection
- **Custom Markers**: Use Leaflet `divIcon` for custom price markers and user location
- **Clustering**: Custom marker clustering implementation (not using react-leaflet-markercluster)
- **Tiles**: OpenStreetMap tiles (no API key required)

### Database Triggers & Patterns
- **Automatic Profile Creation**: `handle_new_user()` trigger runs on `auth.users` INSERT
  - Automatically creates `profiles` and `players`  records
  - Assigns default "player" role via `user_roles` table
  - **IMPORTANT**: Never manually insert profiles after signup - let the trigger handle it
- **Geospatial Queries**: Use `nearby_venues(lat, lng, radius_km, limit)` RPC function
  - Server-side PostGIS distance calculations
  - Returns venues sorted by proximity
  - More efficient than client-side distance calculations

### Profile Completion Flow
- Tracked via `profile_completed` boolean flag in `profiles` table
- Setup profile page at `/setup-profile` with skip option
- `ProfileCompletionBanner` component shows reminder on home page
- **Cache Management**: Always call `router.refresh()` after updating `profile_completed`
- Server actions with `revalidatePath()` ensure immediate UI updates

## Project Structure

### Shared (`/shared/src`)
- `types/index.ts` - All shared TypeScript types (User, Court, Venue, Reservation, etc.)
- `validations/index.ts` - Zod schemas for auth, profiles, courts, reservations, queues, ratings
- `utils/index.ts` - Utility functions (date formatting, currency, distance calculations, ELO)

### Web (`/web/src`)
- `app/` - Next.js App Router pages
  - `app/(main)/courts/` - Court listing and detail pages
  - `app/(main)/courts/[id]/book/` - Court booking page with time slot selection
  - `app/(main)/bookings/` - User booking history and management
  - `app/(main)/reservations/` - User reservations list
  - `app/(main)/checkout/` - Checkout page with payment options
  - `app/(main)/checkout/success/` - Payment success confirmation
  - `app/(main)/checkout/failed/` - Payment failure page
  - `app/actions/` - Server actions
    - `payments.ts` - Payment creation and processing actions
    - `reservations.ts` - Reservation management actions
    - `profile-actions.ts` - Profile update actions
  - `app/api/webhooks/paymongo/` - PayMongo webhook handler
- `components/ui/` - Base UI components (shadcn/ui pattern)
  - Includes: Button, Input, Card, Form, Alert, Calendar, Select, etc.
- `components/booking/` - Booking-specific components
  - `booking-form.tsx` - Main booking form with validation
  - `time-slot-grid.tsx` - Time slot selector with availability
- `components/checkout/` - Payment and checkout flow components
  - `payment-processing.tsx` - Payment method selection and processing
- `components/map/` - Map-related components (VenueMap, marker clustering)
- `components/venue/` - Venue display components (ImageGallery, etc.)
- `components/error-boundary.tsx` - Global error boundary for crash protection
- `lib/supabase/` - Supabase client (browser, server, middleware)
- `lib/paymongo/` - PayMongo client library
  - `client.ts` - Payment API functions (createSource, createPayment)
  - `types.ts` - TypeScript definitions for PayMongo API
  - `index.ts` - Public exports
- `lib/api/` - API client functions
  - `venues.ts` - Venue and court data fetching
  - `reservations.ts` - Reservation queries
- `lib/utils.ts` - cn() utility for class names
- `hooks/` - Custom React hooks
- `stores/` - Zustand stores
- `types/` - Web-specific types
- `constants/` - Configuration constants

### Mobile (`/mobile/src`)
- `services/` - API clients (Supabase)
- `hooks/` - Custom React Native hooks
- `store/` - Zustand stores
- `types/` - Mobile-specific types
- `constants/` - Configuration and colors
- `utils/` - Mobile helper functions

## Environment Variables

### Web (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** The project uses Leaflet with OpenStreetMap tiles (no API key required). Mapbox token is not needed for current implementation.

**Important:**
- `PAYMONGO_WEBHOOK_SECRET` is required in production for webhook signature verification
- In development, webhook verification is bypassed (warning logged)

### Mobile (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY=
```

## User Roles

The system has four user roles with different permissions:
1. **Player** - Find courts, join queues, make reservations, rate courts/players
2. **Queue Master** - Manage queue sessions, assign players to games, handle disputes
3. **Court Admin** - Manage venue/courts, handle reservations, set pricing
4. **Global Admin** - Platform-wide management, user management, analytics

## Key Documentation

- `docs/planning.md` - Development phases and approach
- `docs/tasks.md` - Current tasks and progress
- `docs/system-analysis/rallio-system-analysis.md` - Complete feature specifications
- `docs/system-analysis/rallio-database-schema.sql` - Full database schema
- `docs/system-analysis/prototype-analysis.md` - UI/UX gap analysis

## Common Issues & Solutions

### Map Components Showing White Screen
**Cause:** Leaflet doesn't support server-side rendering in Next.js
**Solution:** Use `dynamic()` import with `ssr: false`:
```typescript
const VenueMap = dynamic(() => import('@/components/map/venue-map'), { ssr: false })
```
Also wrap in `ErrorBoundary` component for better error handling.

### Profile Completion Banner Persisting
**Cause:** Next.js caching stale `profile_completed` data
**Solution:**
- Use server actions with `revalidatePath()` for profile updates
- Call `router.refresh()` after updating profile
- Set `dynamic = 'force-dynamic'` on pages that check profile completion

### Player Profile Not Initialized (Google OAuth)
**Cause:** Database trigger `handle_new_user()` didn't run for OAuth signup
**Solution:**
- Apply RLS INSERT policy: `CREATE POLICY "Users can insert own player profile" ON players FOR INSERT WITH CHECK (auth.uid() = user_id);`
- Server action will automatically create player record if missing

### Slow Venue Search Queries
**Cause:** Client-side distance calculations for all venues
**Solution:** Use the `nearby_venues(lat, lng, radius_km, limit)` PostGIS function for server-side distance sorting

### Duplicate Profile Insert Errors
**Cause:** Manually inserting profiles after `supabase.auth.signUp()`
**Solution:** Remove manual profile inserts - the `handle_new_user()` trigger handles this automatically

### Payment Expiration Not Automated
**Cause:** `expire_old_payments()` function exists but requires manual execution
**Solution:** Deploy as Supabase Edge Function or set up pg_cron scheduled job:
```sql
-- Using pg_cron (requires extension)
SELECT cron.schedule(
  'expire-old-payments',
  '*/5 * * * *', -- Every 5 minutes
  'SELECT expire_old_payments();'
);
```
Alternative: Create Edge Function that runs on a schedule or triggered by external cron service

### Split Payment Implementation Incomplete
**Cause:** Database schema ready but backend logic not fully implemented
**Solution:** Complete the following implementation steps:
1. Server action to create payment splits and send invitations
2. Participant payment tracking with deadline enforcement
3. Auto-cancellation when payment deadline expires
4. Email/SMS notifications to participants
5. Partial refund handling when group booking fails
**Current Status:** UI designed, database tables exist, backend logic pending

### Double Booking Despite Exclusion Constraint
**Cause:** Race condition between availability check and reservation insert
**Solution:** The exclusion constraint will catch it, but handle the error gracefully:
```typescript
try {
  await supabase.from('reservations').insert(reservation)
} catch (error) {
  if (error.code === '23P01') { // exclusion_violation
    throw new Error('Time slot no longer available')
  }
}
```

### Webhook Idempotency Issues
**Cause:** PayMongo may send duplicate webhook events
**Solution:** Already implemented in `/api/webhooks/paymongo/route.ts`:
- Check `payment.status === 'completed'` before processing
- Set `processing` flag in metadata during webhook handling
- Use 5-minute stale flag timeout for recovery

### PayMongo Webhook Signature Verification Failing (401 Unauthorized)
**Cause:** Incorrect parsing of webhook signature header
**Solution:** ✅ FIXED (2025-11-25)
- PayMongo signature header format uses `te=` (test) and `li=` (live) fields, not `s=`
- Correct parsing:
```typescript
const signatureHeader = request.headers.get('paymongo-signature')
const parts = signatureHeader.split(',')
const timestampPart = parts.find(p => p.startsWith('te=') || p.startsWith('li='))
const signaturePart = parts.find(p => p.startsWith('te=') || p.startsWith('li='))
const timestamp = timestampPart.split('=')[1]
const signature = signaturePart.split('=')[1]
```
- File: `/web/src/app/api/webhooks/paymongo/route.ts`

### PayMongo Payment Creation Error: "source.type passed gcash is invalid"
**Cause:** Incorrect `source.type` value in payment creation
**Solution:** ✅ FIXED (2025-11-25)
- `source.type` should always be the literal string `'source'`, NOT the payment method type
- Incorrect: `source.type = 'gcash'` or `source.type = 'paymaya'`
- Correct: `source.type = 'source'`
- The payment method is already encoded in the source ID
- Files fixed:
  - `/web/src/lib/paymongo/types.ts`
  - `/web/src/app/api/webhooks/paymongo/route.ts`
  - `/web/src/app/actions/payments.ts`

## Recent Database Migrations

Beyond the initial schema (`001_initial_schema_v2.sql`), the following migrations have been applied:

- **`002_add_players_insert_policy.sql`** - Adds RLS INSERT policy for players table (fixes Google OAuth signup issues)
- **`002_add_nearby_venues_function.sql`** - PostGIS function for efficient radius-based venue search
- **`003_fix_court_availabilities.sql`** - Adds computed `date` column for easier availability queries
- **`004_prevent_double_booking.sql`** ✅ APPLIED - Critical booking and payment fixes:
  - Exclusion constraint `no_overlapping_reservations` using btree_gist extension
  - Prevents overlapping reservations for same court (pending/confirmed status)
  - `expire_old_payments()` function - expires payments older than 15 minutes
  - Validation triggers for reservation overlap checking
  - Database views: `active_reservations`, `payment_summary`
  - Performance indexes for payment and reservation queries
- **`005_add_missing_rls_policies.sql`** ⚠️ CREATED BUT NOT APPLIED
  - Comprehensive RLS policies for reservations, payments, payment_splits
  - Role-based access control (player, court_admin, queue_master, global_admin)
  - **Action Required:** Apply this migration to enable security policies

## Development Status

### Phase 1: Foundation & Authentication ✅ 100% Complete
- Email/password and Google OAuth authentication
- Profile setup with skip option
- Database triggers for automatic profile/player creation
- RLS policies for secure data access
- Avatar upload to Supabase Storage
- Profile completion flow with banner reminder

### Phase 2: Court Discovery & Display ✅ 85% Complete
- ✅ Court listing page with filters (`/courts`)
- ✅ Map view with Leaflet integration (custom markers, clustering)
- ✅ Venue detail pages with image galleries (`/courts/[id]`)
- ✅ Geospatial search with PostGIS (`nearby_venues()` RPC function)
- ✅ Distance calculation and sorting
- ✅ Availability calendar (integrated into booking flow)
- ⚠️ Enhanced filtering pending (price range sliders, amenity checkboxes)
- ⚠️ Mobile implementation pending

### Phase 3: Reservations & Payments ✅ 85% Complete
**Completed:**
- ✅ Full booking flow (`/courts/[id]/book`)
  - Calendar date picker (shadcn/ui Calendar component)
  - Time slot grid with real-time availability
  - Booking notes and conflict detection
- ✅ PayMongo integration
  - Custom client library (`/lib/paymongo/`)
  - GCash and Maya payment sources
  - Checkout URL generation
  - ✅ **Fixed source.type to use literal 'source'** (prevents "invalid" errors)
- ✅ Payment webhook handler (`/api/webhooks/paymongo/route.ts`)
  - Handles `source.chargeable`, `payment.paid`, `payment.failed` events
  - ✅ **Fixed signature verification** (uses `te=` and `li=` fields correctly)
  - Idempotency handling for duplicate webhooks
  - ✅ **Webhooks now properly accept with 200 status**
  - ✅ **Payment flow fully functional** (pending → completed → confirmed)
- ✅ Booking management
  - My Bookings page (`/bookings`)
  - My Reservations page (`/reservations`)
  - Cancellation server action
  - ✅ **Bookings persist after successful payment**
- ✅ Database protection
  - Double booking prevention (exclusion constraint)
  - Payment expiration function (15-minute timeout)
  - Validation triggers and database views
- ✅ Success/failure pages (`/checkout/success`, `/checkout/failed`)
- ✅ Home page enhancements
  - "Queue" button linking to `/queue`
  - Real venue data for "Suggested Courts" section
  - Geolocation-based "Near You" section
  - "Active Queues Nearby" section

**In Progress / Pending:**
- ⚠️ Split payment backend logic (database ready, UI partial)
- ⚠️ Email notifications (booking confirmations, receipts)
- ⚠️ SMS notifications
- ⚠️ Payment expiration automation (requires Edge Function or cron job)
- ⚠️ QR code image generation (currently using PayMongo URLs)
- ⚠️ Cash payment handling
- ⚠️ Booking modification/rescheduling
- ⚠️ Refund flow for cancellations
- ⚠️ RLS policy application (migration 005 created but not applied)

### Next: Phase 4 - Queue Management
- Queue session creation and management
- Real-time queue updates with Supabase Realtime
- Skill-based team balancing
- Per-game payment splitting
- Before answering, modifying code, or creating files, you must ALWAYS read and follow these documents:
CLAUDE.md
docs/planning.md
docs/tasks.md
docs/system-analysis/ (all files)
Rules:
Never start coding without reviewing these files first.
Confirm which parts of the docs apply to the user’s request before generating code.
If the request conflicts with the docs, warn the user and ask how to proceed.
Always follow folder structure, tech stack, and conventions defined in the docs.
After completing a task, check docs/tasks.md and suggest the next task.
If the files cannot be found or haven't been loaded into the workspace, always ask the user to load or refresh the documentation first.
At the beginning of each task, briefly state which documentation files you used or checked.