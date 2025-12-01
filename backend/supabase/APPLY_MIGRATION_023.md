# Apply Migration 023 - Moderation System

## Quick Start

This migration adds the necessary database columns for the content moderation system.

---

## What This Migration Does

1. Adds `metadata` JSONB column to `court_ratings` table
2. Adds `metadata` JSONB column to `player_ratings` table
3. Adds `is_banned` BOOLEAN column to `profiles` table
4. Creates indexes for performance:
   - Flagged content queries
   - Banned users queries
   - GIN indexes for metadata JSONB queries

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of `backend/supabase/migrations/023_add_metadata_for_moderation.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify success message appears

### Option 2: Supabase CLI

```bash
# Make sure you're in the project root
cd /path/to/rallio

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push
```

---

## Verification

After applying the migration, run these queries to verify:

### 1. Check metadata columns exist

```sql
-- Check court_ratings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'court_ratings' 
AND column_name = 'metadata';

-- Check player_ratings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_ratings' 
AND column_name = 'metadata';

-- Check profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'is_banned';
```

**Expected Result:** Each query should return one row showing the column exists

### 2. Check indexes were created

```sql
-- Check court_ratings indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'court_ratings' 
AND indexname LIKE '%metadata%';

-- Check profiles index
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname = 'idx_profiles_banned';
```

**Expected Result:** Should see:
- `idx_court_ratings_metadata_flagged`
- `idx_court_ratings_metadata`
- `idx_profiles_banned`

### 3. Test default values

```sql
-- Check that new columns have correct defaults
SELECT 
  (metadata IS NOT NULL) as metadata_not_null,
  (is_banned = false) as is_banned_default
FROM profiles
LIMIT 1;
```

**Expected Result:** Both should be `true`

---

## Rollback (If Needed)

If you need to undo this migration:

```sql
-- Remove columns
ALTER TABLE court_ratings DROP COLUMN IF EXISTS metadata;
ALTER TABLE player_ratings DROP COLUMN IF EXISTS metadata;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_banned;

-- Drop indexes
DROP INDEX IF EXISTS idx_court_ratings_metadata_flagged;
DROP INDEX IF EXISTS idx_profiles_banned;
DROP INDEX IF EXISTS idx_court_ratings_metadata;
DROP INDEX IF EXISTS idx_player_ratings_metadata;
```

---

## Testing the Moderation System

After applying the migration, test the moderation system:

### 1. Flag a Review (as Court Admin)

```typescript
// In court admin reviews page
await flagReview(reviewId, 'Test flag: Inappropriate content')
```

### 2. View in Moderation Queue (as Global Admin)

1. Navigate to `/admin/moderation`
2. Should see the flagged review in "Pending" tab
3. Verify all details are visible

### 3. Test Moderation Actions

- Dismiss flag (no violation)
- Delete review (violation found)
- Ban user (severe violation)

### 4. Verify Ban Functionality

- Check banned user appears in "Banned Users" tab
- Test unbanning user
- Verify `is_banned` column updated correctly

---

## Common Issues

### Issue: "column metadata already exists"

**Cause:** Migration already applied or column exists from another source

**Solution:** 
- No action needed if column exists with correct type (JSONB)
- Or use `ADD COLUMN IF NOT EXISTS` (already in migration)

### Issue: "relation court_ratings does not exist"

**Cause:** Running migration on wrong database or schema not initialized

**Solution:**
1. Verify you're connected to correct database
2. Ensure Migration 001 (initial schema) was applied first
3. Check table exists: `SELECT * FROM court_ratings LIMIT 1;`

### Issue: Index creation fails

**Cause:** Conflicting index names or syntax error

**Solution:**
1. Drop existing indexes first
2. Re-run migration
3. Check PostgreSQL version compatibility (need 9.4+ for GIN indexes on JSONB)

---

## Migration History

After applying, update your migration tracking:

```sql
-- Optional: Record migration in custom tracking table
INSERT INTO migration_history (version, name, applied_at)
VALUES ('023', 'add_metadata_for_moderation', NOW());
```

---

## Next Steps

1. ✅ Apply migration
2. ✅ Verify columns and indexes
3. ✅ Test flagging a review
4. ✅ Test moderation actions
5. ✅ Test ban/unban functionality
6. ⏳ Set up notification system (future enhancement)

---

## Summary

**Migration:** 023_add_metadata_for_moderation.sql

**Tables Modified:**
- `court_ratings` (add metadata JSONB)
- `player_ratings` (add metadata JSONB)
- `profiles` (add is_banned BOOLEAN)

**Indexes Created:**
- Flagged content index (partial index on metadata->>'flagged')
- Banned users index (partial index on is_banned)
- GIN indexes for JSONB metadata columns

**Estimated Time:** < 1 minute

**Downtime Required:** None (non-blocking ALTER TABLE)

**Safe to Apply:** Yes (uses IF NOT EXISTS, won't fail if columns exist)
