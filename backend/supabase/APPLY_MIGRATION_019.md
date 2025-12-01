# Apply Migration 019: Global Admin Elevation & Policies

## Overview
This migration establishes the complete database foundation for the Global Admin Dashboard, including helper functions, audit logging, ban/suspend system, platform settings, and RLS policies.

## What This Migration Does

### 1. Helper Functions
- `has_role(user_id, role_name)` - RLS policy helper for role checks
- `is_user_banned(user_id)` - Ban status verification

### 2. Admin Audit Logs Table
Creates `admin_audit_logs` with:
- Admin action tracking (who, what, when)
- Old/new value comparison (JSONB)
- IP address and user agent logging
- 4 indexes for performance

### 3. Ban/Suspend System
Adds to `profiles`:
- `is_banned` (boolean)
- `banned_reason` (text)
- `banned_until` (timestamp, NULL = permanent)
- `banned_by` (UUID)
- `banned_at` (timestamp)

Adds to `venues`:
- `approval_status` (pending/approved/rejected)
- `rejected_reason` (text)
- `reviewed_by` (UUID)
- `reviewed_at` (timestamp)

### 4. Ban Enforcement Triggers
Prevents banned users from:
- Creating reservations
- Creating queue sessions
- Submitting reviews

### 5. Platform Settings Table
Key-value store for global configuration:
- Booking policies
- Payment settings
- Rate limits
- Feature flags
- 10 default settings pre-populated

### 6. RLS Policies (15+ tables)
Global admins can:
- **SELECT/UPDATE**: profiles, user_roles, venues, courts, reservations, payments, queue_sessions, reviews, players
- **DELETE**: reviews (moderation)

## Prerequisites

1. Ensure migrations 001-018 are applied
2. Have at least one user with `global_admin` role
3. Backup your database before running

## Apply Migration

### Option 1: Supabase CLI (Recommended)
```bash
cd /Users/madz/Documents/GitHub/rallio
supabase db push
```

### Option 2: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Open `/backend/supabase/migrations/019_global_admin_elevation_policies.sql`
3. Copy entire file contents
4. Paste into SQL Editor
5. Click "Run"

## Verification Queries

After applying, run these checks:

```sql
-- 1. Verify helper functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('has_role', 'is_user_banned');

-- 2. Verify admin_audit_logs table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'admin_audit_logs'
);

-- 3. Verify profiles columns added
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('is_banned', 'banned_reason', 'banned_until');

-- 4. Verify venues columns added
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name IN ('approval_status', 'rejected_reason');

-- 5. Verify platform_settings populated
SELECT COUNT(*) FROM platform_settings;
-- Should return 10

-- 6. Verify RLS policies added
SELECT tablename, policyname 
FROM pg_policies 
WHERE policyname LIKE '%global_admin%';

-- 7. Test has_role function (replace UUID with your global admin ID)
SELECT has_role('your-user-id-here', 'global_admin');
-- Should return true
```

## Post-Migration Steps

1. **Assign Global Admin Role** (if not already done):
   ```sql
   -- Get role_id for global_admin
   SELECT id FROM roles WHERE name = 'global_admin';
   
   -- Assign to your user
   INSERT INTO user_roles (user_id, role_id)
   VALUES (
     'your-user-id-here',
     (SELECT id FROM roles WHERE name = 'global_admin')
   )
   ON CONFLICT DO NOTHING;
   ```

2. **Migrate Existing Venue Data**:
   ```sql
   -- Set approval_status based on is_verified
   UPDATE venues
   SET approval_status = CASE
     WHEN is_verified = true THEN 'approved'
     ELSE 'pending'
   END
   WHERE approval_status IS NULL;
   ```

3. **Test RLS Policies**:
   ```sql
   -- As global admin, should be able to view all profiles
   SELECT COUNT(*) FROM profiles;
   
   -- As regular user, should only see own profile
   SELECT COUNT(*) FROM profiles;
   -- Should return 1
   ```

4. **Test Ban System**:
   ```sql
   -- Ban a test user
   UPDATE profiles
   SET is_banned = true,
       banned_reason = 'Test ban',
       banned_by = 'your-admin-id',
       banned_at = NOW()
   WHERE id = 'test-user-id';
   
   -- Try to create reservation as banned user
   -- Should fail with trigger error
   ```

## Troubleshooting

### Error: "function has_role already exists"
**Solution**: Migration was partially applied. Check what exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('has_role', 'is_user_banned');
```
If functions exist, comment out that section and re-run.

### Error: "column approval_status already exists"
**Solution**: Venues table already modified. Check:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'venues' AND column_name = 'approval_status';
```
If column exists, comment out the ALTER TABLE statements.

### Error: "permission denied for table profiles"
**Solution**: Not logged in as global admin or RLS policies blocking. Run as service role:
```bash
supabase db push --db-url "postgresql://postgres:[SERVICE_ROLE_KEY]@..."
```

### Ban trigger not firing
**Solution**: Check trigger exists:
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'check_user_not_banned_trigger';
```
If missing, re-run the trigger creation section.

## Rollback (If Needed)

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS check_user_not_banned_trigger ON reservations;
DROP TRIGGER IF EXISTS check_user_not_banned_trigger ON queue_sessions;
DROP TRIGGER IF EXISTS check_user_not_banned_trigger ON reviews;

-- Drop functions
DROP FUNCTION IF EXISTS check_user_not_banned();
DROP FUNCTION IF EXISTS is_user_banned(uuid);
DROP FUNCTION IF EXISTS has_role(uuid, text);

-- Drop tables
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS admin_audit_logs CASCADE;

-- Remove columns (optional - may have data)
-- ALTER TABLE profiles DROP COLUMN is_banned;
-- ALTER TABLE venues DROP COLUMN approval_status;

-- Drop policies
-- (List generated policies and drop manually)
```

## Next Steps

After migration is verified:
1. Access `/admin` route to view dashboard
2. Verify stat cards display correctly
3. Test sidebar navigation
4. Proceed to Phase 2.2: User Management Interface

## Support

If you encounter issues:
1. Check verification queries above
2. Review Supabase logs for errors
3. Ensure you're logged in as global admin
4. Verify migrations 001-018 are applied
