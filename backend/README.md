# Rallio Backend

Supabase backend with PostgreSQL database.

## Setup

1. Create Supabase project at supabase.com
2. Copy `migrations/001_initial_schema.sql` to Supabase SQL Editor
3. Run the migration
4. Copy environment variables to web and mobile

## Structure

- `supabase/migrations/` - Database migrations
- `supabase/functions/` - Edge functions
- `supabase/seed/` - Seed data
- `api-docs/` - API documentation

## Database

27 tables:
- Users & Authentication
- Courts & Venues
- Reservations & Bookings
- Queue Management
- Payments & Billing
- Ratings & Reviews

See `docs/system-analysis/database-schema.md` for details.
