# Supabase Migrations

This directory contains database migrations for the Rallio application.

## How to Apply Migrations

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project root
cd /Users/madz/Documents/GitHub/rallio

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations to Supabase
supabase db push
```

### Option 2: Manual SQL Execution

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the content of each migration file in order:
   - `002_add_nearby_venues_function.sql`
   - `003_fix_court_availabilities.sql`
4. Execute each migration

## Migration History

### 001_initial_schema_v2.sql
- Initial database schema with all tables
- PostGIS extension for geospatial queries
- RLS policies for all tables
- Triggers for automatic profile creation

### 002_add_nearby_venues_function.sql (NEW)
- Adds `nearby_venues` RPC function for efficient geospatial search
- Uses PostGIS earth_distance and earth_box functions
- Returns venues within specified radius sorted by distance

### 003_fix_court_availabilities.sql (NEW)
- Adds computed `date` column to `court_availabilities` table
- Creates indexes for improved query performance
- Enables easier date-based availability queries

## Testing Migrations

After applying migrations, test with:

```sql
-- Test nearby_venues function
SELECT * FROM nearby_venues(
  6.9214,  -- Zamboanga City latitude
  122.0790, -- Zamboanga City longitude
  50,      -- 50km radius
  10       -- limit 10 results
);

-- Test court_availabilities date column
SELECT court_id, date, start_time, end_time
FROM court_availabilities
WHERE date = CURRENT_DATE
  AND is_reserved = false
LIMIT 5;
```

## Rollback

If you need to rollback migrations:

```bash
# Using Supabase CLI
supabase db reset

# Or manually drop the function/column in SQL Editor:
DROP FUNCTION IF EXISTS nearby_venues;
ALTER TABLE court_availabilities DROP COLUMN IF EXISTS date;
```
