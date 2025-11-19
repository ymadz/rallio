# 🌐 Rallio Web App

Next.js 16 web application for the Rallio platform - Badminton Court Finder & Queue Management System.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase project set up (see `/backend/README.md`)

### Installation

```bash
# From project root
cd web
npm install

# Or from root using workspace
npm install --workspace=web
```

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Add your Supabase credentials to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
web/
├── src/
│   ├── app/              # Next.js 16 App Router
│   │   ├── (auth)/       # Auth pages (login, signup, etc.)
│   │   ├── (main)/       # Main app pages (home, courts, profile)
│   │   ├── (dashboard)/  # Admin dashboard
│   │   ├── (onboarding)/ # User onboarding flow
│   │   └── auth/         # Auth API routes
│   │
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── layout/       # Navigation, sidebar
│   │   └── map/          # Map components (Leaflet)
│   │
│   ├── lib/              # Utilities
│   │   ├── supabase/     # Supabase clients (server, client, middleware)
│   │   └── utils.ts      # Helper functions (cn, etc.)
│   │
│   ├── hooks/            # Custom React hooks
│   │   └── use-auth.ts   # Authentication hook
│   │
│   ├── stores/           # Zustand state management
│   │   ├── auth-store.ts # Auth state
│   │   └── ui-store.ts   # UI state
│   │
│   ├── types/            # TypeScript types
│   ├── constants/        # App configuration
│   └── middleware.ts     # Next.js middleware
│
├── public/               # Static assets
└── package.json
```

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Auth:** Supabase Auth (with @supabase/ssr)
- **Database:** Supabase (PostgreSQL 16+)
- **State:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Maps:** Leaflet + React Leaflet
- **Icons:** Lucide React

---

## 🔑 Key Features Implemented

### Phase 1 (✅ Complete)
- ✅ User authentication (email/password, Google OAuth)
- ✅ User profile management
- ✅ Player onboarding with skill level selection
- ✅ Protected routes with middleware
- ✅ Server-side rendering with Supabase SSR

### Phase 2 (🔄 In Progress)
- 🔄 Court listing and discovery
- 🔄 Map-based court search
- 🔄 Court detail pages
- ⏳ Reservation system
- ⏳ Queue management

---

## 🎨 UI Components

Using **shadcn/ui** component library:
- Alert, Avatar, Button, Card
- Form, Input, Label
- Separator, Spinner
- Layout components (Sidebar, Navigation)

All components in `/src/components/ui/` with barrel export in `index.ts`.

---

## 🔐 Authentication Flow

1. **Signup:** `/signup` → Creates Supabase Auth user → Auto-creates profile via trigger
2. **Login:** `/login` → Supabase Auth → Redirects to `/home`
3. **Onboarding:** `/setup-profile` → Complete player profile → Redirect to app
4. **Protected Routes:** Middleware checks auth session, redirects if needed

### Supabase Integration

- **Client-side:** `@/lib/supabase/client` (browser)
- **Server-side:** `@/lib/supabase/server` (Server Components, Route Handlers)
- **Middleware:** `@/lib/supabase/middleware` (session refresh)

---

## 🗺 Map Integration

Using **Leaflet** (replaced Mapbox):
- `leaflet` + `react-leaflet` + `@types/leaflet`
- Dynamic import to avoid SSR issues
- Component: `/src/components/map/venue-map.tsx`
- OpenStreetMap tiles (no API key required)

---

## 📦 Available Scripts

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

---

## 🔗 Related Documentation

- **Project Root:** `/README.md` - Overall project overview
- **Backend Setup:** `/backend/README.md` - Database schema and setup
- **Development Guide:** `/CLAUDE.md` - AI assistant context and guidelines
- **Planning:** `/docs/planning.md` - Development phases and roadmap

---

## 🐛 Troubleshooting

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Supabase Connection Issues
- Check `.env.local` has correct credentials
- Verify Supabase project is not paused
- Test connection: Check Network tab in browser dev tools

### Type Errors
- Run type check: `npm run typecheck`
- Ensure `@rallio/shared` is built: `npm install` from root

---

**Framework:** Next.js 16  
**Status:** Phase 2 Development  
**Last Updated:** November 19, 2025
