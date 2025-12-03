# Rallio - AI Coding Agent Instructions

Badminton Court Finder & Queue Management System for Zamboanga City, Philippines.

## Quick Context

**Read first:** `CLAUDE.md` (debugging patterns), `docs/tasks.md` (current progress)

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Supabase (PostgreSQL + Auth + RLS), PayMongo, Leaflet, Zustand

## Architecture

```
rallio/
├── shared/src/           # Types, Zod validations, utils (web + mobile)
│   ├── types/            # Shared TypeScript interfaces
│   └── validations/      # Zod schemas (auth, profile, reservations)
├── web/src/
│   ├── app/actions/      # 25 server action files by feature domain
│   ├── app/api/webhooks/ # PayMongo webhook handler
│   ├── lib/supabase/     # 4 client files (see below)
│   └── lib/paymongo/     # PayMongo client library
├── mobile/               # React Native + Expo 54 (in development)
└── backend/supabase/
    └── migrations/       # 001-031 SQL migrations (sequential)
```

**Path aliases:** `@/*` → `./src/*`, `@rallio/shared` → `../shared/src`

## Supabase Clients (Critical - 4 Files)

```typescript
// CLIENT COMPONENT - browser, no async
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// SERVER COMPONENT/ACTION - respects RLS, MUST await
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// ADMIN ONLY - bypasses RLS (webhooks, admin operations)
import { createServiceClient } from '@/lib/supabase/server'   // or
import { createServiceClient } from '@/lib/supabase/service'  // cached version
```

## Server Actions Pattern

All data mutations use server actions in `web/src/app/actions/`:

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateReservation(id: string, data: UpdateData) {
  const supabase = await createClient()
  const { error } = await supabase.from('reservations').update(data).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/reservations')  // ALWAYS invalidate
  return { success: true }
}
```

**Client-side:** `await action(); router.refresh()` for immediate UI update

## Leaflet Maps (No SSR)

```typescript
// Leaflet crashes on server - ALWAYS use dynamic import
const VenueMap = dynamic(() => import('@/components/map/venue-map'), {
  ssr: false,
  loading: () => <MapSkeleton />
})
```

## Geospatial Queries

```typescript
// Use PostGIS RPC - never calculate distance client-side
const { data } = await supabase.rpc('nearby_venues', {
  lat, lng, radius_km: 10, limit_count: 20
})
```

## PayMongo Integration

**Flow:** Create Source → User pays QR → Webhook receives event → Create Payment → Update reservation

```typescript
// CRITICAL: source.type is literal 'source', NOT 'gcash'/'paymaya'
source: { id: sourceId, type: 'source' }

// Webhook signature parsing (te= for test, li= for live)
const sig = parts.find(p => p.startsWith('te=') || p.startsWith('li='))
```

**Files:** `lib/paymongo/client.ts`, `app/api/webhooks/paymongo/route.ts`

## Database

**Auto profile creation:** `handle_new_user()` trigger creates `profiles` + `players` on auth signup. Never manually insert profiles.

**Migrations:** Always use Supabase CLI:
```bash
cd backend/supabase
supabase migration new feature_name
supabase db push --linked
```

## User Roles

Check roles: `user.roles?.some(r => r.role === 'court_admin')`

| Role | Access |
|------|--------|
| player | Book courts, join queues, rate venues |
| queue_master | Create/manage queue sessions (needs approval) |
| court_admin | Manage venues, courts, pricing, reservations |
| global_admin | Platform settings, moderation, analytics |

## Commands

```bash
npm run dev:web          # Web dev server (port 3000)
npm run build:web        # Production build
npm run typecheck        # TypeScript check all packages
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Map white screen | `dynamic(..., { ssr: false })` |
| Stale data | `revalidatePath()` + `router.refresh()` |
| Double booking `23P01` | Handle exclusion_violation error |
| Profile not found (OAuth) | Check `handle_new_user` trigger |

## Debugging

```typescript
console.log('🔍 [FunctionName] Input:', { id, status })
console.log('✅ [FunctionName] Success:', result)
console.log('❌ [FunctionName] Error:', error.message)
```

**Reference:** `CLAUDE.md` has detailed debugging methodology and PayMongo fix examples.
