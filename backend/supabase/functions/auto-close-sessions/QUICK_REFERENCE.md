# Auto-Close Sessions - Quick Reference

One-page reference for common operations.

## Deploy

```bash
# 1. Apply migration
# Via Supabase Dashboard: SQL Editor → Run 007_auto_close_expired_sessions.sql

# 2. Deploy Edge Function
cd backend/supabase
supabase functions deploy auto-close-sessions

# 3. Verify
supabase functions invoke auto-close-sessions --method POST
```

## Test

```sql
-- Create test expired session
SELECT create_test_expired_session();

-- View expired sessions
SELECT * FROM expired_queue_sessions;

-- Run auto-close
SELECT auto_close_expired_sessions();

-- Verify closure
SELECT id, status, settings->'summary' FROM queue_sessions
WHERE settings->>'testSession' = 'true' ORDER BY updated_at DESC LIMIT 1;

-- Cleanup test sessions
DELETE FROM queue_sessions WHERE settings->>'testSession' = 'true';
```

## Schedule (Choose ONE)

### Option 1: Supabase Cron (Recommended)
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'auto-close-expired-sessions',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Option 2: GitHub Actions
Already configured in `.github/workflows/auto-close-sessions.yml`

Set secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Monitor

```bash
# Function logs
supabase functions logs auto-close-sessions --tail
```

```sql
-- Auto-closed sessions count
SELECT COUNT(*) FROM queue_sessions
WHERE status = 'closed' AND settings->'summary'->>'closedBy' = 'system';

-- Recent auto-closures
SELECT id, end_time, updated_at, settings->'summary' FROM queue_sessions
WHERE settings->'summary'->>'closedBy' = 'system'
ORDER BY updated_at DESC LIMIT 10;

-- Sessions that should be closed but aren't
SELECT * FROM expired_queue_sessions;

-- Cron job history (if using pg_cron)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-close-expired-sessions')
ORDER BY start_time DESC LIMIT 10;
```

## Troubleshoot

```sql
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'auto_close_expired_sessions';

-- Test function directly
SELECT auto_close_expired_sessions();

-- Check expired sessions
SELECT COUNT(*) FROM expired_queue_sessions;

-- Verify cron job (if using pg_cron)
SELECT * FROM cron.job WHERE jobname = 'auto-close-expired-sessions';
```

## Disable

```sql
-- Unschedule cron job
SELECT cron.unschedule('auto-close-expired-sessions');
```

For GitHub Actions: Comment out `schedule:` in workflow file

## Environment Variables

Edge Function uses:
- `SUPABASE_URL` (auto-provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase)

## Key Files

- Migration: `/backend/supabase/migrations/007_auto_close_expired_sessions.sql`
- Edge Function: `/backend/supabase/functions/auto-close-sessions/index.ts`
- Verification: `/backend/supabase/migrations/VERIFY_MIGRATION_007.sql`
- GitHub Workflow: `/.github/workflows/auto-close-sessions.yml`
- Full Guide: `/backend/supabase/functions/DEPLOYMENT_GUIDE.md`
