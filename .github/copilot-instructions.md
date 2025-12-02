# Rallio - AI Coding Agent Instructions

Badminton Court Finder & Queue Management System for Zamboanga City, Philippines.

## Quick Context

**Read first:** `CLAUDE.md` (debugging), `docs/planning.md` (phases), `docs/tasks.md` (progress)

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Supabase (PostgreSQL + Auth), PayMongo, Leaflet, Zustand

## Architecture

```
rallio/
├── shared/src/           # Types, Zod validations, utils (used by web & mobile)
├── web/src/              # Next.js 16 web app (primary)
│   ├── app/actions/      # Server actions (24 files by feature)
│   ├── lib/supabase/     # THREE client types (see below)
│   └── lib/paymongo/     # PayMongo client library
├── mobile/               # React Native + Expo 54 (in development)
└── backend/supabase/     # Migrations (001-024), edge functions
```

**Path aliases:** `@/*` → `./src/*`, `@rallio/shared` → `../shared/src`

## Supabase Clients (Critical)

```typescript
// Client component - browser context
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server component/action - respects RLS, async required
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Admin operations ONLY - bypasses RLS (use sparingly)
import { createServiceClient } from '@/lib/supabase/server'
const supabase = createServiceClient()
```

## Key Patterns

### Server Actions + Cache
```typescript
'use server'
import { revalidatePath } from 'next/cache'

export async function updateData(data) {
  const supabase = await createClient()
  await supabase.from('table').update(data)
  revalidatePath('/path')  // Always invalidate cache
  return { success: true }
}
// Client-side: await action(); router.refresh()
```

### Leaflet Maps (No SSR)
```typescript
const VenueMap = dynamic(() => import('@/components/map/venue-map'), {
  ssr: false,  // Leaflet crashes on server
  loading: () => <LoadingSpinner />
})
```

### Geospatial Queries
```typescript
// Use PostGIS RPC - never calculate distance client-side
const { data } = await supabase.rpc('nearby_venues', {
  lat, lng, radius_km: 10, limit: 20
})
```

## PayMongo Integration

**Flow:** Source → User pays QR → Webhook → Payment → Update reservation

```typescript
// Source type is ALWAYS literal 'source', NOT payment method
source: { id: sourceId, type: 'source' }

// Webhook signature uses te=/li= fields (NOT s=)
const sig = parts.find(p => p.startsWith('te=') || p.startsWith('li='))
```

**Webhook:** `/web/src/app/api/webhooks/paymongo/route.ts`

## Database

**Profile auto-creation:** `handle_new_user()` trigger creates profiles + players on signup. Never manually insert after `signUp()`.

**Migrations:** Use CLI only, never SQL Editor:
```bash
cd backend/supabase
supabase migration new feature_name
supabase db push --linked
```

## User Roles

1. **Player** - Book courts, join queues, rate venues
2. **Queue Master** - Create/manage queue sessions (requires Court Admin approval)
3. **Court Admin** - Manage venue/courts, pricing, reservations
4. **Global Admin** - Platform management, moderation, analytics

Check: `user.roles?.some(r => r.role === 'court_admin')`

## Commands

```bash
npm run dev:web          # Web server (port 3000)
npm run build:web        # Production build
npm run typecheck        # TypeScript check all packages
cd backend/supabase && supabase migration list  # Check migrations
```

## Common Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Profile not found (OAuth) | Trigger failed | RLS policy allows self-insert |
| Map white screen | SSR render | `dynamic(..., { ssr: false })` |
| Stale data after update | Cache | `revalidatePath()` + `router.refresh()` |
| Double booking error | Race condition | Handle `23P01` exclusion_violation |

## Debugging

Use emoji markers for logs: `🚨` critical, `🔍` debug, `✅` success, `❌` error

```typescript
console.log('🔍 [FunctionName] Input:', { id, status })
```

---

**When in doubt:** Check `CLAUDE.md` for patterns, `docs/tasks.md` for progress, search codebase for similar implementations.
