# Auto-Close Sessions Edge Function

Automatically closes queue sessions that have passed their `end_time`.

## Overview

This Edge Function calls the `auto_close_expired_sessions()` PostgreSQL function to:
- Find sessions where `end_time < now()` and status is 'open', 'active', or 'paused'
- Calculate session summary (total games, revenue, participants, unpaid balances)
- Update status to 'closed' with summary stored in `settings` JSONB
- Return detailed results including count of closed sessions

## Deployment

### Prerequisites
1. Supabase CLI installed: `npm install -g supabase`
2. Apply migration `007_auto_close_expired_sessions.sql` first
3. Link to your Supabase project: `supabase link --project-ref YOUR_PROJECT_REF`

### Deploy the Function
```bash
# From the root of the repo
cd backend/supabase

# Deploy the function
supabase functions deploy auto-close-sessions

# Verify deployment
supabase functions list
```

### Test the Function Manually
```bash
# Invoke directly via CLI
supabase functions invoke auto-close-sessions --method POST

# Or test via HTTP
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Scheduling

### Option 1: Supabase Cron (Recommended)
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - **Name**: Auto-close expired sessions
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **SQL**:
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     ) as request_id;
     ```
3. Enable the cron job

**Note:** Requires `pg_net` extension (usually enabled by default in Supabase)

### Option 2: GitHub Actions Cron
Create `.github/workflows/auto-close-sessions.yml`:
```yaml
name: Auto-Close Expired Sessions
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  auto-close:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST '${{ secrets.SUPABASE_URL }}/functions/v1/auto-close-sessions' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

### Option 3: External Cron Service
Use services like:
- **Cron-job.org** (free, web-based)
- **EasyCron** (free tier available)
- **AWS EventBridge** (if using AWS)
- **Google Cloud Scheduler** (if using GCP)

Configure to send POST request to:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-close-sessions
```

Headers:
```
Authorization: Bearer YOUR_ANON_KEY
Content-Type: application/json
```

## Testing

### 1. Create Test Expired Session
```sql
-- In Supabase SQL Editor
SELECT create_test_expired_session();  -- Creates session expired 5 minutes ago
-- Or specify organizer and expiration time
SELECT create_test_expired_session('user-id-here'::uuid, 10);  -- Expired 10 minutes ago
```

### 2. Check for Expired Sessions
```sql
-- View all expired sessions
SELECT * FROM expired_queue_sessions;
```

### 3. Run Auto-Close Manually
```sql
-- Call the database function directly
SELECT auto_close_expired_sessions();
```

### 4. Verify Results
```sql
-- Check that test session was closed
SELECT id, status, settings->'summary' as summary
FROM queue_sessions
WHERE settings->>'testSession' = 'true'
ORDER BY updated_at DESC
LIMIT 5;
```

### 5. Test Edge Function
```bash
# Via Supabase CLI
supabase functions invoke auto-close-sessions --method POST

# Via curl
curl -X POST 'http://localhost:54321/functions/v1/auto-close-sessions' \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Response Format

### Success Response
```json
{
  "success": true,
  "processedAt": "2025-11-27T10:30:00.000Z",
  "closedCount": 3,
  "failedCount": 0,
  "closedSessions": [
    {
      "sessionId": "uuid-here",
      "courtId": "court-uuid",
      "endTime": "2025-11-27T10:00:00.000Z",
      "summary": {
        "totalGames": 15,
        "totalRevenue": 750.00,
        "totalParticipants": 12,
        "unpaidBalances": 2,
        "closedAt": "2025-11-27T10:30:00.000Z",
        "closedBy": "system",
        "closedReason": "automatic_expiration"
      }
    }
  ],
  "message": "Successfully closed 3 session(s)"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here",
  "processedAt": "2025-11-27T10:30:00.000Z",
  "closedCount": 0,
  "failedCount": 0,
  "closedSessions": []
}
```

## Monitoring

### Check Logs
```bash
# View function logs
supabase functions logs auto-close-sessions --tail

# Or in Supabase Dashboard → Edge Functions → auto-close-sessions → Logs
```

### Database Monitoring Queries
```sql
-- Count sessions closed by system vs manual
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
  court_id,
  end_time,
  updated_at,
  (updated_at - end_time) as delay_before_close,
  settings->'summary' as summary
FROM queue_sessions
WHERE status = 'closed'
  AND settings->'summary'->>'closedBy' = 'system'
ORDER BY updated_at DESC
LIMIT 10;

-- Check for sessions that should have been closed but weren't
SELECT * FROM expired_queue_sessions;
```

## Troubleshooting

### Issue: Function not closing sessions

**Check:**
1. Migration applied? `SELECT * FROM pg_proc WHERE proname = 'auto_close_expired_sessions';`
2. Function has permissions? `GRANT EXECUTE ON FUNCTION auto_close_expired_sessions() TO service_role;`
3. Expired sessions exist? `SELECT * FROM expired_queue_sessions;`
4. Function logs: `supabase functions logs auto-close-sessions`

### Issue: Database function returns error

**Check:**
1. RLS policies not blocking? (Function uses `SECURITY DEFINER` to bypass RLS)
2. Required tables exist? (queue_sessions, queue_participants)
3. Database logs in Supabase Dashboard → Database → Logs

### Issue: Cron job not running

**For Supabase Cron:**
1. Check pg_net extension: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`
2. View cron job status: `SELECT * FROM cron.job;`
3. Check cron job run history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`

**For GitHub Actions:**
1. Check workflow runs in GitHub → Actions
2. Verify secrets are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
3. Check workflow permissions

## Performance Considerations

- **Query Efficiency**: Uses indexed columns (end_time, status) for fast lookups
- **Batch Processing**: Processes all expired sessions in one function call
- **Error Isolation**: Each session is processed in a try-catch block
- **Logging**: Comprehensive logging for monitoring and debugging

## Security

- **SECURITY DEFINER**: Database function runs with owner privileges to bypass RLS
- **Service Role Key**: Edge Function uses service role key for elevated permissions
- **No User Input**: Function accepts no parameters, reducing attack surface
- **Read-Only for Authenticated**: Only service role can modify, authenticated users can read

## Future Enhancements

- [ ] Add email notifications to participants when session auto-closes
- [ ] Track auto-close metrics (average delay, frequency)
- [ ] Add configurable grace period before closing
- [ ] Implement partial refunds for interrupted sessions
- [ ] Add webhook notification when sessions are auto-closed
