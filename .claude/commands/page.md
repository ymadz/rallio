# Page Generator

Generate a Next.js App Router page for the Rallio web application.

## Context
- This is for the `/web` workspace using Next.js 15+ App Router
- Pages go in `web/src/app/`
- Use Server Components by default, add "use client" only when needed
- Follow the existing patterns in the codebase

## Instructions

Based on the user's request, generate a complete Next.js page with:

1. **Page file** (`page.tsx`):
   - Proper TypeScript types
   - Metadata export for SEO
   - Data fetching using Supabase server client
   - Loading and error handling
   - Responsive Tailwind CSS styling

2. **Loading state** (`loading.tsx`):
   - Skeleton UI using the Spinner component
   - Match the page layout structure

3. **Error handling** (`error.tsx`):
   - Client component with error boundary
   - User-friendly error message
   - Retry functionality

## Patterns to Follow

### Server Component with Data Fetching
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Page Title | Rallio',
  description: 'Page description',
}

export default async function PageName() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('table_name')
    .select('*')

  if (error) throw error

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page content */}
    </div>
  )
}
```

### Client Component (when interactivity needed)
```tsx
"use client"

import { useState } from 'react'
// ... component code
```

## User Request
$ARGUMENTS

Generate the complete page structure based on this request. Include all necessary files (page.tsx, loading.tsx, error.tsx) and any supporting components needed.
