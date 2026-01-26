# 🏸 Rallio

Badminton Court Finder & Queue Management System for Zamboanga City, Philippines

**Status:** ~80% Complete | **Web:** Production-ready | **Mobile:** In Development

## Project Structure

```
rallio/
├── docs/          # Documentation, planning, tasks
├── backend/       # Supabase migrations & Edge Functions
├── web/           # Next.js 15 web application
├── mobile/        # React Native + Expo 54 mobile app
└── shared/        # Shared types, validations, utilities
```

---

## 🚀 Setup Instructions for Collaborators

### Prerequisites

Ensure you have the following installed:
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 9+** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)

You'll also need accounts for:
- **Supabase** (free tier works) - [supabase.com](https://supabase.com)
- **PayMongo** (for payment testing) - [paymongo.com](https://paymongo.com)

### Step 1: Clone the Repository

```bash
git clone https://github.com/madz/rallio.git
cd rallio
```

### Step 2: Install Dependencies

This is a monorepo using npm workspaces. Install everything from the root:

```bash
npm install
```

This installs dependencies for `web/`, `mobile/`, and `shared/` packages.

### Step 3: Configure Environment Variables

#### Web App (`web/.env.local`)

```bash
cp web/.env.example web/.env.local
```

Edit `web/.env.local` with your credentials:

```env
# Supabase (get from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# PayMongo (get from PayMongo Dashboard → Developers → API Keys)
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_xxxxx
PAYMONGO_SECRET_KEY=sk_test_xxxxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxxxx  # Optional for local dev

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Mobile App (`mobile/.env`)

```bash
cp mobile/.env.example mobile/.env
```

Edit `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_xxxxx
```

### Step 4: Database Setup (Supabase)

If setting up a new Supabase project:

1. Create a new project at [supabase.com](https://supabase.com)
2. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
3. Link your project:
   ```bash
   cd backend/supabase
   supabase login
   supabase link --project-ref your-project-ref
   ```
4. Apply migrations:
   ```bash
   supabase db push
   ```

> **Note:** If you're joining an existing team, ask for the Supabase credentials - you don't need to run migrations.

### Step 5: Run Development Servers

#### Web App (recommended for most development)

```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000)

#### Mobile App

```bash
npm run dev:mobile
# Or: cd mobile && npx expo start
```

Scan the QR code with Expo Go app on your phone.

### Step 6: Verify Setup

1. **Web**: Go to `http://localhost:3000/login` - you should see the login page
2. **Create account**: Sign up with email or Google OAuth
3. **Check database**: Your profile should appear in Supabase → Table Editor → profiles

---

## 🔑 Getting API Keys

### Supabase
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Settings → API
3. Copy: `Project URL`, `anon public`, `service_role`

### PayMongo (for payment testing)
1. Go to [paymongo.com](https://paymongo.com) → Dashboard
2. Developers → API Keys
3. Copy: `Public Key`, `Secret Key`
4. For webhooks: Developers → Webhooks → Create webhook pointing to `https://your-domain/api/webhooks/paymongo`

---

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant guidelines, debugging patterns |
| `docs/tasks.md` | Current tasks and progress tracking |
| `docs/planning.md` | Development phases and roadmap |
| `web/src/app/actions/` | Server actions (API logic) |
| `web/src/lib/supabase/` | Supabase client configurations |
| `shared/src/` | Shared types, validations, utilities |

---

## Tech Stack

**Web:**
- Next.js 15.1.6 (App Router)
- React 18.3, TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Zustand (state), Zod (validation)
- Leaflet + OpenStreetMap (maps)

**Mobile:**
- React Native 0.81.5, Expo 54
- Expo Router (file-based navigation)
- react-native-maps

**Backend:**
- Supabase (PostgreSQL + Auth + RLS)
- PostGIS (geospatial queries)
- PayMongo (GCash, Maya payments)

## Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidelines & debugging
- [docs/planning.md](docs/planning.md) - Development phases
- [docs/tasks.md](docs/tasks.md) - Current tasks & progress

## Development Commands

```bash
npm run dev:web      # Web dev server (localhost:3000)
npm run dev:mobile   # Mobile Expo server
npm run build:web    # Production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run format       # Prettier format all files
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found: @rallio/shared` | Run `npm install` from root |
| Supabase connection error | Check `.env.local` credentials |
| Map shows white screen | Leaflet SSR issue - check `ssr: false` on dynamic import |
| Auth callback fails | Ensure `NEXT_PUBLIC_APP_URL` matches your dev URL |

---

Built with ❤️ for Zamboanga City badminton community
