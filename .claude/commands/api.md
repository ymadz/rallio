# API Generator

Generate Supabase API functions for the Rallio application.

## Context
- API functions go in `web/src/lib/api/`
- Use the Supabase client from `@/lib/supabase/server` or `@/lib/supabase/client`
- Types come from `@rallio/shared` or `web/src/types/`
- Follow consistent error handling patterns

## Instructions

Based on the user's request, generate:

1. **API function file**:
   - TypeScript types for parameters and return values
   - Proper error handling
   - Server-side functions use `createClient` from server
   - Client-side functions use `createClient` from client

2. **Server Actions** (for form submissions):
   - Use "use server" directive
   - Validate input with Zod
   - Return typed responses

## Patterns to Follow

### Query Function (Server Component)
```tsx
import { createClient } from '@/lib/supabase/server'

export async function getCourts(filters?: {
  venueId?: string
  type?: 'indoor' | 'outdoor'
  isActive?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('courts')
    .select(`
      *,
      venue:venues(id, name, address),
      amenities:court_amenities(amenity:amenities(*))
    `)

  if (filters?.venueId) {
    query = query.eq('venue_id', filters.venueId)
  }

  if (filters?.type) {
    query = query.eq('court_type', filters.type)
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch courts: ${error.message}`)
  }

  return data
}
```

### Mutation Function (Server Action)
```tsx
"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createReservationSchema = z.object({
  courtId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
})

export async function createReservation(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

  // Parse and validate input
  const rawData = {
    courtId: formData.get('courtId'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    notes: formData.get('notes'),
  }

  const parsed = createReservationSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: 'Invalid input', details: parsed.error.flatten() }
  }

  // Insert reservation
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      court_id: parsed.data.courtId,
      player_id: user.id,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      notes: parsed.data.notes,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { error: `Failed to create reservation: ${error.message}` }
  }

  revalidatePath('/reservations')
  return { data }
}
```

### Client-Side Query (with React Query)
```tsx
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export function useCourts(venueId?: string) {
  return useQuery({
    queryKey: ['courts', venueId],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('courts')
        .select('*')

      if (venueId) {
        query = query.eq('venue_id', venueId)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
  })
}
```

## Database Tables Reference
Main tables: users, players, venues, courts, reservations, queue_sessions, payments, ratings, court_ratings

## User Request
$ARGUMENTS

Generate the API function(s) based on this request. Include proper types, error handling, and place in the appropriate location.
