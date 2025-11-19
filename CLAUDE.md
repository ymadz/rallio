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
- **Web**: Next.js 16, TypeScript 5, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod, Mapbox GL
- **Mobile**: React Native 0.81, Expo 54, Expo Router, react-native-maps, expo-location, expo-notifications, Zustand
- **Backend**: Supabase Auth (JWT), PostgreSQL with PostGIS extensions, Supabase Edge Functions
- **Payments**: PayMongo integration (GCash, Maya, QR codes)
- **Shared**: Types, Zod validations, utility functions (date-fns)

### Database
- 27-table PostgreSQL schema in `backend/supabase/migrations/001_initial_schema.sql`
- Uses UUID primary keys, geospatial indexing (PostGIS), JSONB metadata columns
- Core entities: users, roles, players, venues, courts, reservations, queue sessions, payments, ratings

### Key Integrations
- **Supabase**: Auth, database, edge functions, real-time subscriptions
- **Mapbox**: Court discovery and location-based search
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
- TanStack Query for server state (web)

### Styling
- Web: Tailwind CSS 4 with CSS variables for theming
- Mobile: React Native StyleSheet with shared color constants

### Database Conventions
- `created_at`, `updated_at` audit columns on all tables
- `is_active` boolean for soft deletes
- `metadata` JSONB for flexible extensibility
- UUID primary keys with `gen_random_uuid()`

## Project Structure

### Shared (`/shared/src`)
- `types/index.ts` - All shared TypeScript types (User, Court, Venue, Reservation, etc.)
- `validations/index.ts` - Zod schemas for auth, profiles, courts, reservations, queues, ratings
- `utils/index.ts` - Utility functions (date formatting, currency, distance calculations, ELO)

### Web (`/web/src`)
- `app/` - Next.js App Router pages
- `components/ui/` - Base UI components (shadcn/ui pattern)
- `lib/supabase/` - Supabase client (browser, server, middleware)
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
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=
PAYMONGO_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Mobile (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_TOKEN=
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
