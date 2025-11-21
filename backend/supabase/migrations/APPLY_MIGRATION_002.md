# How to Apply Migration 002: Add Players INSERT Policy

## The Problem
The `players` table is missing an INSERT policy in Row Level Security (RLS), which prevents users from creating player profiles during onboarding if the database trigger didn't create one.

## The Solution
Migration `002_add_players_insert_policy.sql` adds the missing INSERT policy.

## How to Apply (Supabase Dashboard)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the contents of `002_add_players_insert_policy.sql`:

```sql
-- Add INSERT policy for players table
-- This allows users to create their own player profile during onboarding
-- if it wasn't created by the signup trigger for some reason

CREATE POLICY "Users can insert own player profile" ON players
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

6. Click "Run" to execute the migration
7. You should see a success message

## Verify the Policy was Created

Run this query to verify:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'players';
```

You should see these policies:
- `Players are viewable by everyone` (SELECT)
- `Users can update own player profile` (UPDATE)
- `Users can insert own player profile` (INSERT) ← New!

## Alternative: Apply via Supabase CLI (if using local dev)

If you're using local Supabase development:

```bash
cd /Users/madz/Documents/GitHub/rallio
supabase db push
```

This will apply all pending migrations to your remote database.
