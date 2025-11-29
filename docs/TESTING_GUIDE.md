# Queue System Testing Guide

This guide walks you through testing all the newly implemented queue features.

---

## Prerequisites

### 1. Apply Database Migration
```sql
-- Run this in Supabase SQL Editor
-- File: backend/supabase/migrations/007_auto_close_expired_sessions.sql
```

### 2. Start Development Server
```bash
npm run dev:web
```

### 3. Required User Roles
You'll need at least two accounts:
- **Queue Master account** - Has queue_master role
- **Player account** - Regular player role

---

## Feature 1: Payment Management Testing

### A. Test "Mark as Paid" (Cash Payments)

**Setup:**
1. Create a queue session as Queue Master
2. Have a player join the queue
3. Assign the player to a match
4. Record match score (this creates amount owed)

**Testing Steps:**

1. Navigate to Queue Master session page:
   ```
   http://localhost:3000/queue-master/sessions/[session-id]
   ```

2. Find participant with amount owed (red "Unpaid" badge)

3. Click on the "Unpaid" badge → Opens payment modal

4. Click **"Mark as Paid"** button

5. **Expected Results:**
   - ✅ Success message appears
   - ✅ Badge changes from red "Unpaid" to green "Paid"
   - ✅ Amount owed still shows (not set to 0)
   - ✅ Page refreshes automatically

6. **Verify in Database:**
   ```sql
   SELECT
     id,
     user_id,
     payment_status,
     amount_owed,
     metadata->'cash_payment' as cash_payment_info
   FROM queue_participants
   WHERE payment_status = 'paid';
   ```

7. **Expected Database State:**
   - `payment_status` = 'paid'
   - `amount_owed` = original amount (NOT 0)
   - `metadata.cash_payment` contains timestamp, marked_paid_by, amount_paid

**Edge Cases to Test:**
- ❌ Try marking as paid when already paid (should show "already paid" message)
- ❌ Try as non-organizer (should fail authorization)
- ❌ Try with invalid participant ID (should show error)

---

### B. Test PayMongo QR Code Generation

**Setup:**
1. Same as above - have a participant with amount owed

**Testing Steps:**

1. Click on participant's payment badge → Opens modal

2. Click **"Generate Payment QR"** button

3. Select payment method:
   - Click **GCash** or **Maya**

4. Click **"Generate"** button

5. **Expected Results:**
   - ✅ Button shows "Generating..." with spinner
   - ✅ New tab opens with PayMongo checkout URL
   - ✅ Success message appears: "Payment QR code generated! Checkout page opened in new tab"
   - ✅ Checkout page shows QR code

6. **Test Payment Flow:**
   - Scan QR code with GCash/Maya app
   - Complete payment
   - Wait for webhook (15-30 seconds)
   - Refresh Queue Master page
   - Badge should turn green "Paid"

7. **Verify Payment in Database:**
   ```sql
   SELECT
     p.id as payment_id,
     p.status,
     p.amount,
     p.queue_session_id,
     qp.payment_status as participant_status
   FROM payments p
   JOIN queue_participants qp ON qp.queue_session_id = p.queue_session_id
   WHERE p.queue_session_id = '[your-session-id]'
   ORDER BY p.created_at DESC;
   ```

**Edge Cases to Test:**
- ❌ Try with amount_owed = 0 (should prevent generation)
- ❌ Close modal before generating (should cancel operation)
- ❌ Test with invalid payment method (should show error)
- ❌ Test PayMongo API failure (disconnect internet, should show error)

**Webhook Testing:**
```bash
# Check webhook logs in browser console when payment completes
# Should see:
# ✅ [webhook] Payment webhook received
# ✅ [webhook] Processing queue payment
# ✅ [webhook] Participant payment_status updated
```

---

## Feature 2: Auto-Close Sessions Testing

### A. Test Database Function Manually

**Step 1: Create Test Expired Session**

```sql
-- Run in Supabase SQL Editor
SELECT create_test_expired_session();
```

**Step 2: Verify Session Was Created**

```sql
-- Should show the test session with past end_time
SELECT * FROM expired_queue_sessions;
```

**Step 3: Run Auto-Close Function**

```sql
-- This will close all expired sessions
SELECT auto_close_expired_sessions();
```

**Step 4: Verify Session Was Closed**

```sql
-- Check session status changed to 'closed'
SELECT
  id,
  status,
  end_time,
  settings->'summary' as summary
FROM queue_sessions
WHERE settings->>'testSession' = 'true'
ORDER BY updated_at DESC
LIMIT 1;
```

**Expected Result:**
- `status` = 'closed'
- `settings.summary` contains:
  ```json
  {
    "totalGames": 0,
    "totalRevenue": 0,
    "totalParticipants": 0,
    "unpaidBalances": 0,
    "closedAt": "2025-11-27T...",
    "closedBy": "system",
    "closedReason": "automatic_expiration"
  }
  ```

**Step 5: Cleanup**

```sql
-- Remove test session
DELETE FROM queue_sessions WHERE settings->>'testSession' = 'true';
```

---

### B. Test Edge Function Locally

**Step 1: Deploy Edge Function**

```bash
# Make sure you have Supabase CLI installed
supabase functions deploy auto-close-sessions
```

**Step 2: Test Function**

```bash
# Invoke the function manually
supabase functions invoke auto-close-sessions --method POST
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Processed 1 expired session(s)",
  "sessions": [
    {
      "id": "...",
      "courtName": "Court A",
      "venueName": "Badminton Center",
      "summary": { ... }
    }
  ]
}
```

**Step 3: Check Function Logs**

```bash
supabase functions logs auto-close-sessions
```

---

### C. Test GitHub Actions Scheduler

**Step 1: Set Up Secrets**

Go to your GitHub repo → Settings → Secrets → Actions:

Add:
- `SUPABASE_URL` = Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Your service role key (from Supabase dashboard)

**Step 2: Trigger Manual Run**

1. Go to GitHub → Actions tab
2. Find "Auto-close Expired Queue Sessions" workflow
3. Click "Run workflow" → "Run workflow"

**Step 3: Monitor Execution**

Watch the workflow logs to see:
- ✅ Workflow runs successfully
- ✅ Calls Edge Function
- ✅ Reports closed sessions

**Step 4: Verify Automatic Runs**

The workflow runs every 10 minutes. Check:
```
Next run: Check "Actions" tab for next scheduled execution
```

---

### D. Test Real Session Auto-Close

**Step 1: Create Short Session**

1. Login as Queue Master
2. Navigate to `/queue-master/create`
3. Create session with:
   - Start time: Now
   - **End time: 2 minutes from now**
   - Add some participants and matches

**Step 2: Wait for Expiration**

Wait until 2 minutes pass (session end_time is in the past)

**Step 3: Trigger Auto-Close**

Run one of:
```bash
# Option A: Manual SQL
SELECT auto_close_expired_sessions();

# Option B: Edge Function
supabase functions invoke auto-close-sessions --method POST

# Option C: Wait for GitHub Actions (runs every 10 min)
```

**Step 4: Verify Session Closed**

1. Navigate to `/queue-master/sessions/[session-id]`
2. **Expected:** Status badge shows "Closed"
3. Session summary displayed with totals

---

## Feature 3: Notification System Testing

### A. Test In-App Banner Notification

**Setup:**
1. Login as Player
2. Join a queue at `/queue/[courtId]`
3. Note your position (e.g., #3)

**Testing Steps:**

1. Keep queue details page open: `/queue/[courtId]`

2. In a separate browser/incognito window:
   - Login as Queue Master
   - Navigate to session management
   - Assign top 4 players to a match
   - **Include yourself in the match**

3. Back in Player window:
   - **Expected:** Banner appears at top of page
   - Banner shows: "🎾 It's Your Turn to Play!"
   - Shows court name and venue
   - Has button: "Go to Court"
   - You hear a beep sound

4. Click **"Go to Court"** button
   - Should navigate to queue details or match page

5. Click **X (dismiss)** button
   - Banner disappears
   - Refresh page → Banner should NOT reappear (prevented by localStorage)

**Testing Position Alerts:**

1. Join queue at position #5
2. Queue Master assigns match with top 4 players
3. You should move to position #1
4. **Expected:** Banner appears: "You're next in line! Position #1"

---

### B. Test Browser Notification

**Setup:**
Same as above, but this time:
1. Open queue page
2. Allow browser notifications when prompted

**Testing Steps:**

1. Open queue page in **background tab**
2. Switch to a different tab or window
3. Have Queue Master assign you to match
4. **Expected:**
   - Desktop notification appears (even with tab in background)
   - Notification shows: "It's Your Turn!"
   - Subtitle: "Match #X at [Court Name]"
5. Click notification
   - Should focus the tab and show banner

**Permission Testing:**

1. Block notifications in browser
2. Try triggering notification
3. **Expected:** Only in-app banner appears (no browser notification)
4. No errors in console

---

### C. Test Sound Notification

**Testing Steps:**

1. Open queue page with **sound enabled** (unmute browser)
2. Join queue
3. Have Queue Master assign you to match
4. **Expected:**
   - Hear single beep sound (800Hz, 200ms)
   - Not too loud or jarring
5. Dismiss notification
6. Trigger again
7. **Expected:** Sound plays again (not throttled)

**Mute Testing:**

1. Mute browser tab
2. Trigger notification
3. **Expected:** No sound, but banner still appears

---

### D. Test Multiple Queues

**Setup:**
1. Join 2 different queues
2. Keep dashboard page open: `/queue`

**Testing Steps:**

1. Have Queue Master assign you to match in Queue A
2. **Expected:** Notification for Queue A
3. Shortly after, assign to Queue B
4. **Expected:** Notification for Queue B (new banner, doesn't replace first)

---

### E. Test Notification Persistence

**Testing Steps:**

1. Join queue
2. Get assigned to match → Banner appears
3. **Don't dismiss the banner**
4. Refresh page (F5)
5. **Expected:** Banner is gone (doesn't persist across refreshes)

**LocalStorage Testing:**

```javascript
// Open browser console
localStorage.getItem('queue-notifications')

// Should show:
// {"[sessionId]": {"timestamp": "...", "type": "turn_to_play"}}
```

---

## Integration Testing Scenarios

### Scenario 1: Complete Payment Flow

1. Player joins queue (Position #4)
2. Player gets assigned to match (Notification appears)
3. Player plays 3 games, wins 2
4. Player tries to leave queue
5. **Expected:** Blocked - "You must pay ₱150 before leaving"
6. Queue Master generates PayMongo QR
7. Player scans and pays
8. Webhook processes payment
9. Player can now leave queue

---

### Scenario 2: Session Lifecycle

1. Queue Master creates session (end_time = +2 hours)
2. Multiple players join
3. Queue Master assigns matches
4. Queue Master records scores
5. **Wait for end_time to pass** (or modify in DB)
6. Auto-close function runs
7. Session status → 'closed'
8. Summary generated with totals
9. Players can't join closed session

---

### Scenario 3: Real-Time Updates

1. Player A joins queue (Position #1)
2. Player B joins queue (Position #2)
3. **Both on queue details page**
4. Queue Master assigns Player A to match
5. **Expected:**
   - Player A sees "Your turn" notification
   - Player B sees position change from #2 → #1
   - Player B sees Player A disappear from waiting list
6. All updates happen within 1 second (real-time)

---

## Monitoring & Debugging

### Check Real-Time Subscriptions

```javascript
// Open browser console on queue page
// Look for these logs:
// 📡 [useQueue] Setting up real-time subscription
// ✅ [useQueue] Subscribed to queue channel
// 🔔 [useQueueNotifications] Status changed: waiting → playing
```

### Check Server Action Logs

```bash
# Terminal running dev server
# Should see emoji-marked logs:
# 💵 [markAsPaid] Starting...
# ✅ [markAsPaid] Payment marked as paid
# 🚨 [auto_close_expired_sessions] Found 1 expired session
```

### Database Monitoring Queries

```sql
-- View all active subscriptions
SELECT * FROM queue_participants
WHERE status = 'playing' AND left_at IS NULL;

-- View payment status distribution
SELECT payment_status, COUNT(*)
FROM queue_participants
GROUP BY payment_status;

-- View recent auto-closed sessions
SELECT id, status, settings->'summary'->>'closedBy' as closed_by
FROM queue_sessions
WHERE status = 'closed'
ORDER BY updated_at DESC
LIMIT 10;

-- Find stuck sessions (should be auto-closed but aren't)
SELECT * FROM expired_queue_sessions;
```

---

## Troubleshooting

### Notifications Not Appearing

**Check:**
1. Browser console for errors
2. localStorage has notification data
3. Real-time subscription is active (look for 📡 logs)
4. Player status actually changed in database

**Fix:**
```javascript
// Clear notification cache
localStorage.removeItem('queue-notifications')
// Reload page
```

### PayMongo QR Not Generating

**Check:**
1. Network tab → API call to `/api/paymongo/create-source`
2. Console for error messages
3. Environment variables set correctly
4. Amount owed > 0

**Debug:**
```javascript
// Check payment action response
console.log('Payment response:', response)
```

### Auto-Close Not Working

**Check:**
1. Edge Function deployed: `supabase functions list`
2. GitHub Actions secrets configured
3. Migration 007 applied to database
4. Session end_time is actually in the past

**Manual Fix:**
```sql
-- Force close stuck session
UPDATE queue_sessions
SET status = 'closed',
    settings = settings || '{"summary": {"closedBy": "manual"}}'::jsonb
WHERE id = '[session-id]';
```

---

## Performance Testing

### Load Test: 20 Players in Queue

1. Create 20 player accounts (or simulate with SQL)
2. Have all join same queue
3. Monitor page load time
4. Check real-time update latency

**Expected:**
- Page loads < 2 seconds
- Real-time updates < 1 second
- No UI lag or freezing

### Stress Test: Auto-Close 100 Sessions

```sql
-- Create 100 expired sessions
DO $$
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO queue_sessions (court_id, organizer_id, start_time, end_time, status)
    VALUES (
      (SELECT id FROM courts LIMIT 1),
      (SELECT id FROM profiles LIMIT 1),
      NOW() - INTERVAL '2 hours',
      NOW() - INTERVAL '1 hour',
      'open'
    );
  END LOOP;
END $$;

-- Run auto-close
SELECT auto_close_expired_sessions();

-- Check performance
-- Should complete in < 5 seconds
```

---

## Checklist: Pre-Production

Before deploying to production:

### Payment Features
- [ ] Mark as paid works for cash payments
- [ ] PayMongo QR generates successfully
- [ ] Webhook processes payments correctly
- [ ] Error messages are user-friendly
- [ ] Authorization checks prevent abuse

### Auto-Close Sessions
- [ ] Database migration applied
- [ ] Edge Function deployed
- [ ] Scheduler configured (GitHub Actions or Supabase Cron)
- [ ] Monitoring queries set up
- [ ] Manual close still works

### Notification System
- [ ] In-app banner appears on status change
- [ ] Sound plays (not too loud)
- [ ] Browser notifications work (when permitted)
- [ ] localStorage prevents duplicates
- [ ] Works on mobile browsers
- [ ] No console errors

### Integration
- [ ] All features work together
- [ ] Real-time updates sync correctly
- [ ] No data race conditions
- [ ] Performance acceptable with 20+ users

---

## Next Steps After Testing

Once testing is complete:

1. **Fix any bugs found** - Document and patch issues
2. **Update QUEUE_SYSTEM_STATUS.md** - Mark all features as 100%
3. **Create pull request** - Merge to main branch
4. **Deploy to production** - Apply migrations, deploy functions
5. **Monitor first week** - Watch for edge cases in production

---

**Happy Testing! 🎉**

If you encounter any issues, check the troubleshooting section or review the implementation documentation in:
- `/backend/supabase/functions/DEPLOYMENT_GUIDE.md`
- `/docs/queue-notifications.md`
- `/QUEUE_SYSTEM_STATUS.md`
