# Migration 020: Fix is_active Default Values

## Purpose
This migration fixes the `is_active` field in the profiles table to ensure all existing users are properly marked as active and sets the default value for future records.

## Problem
- Existing users have `is_active = NULL` in the database
- The UI is treating `NULL` as `false`, showing all users as "Deactivated"
- The column may not have a default value set

## Solution
1. Update all `NULL` values to `true` for existing users
2. Set the column default to `true` for new users
3. Add documentation comment

## How to Apply

### Option 1: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `020_fix_is_active_default.sql`
3. Click "Run"

### Option 2: Via psql
```bash
psql -h <your-db-host> -U postgres -d postgres -f 020_fix_is_active_default.sql
```

### Option 3: Via Supabase CLI
```bash
supabase db push
```

## Verification

After applying, verify the changes:

```sql
-- Check that no users have NULL is_active
SELECT COUNT(*) FROM profiles WHERE is_active IS NULL;
-- Should return 0

-- Check that all users are active (unless explicitly deactivated)
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_users,
  COUNT(*) FILTER (WHERE is_active = false) as deactivated_users
FROM profiles;

-- Verify the default value is set
SELECT column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'is_active';
-- Should return 'true'
```

## Rollback

If you need to rollback (not recommended):

```sql
ALTER TABLE profiles ALTER COLUMN is_active DROP DEFAULT;
```

Note: This only removes the default; it doesn't change existing values.
