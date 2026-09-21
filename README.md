# Rallio

Badminton court discovery, booking, payments, and queue management for players and venues in Zamboanga City, Philippines.

## Preview

- **Live demo:** [add live demo link]
- **Repository:** [Rallio on GitHub](https://github.com/ymadz/rallio)
- **Screenshots or GIF:** [add project preview GIF here]

## Overview

Rallio is a full-stack badminton platform for players, court administrators, queue masters, and global administrators. Players can find nearby courts, view availability, make reservations, pay through GCash or Maya, and join badminton queues. Venue teams can manage courts, pricing, bookings, queue sessions, notifications, and platform activity from admin dashboards.

The project is designed around the needs of the badminton community in Zamboanga City, while keeping the web and mobile clients connected to the same Supabase backend and shared TypeScript package.

## Features

- Email/password and Google OAuth authentication
- Player profile setup with skill level and play style information
- Court and venue discovery with search and filters
- Interactive Leaflet map with location-based venue search
- Venue details, photos, amenities, pricing, and availability
- Court reservations with conflict detection
- GCash and Maya payments through PayMongo
- Payment webhook handling and reservation status updates
- Booking history, reservation management, and cancellation
- Queue discovery and queue joining
- Real-time queue positions and participant updates
- Queue session management for Queue Masters
- Match assignment, score recording, and payment tracking
- Court admin dashboards for venues, courts, reservations, pricing, and analytics
- Global admin tools for users, venues, moderation, settings, and audit logs
- In-app notifications with Supabase Realtime
- Shared TypeScript types, validation schemas, and utilities
- Early Capacitor Android/web-parity work
- Mobile app foundation using Expo and React Native

## Screenshots

Add screenshots here when the main flows are ready:

- **Home dashboard:** [add screenshot here]
- **Court discovery and map:** [add screenshot here]
- **Court details:** [add screenshot here]
- **Booking and time-slot selection:** [add screenshot here]
- **Checkout and payment flow:** [add screenshot here]
- **Queue dashboard:** [add screenshot here]
- **Court admin dashboard:** [add screenshot here]
- **Mobile app:** [add screenshot here]

## Tech Stack

### Web

- Next.js 16 with App Router
- React 18
- TypeScript 5
- Tailwind CSS 4
- Radix UI and custom UI components
- Zustand
- React Hook Form and Zod
- Leaflet and React Leaflet

### Mobile

- React Native 0.81
- Expo 54
- Expo Router
- React Native Maps
- Zustand
- AsyncStorage

### Backend and Data

- Supabase Auth
- PostgreSQL
- PostGIS
- Supabase Realtime
- Supabase Storage
- Supabase Edge Functions and database migrations
- Row Level Security (RLS)

### Integrations

- PayMongo for GCash and Maya payments
- OpenStreetMap tiles through Leaflet
- Capacitor for Android web-parity work

## My Role

I worked on the full-stack implementation of Rallio, including:

- Building the Next.js web application and shared TypeScript package
- Implementing authentication, profiles, court discovery, bookings, and queues
- Connecting the app to Supabase Auth, PostgreSQL, Realtime, Storage, and RLS
- Integrating PayMongo payments and webhook processing
- Building admin dashboards for venue and platform management
- Setting up the initial Expo mobile app structure
- Organizing the database migrations, validation schemas, and project documentation

## What I Learned

- How to structure a full-stack monorepo with shared TypeScript code
- How to use Supabase Auth, RLS, Realtime, Storage, and PostgreSQL migrations together
- How to handle payment webhooks and idempotent payment updates
- How to prevent overlapping reservations at the database level
- How to use PostGIS for location-based venue searches
- How to work around Leaflet server-side rendering limitations in Next.js
- How to build role-based dashboards and permissions
- How to keep server actions, cache invalidation, and client refreshes in sync
- How to plan a web application alongside an early-stage mobile client

## Challenges

- Keeping reservation availability accurate while preventing double bookings
- Handling PayMongo webhook signatures, duplicate events, and payment state changes
- Integrating Leaflet into a server-rendered Next.js application
- Designing permissions for players, Queue Masters, court admins, and global admins
- Supporting real-time queue changes without making the UI difficult to follow
- Managing shared code across the web app, mobile app, and backend
- Keeping the mobile app stable while working with a monorepo and Expo dependencies
- Managing project scope while core features and testing are still being completed

## Future Improvements

- Add unit, integration, and end-to-end test coverage
- Finish the mobile booking, map, queue, and notification flows
- Complete ratings and reviews for courts and players
- Add email and push notifications
- Finish split payments and participant invitations
- Automate payment expiration with a scheduled job or Edge Function
- Add booking rescheduling and refund flows
- Improve skill-based queue matching and ELO updates
- Replace in-memory rate limiting with a shared service such as Redis or Upstash
- Add venue approval, dispute handling, and financial reconciliation tools
- Reduce production logging and add a structured logger

## Installation

### Prerequisites

- Node.js 18 or later
- npm
- A Supabase project
- A PayMongo account for payment testing
- Expo Go or an Android/iOS development environment for mobile testing

### Setup

```bash
git clone https://github.com/ymadz/rallio.git
cd rallio
npm install
```

Create the required environment files described below, then start the web app:

```bash
npm run dev:web
```

The web app runs at `http://localhost:3000`.

To start the mobile app:

```bash
npm run dev:mobile
```

Useful commands:

```bash
npm run build:web      # Build the web application
npm run typecheck     # Run TypeScript checks
npm run lint          # Run the web lint checks
npm run format        # Format project files with Prettier
```

Database migrations are managed with the Supabase CLI:

```bash
cd backend/supabase
supabase migration new feature_name
supabase db push --linked
```

## Environment Variables

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY=
```

Do not commit environment files or secret keys. Leaflet currently uses OpenStreetMap tiles, so a Mapbox token is not required.

## Project Status

**In development.**

The web app has working authentication, court discovery, reservations, payments, queues, notifications, and admin dashboards. The mobile app is still at an early stage, and testing has not been fully added yet. Some planned features, including ratings, email and push notifications, split payments, booking changes, and refund handling, are still in progress.

## Acknowledgements

- Supabase for authentication, database, storage, and real-time features
- PayMongo for GCash and Maya payment integration
- Leaflet and OpenStreetMap for map functionality
- Expo and React Native for the mobile app foundation
- Zamboanga City's badminton community for the project context and inspiration
- [Add any UI assets, icons, design references, or other credits here]
