# Auto-Close Sessions - Complete Deployment Guide

This guide walks you through deploying the automatic session closure feature from start to finish.

## Prerequisites

- [x] Supabase project set up
- [x] Supabase CLI installed (`npm install -g supabase`)
- [x] Project linked to Supabase (`supabase link --project-ref YOUR_PROJECT_REF`)
- [x] Database migrations 001-006 already applied

## Step 1: Apply Database Migration

The migration creates the PostgreSQL function that handles the close logic.

### Via Supabase Dashboard (Recommended for Production)

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_REF
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `/backend/supabase/migrations/007_auto_close_expired_sessions.sql`
5. Paste into the query editor
6. Click **Run** (bottom right)
7. Verify success: "Success. No rows returned"

### Via Supabase CLI (Local Development)

```bash
# From the project root
cd backend/supabase

# Apply the migration
supabase db push

# Or apply specific migration
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  -f migrations/007_auto_close_expired_sessions.sql
```

### Verify Migration Success

Run the verification script:

```bash
# Via Supabase Dashboard SQL Editor
# Copy and paste contents of VERIFY_MIGRATION_007.sql

# Or via CLI
psql "YOUR_DATABASE_URL" -f migrations/VERIFY_MIGRATION_007.sql
```

Expected output:
- ✅ Function `auto_close_expired_sessions()` exists
- ✅ View `expired_queue_sessions` exists
- ✅ Test function `create_test_expired_session()` exists
- ✅ Test session can be created and auto-closed

## Step 2: Deploy Edge Function

### Deploy via Supabase CLI

```bash
# From backend/supabase directory
cd backend/supabase

# Deploy the function
supabase functions deploy auto-close-sessions

# Expected output:
# Deploying auto-close-sessions (project ref: YOUR_PROJECT_REF)
# Deployed!
```

### Verify Deployment

```bash
# List all functions
supabase functions list

# Expected output includes:
# auto-close-sessions | 1 | 2025-11-27T... | https://...
```

### Test the Deployed Function

```bash
# Test via CLI
supabase functions invoke auto-close-sessions --method POST

# Expected output:
# {
#   "success": true,
#   "closedCount": 0,  # (if no expired sessions)
#   "failedCount": 0,
#   "processedAt": "2025-11-27T...",
#   ...
# }
```

## Step 3: Create Test Session and Verify

### Create Test Expired Session

```sql
-- In Supabase SQL Editor
SELECT create_test_expired_session();  -- Returns session UUID
```

### Check Expired Sessions View

```sql
SELECT * FROM expired_queue_sessions;
-- Should show 1 row with the test session
```

### Trigger Auto-Close

**Option A: Via Edge Function**
```bash
supabase functions invoke auto-close-sessions --method POST
```

**Option B: Via Database Function**
```sql
SELECT auto_close_expired_sessions();
```

### Verify Session Was Closed

```sql
SELECT
  id,
  status,  -- Should be 'closed'
  settings->'summary' as summary
FROM queue_sessions
WHERE settings->>'testSession' = 'true'
ORDER BY updated_at DESC
LIMIT 1;
```

Expected:
- `status` = 'closed'
- `summary.closedBy` = 'system'
- `summary.closedReason` = 'automatic_expiration'

## Step 4: Set Up Automatic Scheduling

Choose ONE of the following options:

### Option A: Supabase Cron (Recommended)

This runs entirely within Supabase infrastructure - most reliable option.

#### Enable pg_net Extension (if not already enabled)

```sql
-- In Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### Create Cron Job via Dashboard

1. Go to **Database** → **Cron Jobs** (if available)
2. Click **Create New Job**
3. Configure:
   - **Name**: `auto-close-expired-sessions`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **SQL Command**:
   ```sql
   SELECT net.http_post(
     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
     )
   ) as request_id;
   ```
4. Click **Create**

#### Or Create Cron Job via SQL

```sql
-- Install pg_cron extension (if not installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job
SELECT cron.schedule(
  'auto-close-expired-sessions',  -- Job name
  '*/5 * * * *',                   -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id;
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job WHERE jobname = 'auto-close-expired-sessions';
```

#### Monitor Cron Job Execution

```sql
-- View recent cron job runs
SELECT
  runid,
  jobid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-close-expired-sessions')
ORDER BY start_time DESC
LIMIT 10;
```

### Option B: GitHub Actions (Free, No Supabase Extensions Required)

Perfect if you don't have access to pg_cron or prefer external scheduling.

#### Prerequisites

The workflow file is already created at `.github/workflows/auto-close-sessions.yml`

#### Set Up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

   **Secret 1: SUPABASE_URL**
   - Name: `SUPABASE_URL`
   - Value: `https://YOUR_PROJECT_REF.supabase.co`

   **Secret 2: SUPABASE_SERVICE_ROLE_KEY**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Your Supabase service role key (from Supabase Dashboard → Settings → API)

#### Enable GitHub Actions

1. Go to **Actions** tab in your repository
2. If disabled, click **"I understand my workflows, go ahead and enable them"**
3. Find **"Auto-Close Expired Queue Sessions"** workflow
4. Click **Enable workflow** if needed

#### Test Manual Trigger

1. Go to **Actions** → **Auto-Close Expired Queue Sessions**
2. Click **Run workflow** dropdown
3. Select branch (usually `main`)
4. Click **Run workflow**
5. Wait for completion (should take ~10 seconds)
6. Check logs to verify success

#### Verify Scheduled Runs

The workflow will run automatically every 10 minutes. Check recent runs in the **Actions** tab.

### Option C: External Cron Service (Alternative)

Use a free cron service like cron-job.org or EasyCron.

#### Configure Cron-job.org

1. Sign up at https://cron-job.org/
2. Create new cron job:
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions`
   - **Schedule**: Every 5 or 10 minutes
   - **Request Method**: POST
   - **Headers**:
     ```
     Authorization: Bearer YOUR_ANON_KEY
     Content-Type: application/json
     ```
3. Save and enable

## Step 5: Monitor and Maintain

### Check Edge Function Logs

```bash
# Stream logs in real-time
supabase functions logs auto-close-sessions --tail

# Or via Supabase Dashboard
# Go to Edge Functions → auto-close-sessions → Logs
```

### Monitor Auto-Closed Sessions

```sql
-- Count auto-closed vs manually closed sessions
SELECT
  settings->'summary'->>'closedBy' as closed_by,
  COUNT(*) as count,
  SUM((settings->'summary'->>'totalRevenue')::numeric) as total_revenue
FROM queue_sessions
WHERE status = 'closed'
  AND settings->'summary' IS NOT NULL
GROUP BY settings->'summary'->>'closedBy';

-- Recent auto-closed sessions
SELECT
  id,
  end_time,
  updated_at,
  (updated_at - end_time) as delay_before_close,
  settings->'summary'->>'totalGames' as games,
  settings->'summary'->>'totalRevenue' as revenue
FROM queue_sessions
WHERE status = 'closed'
  AND settings->'summary'->>'closedBy' = 'system'
ORDER BY updated_at DESC
LIMIT 20;

-- Check for sessions that should be closed but aren't
SELECT
  id,
  end_time,
  status,
  (now() - end_time) as time_since_expiration
FROM expired_queue_sessions;
```

### Set Up Alerts (Optional)

Create a monitoring query that alerts if sessions aren't being closed:

```sql
-- Alert if any sessions are expired for more than 30 minutes
SELECT
  COUNT(*) as stuck_sessions
FROM queue_sessions
WHERE end_time < (now() - interval '30 minutes')
  AND status IN ('open', 'active', 'paused');

-- If stuck_sessions > 0, investigate!
```

## Troubleshooting

### Issue: "Function not found"

**Cause**: Migration 007 not applied

**Solution**:
```sql
-- Check if function exists
SELECT * FROM pg_proc WHERE proname = 'auto_close_expired_sessions';

-- If empty, re-apply migration 007
```

### Issue: Edge Function returns 500

**Cause**: Database function error or permissions issue

**Solution**:
1. Check Edge Function logs: `supabase functions logs auto-close-sessions`
2. Test database function directly: `SELECT auto_close_expired_sessions();`
3. Check RLS policies aren't blocking (function uses SECURITY DEFINER)

### Issue: Cron job not running

**For pg_cron:**
```sql
-- Check if pg_cron extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'auto-close-expired-sessions';

-- Check cron job run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**For GitHub Actions:**
1. Check workflow file syntax is valid
2. Verify secrets are set correctly
3. Check workflow permissions: Settings → Actions → General → Workflow permissions
4. View workflow run logs in Actions tab

### Issue: Sessions not getting closed

**Possible causes:**
1. Scheduler not running (check logs)
2. No expired sessions exist (run verification query)
3. Database function has error (test directly)
4. RLS policies blocking (shouldn't happen with SECURITY DEFINER)

**Debug steps:**
```sql
-- 1. Check for expired sessions
SELECT * FROM expired_queue_sessions;

-- 2. Test database function directly
SELECT auto_close_expired_sessions();

-- 3. Check last auto-close execution
SELECT
  id,
  updated_at,
  settings->'summary'->>'processedAt' as last_processed
FROM queue_sessions
WHERE settings->'summary'->>'closedBy' = 'system'
ORDER BY updated_at DESC
LIMIT 1;
```

## Cleanup

### Remove Test Sessions

```sql
-- Delete all test sessions
DELETE FROM queue_sessions
WHERE settings->>'testSession' = 'true';
```

### Disable Cron (if needed)

**For pg_cron:**
```sql
-- Unschedule the job
SELECT cron.unschedule('auto-close-expired-sessions');
```

**For GitHub Actions:**
1. Go to repository Settings → Actions → General
2. Disable workflows, or
3. Edit `.github/workflows/auto-close-sessions.yml` and comment out the schedule section

## Summary

After completing this guide:
- ✅ Database function `auto_close_expired_sessions()` is deployed
- ✅ Edge Function `auto-close-sessions` is live
- ✅ Automatic scheduling is configured (cron or GitHub Actions)
- ✅ Monitoring queries are ready
- ✅ System automatically closes expired sessions every 5-10 minutes

Queue sessions will now automatically close when their `end_time` is reached, with complete session summaries stored in the database.
