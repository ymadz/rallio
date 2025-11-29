# Queue Integration Setup & Testing Guide

## ✅ What's Been Done

All User Side queue components have been successfully integrated:

### 1. **Package Installation**
- ✅ Installed `sonner` for toast notifications
- ✅ Installed `canvas-confetti` for celebration animations

### 2. **Root Layout Updates**
- ✅ Added `Toaster` component to `/web/src/app/layout.tsx`
- ✅ Configured with `position="top-center"`, `richColors`, and `expand` options

### 3. **New Components Created**
- ✅ Live Match Tracker (`/queue/[courtId]/match/[matchId]`)
- ✅ Payment Success Page (`/queue/payment/success`)
- ✅ Payment Failed Page (`/queue/payment/failed`)
- ✅ Match Assignment Notifications Hook (`use-match-notifications.ts`)
- ✅ Queue Position Tracker Component
- ✅ Payment Summary Widget
- ✅ Match History Viewer
- ✅ Post-Match Rating Interface

### 4. **Queue Details Integration**
- ✅ Updated `queue-details-client.tsx` with all new components
- ✅ Added match assignment notifications
- ✅ Added queue position tracker
- ✅ Added payment summary widget
- ✅ Added match history viewer
- ✅ Added post-match rating modal
- ✅ Added active match alert

### 5. **Database Migration**
- ✅ Created `011_create_player_ratings_table.sql`
- ⏳ **NEEDS TO BE APPLIED** (see steps below)

---

## 🚀 Setup Steps (Required)

### Step 1: Apply Database Migration

The `player_ratings` table migration needs to be applied to your database.

**Option A: Using Supabase CLI (Recommended)**

```bash
# Navigate to backend directory
cd /Users/madz/Documents/GitHub/rallio/backend

# Check Supabase status
supabase status

# Apply the migration
supabase db push

# Verify the migration
supabase db diff
```

**Option B: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `/backend/supabase/migrations/011_create_player_ratings_table.sql`
4. Copy the entire SQL content
5. Paste into SQL Editor
6. Click **Run**

**Option C: Using psql Directly**

```bash
# Connect to your database
psql -d postgres://[your-connection-string]

# Run the migration
\i /Users/madz/Documents/GitHub/rallio/backend/supabase/migrations/011_create_player_ratings_table.sql
```

### Step 2: Verify Migration Success

Run this query to confirm the table was created:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'player_ratings'
ORDER BY ordinal_position;
```

**Expected Output:**
```
table_name      | column_name  | data_type
player_ratings  | id           | uuid
player_ratings  | rater_id     | uuid
player_ratings  | ratee_id     | uuid
player_ratings  | match_id     | uuid
player_ratings  | rating       | integer
player_ratings  | comment      | text
player_ratings  | created_at   | timestamp with time zone
player_ratings  | updated_at   | timestamp with time zone
```

### Step 3: Verify RLS Policies

```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'player_ratings';
```

**Expected Output:** 4 policies
- `Anyone can view ratings`
- `Players can rate opponents in their matches`
- `Players can update their own ratings within 24h`
- `Players can delete their own ratings within 24h`

### Step 4: Start Development Server

```bash
# From the root directory
npm run dev:web
```

---

## 🧪 Testing Guide

### Test 1: Toast Notifications ✅

**What to test:**
- Toast notifications appear on match assignment

**How to test:**
1. Open your app in the browser
2. Join a queue as a regular player
3. In another browser/incognito window, log in as Queue Master
4. Assign a match that includes your player
5. You should see a toast notification: "You're assigned to a match!"

**Expected behavior:**
- Green success toast appears at top-center
- Shows match number and court name
- Has "View Match" action button
- Plays a notification sound
- Auto-dismisses after 10 seconds

**Troubleshooting:**
- If no toast appears, check browser console for errors
- Verify Supabase Realtime is enabled in your project
- Check that the `Toaster` component is in root layout

---

### Test 2: Live Match Tracker 🎮

**What to test:**
- Real-time match page with scoreboard and timer

**How to test:**
1. Get assigned to a match (from Test 1)
2. Click "View Match" button or navigate to `/queue/[courtId]/match/[matchId]`
3. As Queue Master, use score controls to update the score
4. As a player, verify you can see the live updates

**Expected behavior:**
- **Player View:**
  - Scoreboard displays with team rosters
  - Your name is highlighted in bold/primary color
  - Read-only (no controls)
  - Live timer if match started

- **Queue Master View:**
  - "Start Match" button visible if status is 'scheduled'
  - Score input controls (+/- buttons)
  - "End Match & Record Score" button
  - Real-time updates

**Troubleshooting:**
- If scores don't update, check Supabase Realtime subscription
- If navigation fails, verify match ID exists in database
- Check browser console for RLS policy errors

---

### Test 3: Queue Position Tracker 📊

**What to test:**
- Visual progress bar showing queue position

**How to test:**
1. Join a queue
2. Scroll down to see the Queue Position Tracker component
3. Join with multiple users and verify position updates

**Expected behavior:**
- Shows "⏳ Waiting in Queue" badge
- Displays position (e.g., "#3 of 12 players")
- Animated progress bar
- Shows estimated wait time
- Shows games played count
- Updates in real-time as players join/leave

**Troubleshooting:**
- If position doesn't update, refresh the page
- Check that `participant` data is being fetched correctly
- Verify Realtime subscription is active (check console)

---

### Test 4: Payment Summary Widget 💳

**What to test:**
- Payment calculation and GCash/Maya buttons

**How to test:**
1. Join a queue
2. Get assigned to and complete a match
3. Queue Master records the score
4. Payment Summary Widget should appear

**Expected behavior:**
- Shows games played count
- Displays cost per game
- Calculates total amount owed
- Shows "Payment Required" status badge
- **GCash** and **Maya** payment buttons enabled
- Clicking payment button initiates PayMongo flow

**Troubleshooting:**
- If widget doesn't appear, check `participant.amount_owed > 0`
- If payment fails, check PayMongo credentials in `.env.local`
- Verify `initiateQueuePaymentAction` is working

---

### Test 5: Payment Success/Failed Pages 🎉

**What to test:**
- Redirect after payment completion

**How to test:**
1. Click "Pay with GCash" in Payment Widget
2. Complete payment on PayMongo checkout page
3. Get redirected back

**Expected behavior:**

**Success Page (`/queue/payment/success`):**
- ✅ Confetti animation plays
- ✅ Green checkmark icon
- ✅ "Payment Successful!" message
- ✅ Payment receipt with details
- ✅ Transaction ID displayed
- ✅ "Return to Queue" button

**Failed Page (`/queue/payment/failed`):**
- ❌ Red X icon
- ❌ "Payment Failed" message
- ❌ Error details displayed
- ❌ Common issues list shown
- ❌ "Try Again" button
- ❌ Outstanding balance warning

**Troubleshooting:**
- If confetti doesn't play, check `canvas-confetti` is installed
- If redirect fails, verify `NEXT_PUBLIC_APP_URL` in environment
- Check PayMongo webhook handler logs

---

### Test 6: Match History Viewer 📚

**What to test:**
- View completed matches and stats

**How to test:**
1. Join a queue and play at least 2 matches
2. Click "View Match History" button
3. Verify matches are displayed

**Expected behavior:**
- Session stats card shows:
  - Total games played
  - Wins, Losses, Win rate
- Match cards show:
  - Match number
  - Final score
  - Team rosters (your name highlighted)
  - Match duration
  - Win/Loss badge
- Clicking match card navigates to match detail page
- Color-coded: Green for wins, Red for losses

**Troubleshooting:**
- If no matches appear, check that matches have status 'completed'
- If stats are wrong, verify `recordMatchScore` updates participant records
- Check database for completed matches: `SELECT * FROM matches WHERE status = 'completed'`

---

### Test 7: Post-Match Rating ⭐

**What to test:**
- Rating opponents after match completion

**How to test:**
1. Complete a match as a player
2. Rating modal should automatically appear
3. Rate opponents with stars (1-5)
4. Add optional comments
5. Submit ratings

**Expected behavior:**
- Modal appears automatically when match status = 'completed'
- Lists all opponents (excludes current user)
- 5-star rating system per opponent
- Optional comment textarea
- "Skip for Now" button to dismiss
- "Submit Ratings" button (disabled until at least one rating)
- Success message after submission
- Modal auto-closes after 2 seconds

**Troubleshooting:**
- If modal doesn't appear, check Realtime subscription on matches table
- If submission fails, verify `player_ratings` table exists
- Check RLS policy allows INSERT for match participants
- Verify unique constraint doesn't block duplicate ratings

---

### Test 8: Match Assignment Notifications 🔔

**What to test:**
- Real-time notifications for match events

**How to test:**
1. Join a queue and wait
2. Get assigned to a match by Queue Master
3. Match starts
4. Match completes

**Expected behavior:**

**On Match Assignment:**
- 🎮 Toast: "You're assigned to a match!"
- Shows match number and court
- "View Match" action button
- Notification sound plays

**On Match Start:**
- ℹ️ Toast: "Your match has started!"
- Shows match number

**On Match Completion:**
- ✅ Toast: "You won! 🎉" or "Match completed"
- Shows final score

**Troubleshooting:**
- If notifications don't appear, check `useMatchNotifications` hook is called
- Verify Supabase Realtime is enabled
- Check browser notification permissions
- Review console for subscription errors

---

## 📁 File Locations

### New Pages
- `/web/src/app/(main)/queue/[courtId]/match/[matchId]/page.tsx`
- `/web/src/app/(main)/queue/[courtId]/match/[matchId]/match-tracker-client.tsx`
- `/web/src/app/(main)/queue/payment/success/page.tsx`
- `/web/src/app/(main)/queue/payment/failed/page.tsx`

### New Components
- `/web/src/components/queue/queue-position-tracker.tsx`
- `/web/src/components/queue/payment-summary-widget.tsx`
- `/web/src/components/queue/match-history-viewer.tsx`
- `/web/src/components/queue/post-match-rating.tsx`

### New Hooks
- `/web/src/hooks/use-match-notifications.ts`

### Updated Files
- `/web/src/app/layout.tsx` (added Toaster)
- `/web/src/app/(main)/queue/[courtId]/queue-details-client.tsx` (integrated all components)

### Database Migration
- `/backend/supabase/migrations/011_create_player_ratings_table.sql`

---

## 🐛 Common Issues & Solutions

### Issue 1: Toasts Not Appearing

**Symptom:** No toast notifications appear when match is assigned

**Solution:**
1. Check root layout has Toaster:
   ```tsx
   <Toaster position="top-center" richColors expand={true} />
   ```
2. Verify `sonner` is installed:
   ```bash
   npm list sonner --workspace=web
   ```
3. Check browser console for errors

---

### Issue 2: Real-Time Updates Not Working

**Symptom:** Queue position, match scores don't update live

**Solution:**
1. Verify Supabase Realtime is enabled in project settings
2. Check Realtime subscription status in browser console
3. Look for errors in console (RLS policy blocks?)
4. Test with: `supabase.channel('test').subscribe()` in browser console

---

### Issue 3: Payment Widget Not Showing

**Symptom:** Payment widget doesn't appear after playing games

**Solution:**
1. Check `participant.amount_owed > 0` in database:
   ```sql
   SELECT * FROM queue_participants WHERE amount_owed > 0;
   ```
2. Verify `cost_per_game` is set on queue session
3. Check that `recordMatchScore` updates `amount_owed`:
   ```sql
   SELECT games_played, amount_owed FROM queue_participants WHERE user_id = '[your-user-id]';
   ```

---

### Issue 4: Match Tracker 404 Error

**Symptom:** Navigating to match page shows 404

**Solution:**
1. Verify match exists in database:
   ```sql
   SELECT * FROM matches WHERE id = '[match-id]';
   ```
2. Check file exists at correct path:
   ```bash
   ls /Users/madz/Documents/GitHub/rallio/web/src/app/(main)/queue/[courtId]/match/[matchId]/page.tsx
   ```
3. Restart dev server

---

### Issue 5: Rating Submission Fails

**Symptom:** Error when submitting ratings

**Possible Causes:**
1. `player_ratings` table doesn't exist → Apply migration 011
2. RLS policy blocks INSERT → Check policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'player_ratings';
   ```
3. Duplicate rating → Check unique constraint
4. Self-rating attempt → Check constraint prevents this

---

## 🔍 Database Queries for Debugging

### Check Queue Session Data
```sql
SELECT id, court_id, status, max_players, current_players, cost_per_game
FROM queue_sessions
WHERE court_id = '[your-court-id]'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Participant Data
```sql
SELECT qp.*, p.first_name, p.last_name
FROM queue_participants qp
JOIN profiles p ON p.id = qp.user_id
WHERE qp.queue_session_id = '[session-id]'
ORDER BY qp.joined_at;
```

### Check Match Data
```sql
SELECT *
FROM matches
WHERE queue_session_id = '[session-id]'
ORDER BY match_number;
```

### Check Player Ratings
```sql
SELECT pr.*,
       rater.first_name as rater_name,
       ratee.first_name as ratee_name
FROM player_ratings pr
JOIN profiles rater ON rater.id = pr.rater_id
JOIN profiles ratee ON ratee.id = pr.ratee_id
ORDER BY pr.created_at DESC;
```

---

## ✅ Final Checklist

Before considering integration complete, verify:

- [ ] Database migration 011 applied successfully
- [ ] `player_ratings` table exists with 4 RLS policies
- [ ] Dev server running without errors
- [ ] Toasts appear on match assignment
- [ ] Live match tracker page loads
- [ ] Queue position tracker displays correctly
- [ ] Payment widget appears when amount owed
- [ ] Payment success/failed pages work
- [ ] Match history shows completed matches
- [ ] Post-match rating modal appears
- [ ] Real-time updates working throughout

---

## 🎯 Next Steps

After confirming all features work:

1. **Test End-to-End Flow:**
   - Join queue → Get assigned → Play match → Rate opponents → Pay → Leave

2. **Test Edge Cases:**
   - Leave queue before paying
   - Get assigned while offline
   - Complete match without internet
   - Multiple simultaneous matches

3. **Performance Testing:**
   - Join queue with 20+ players
   - Complete 10+ matches in a session
   - Submit ratings for 5+ opponents

4. **Mobile Testing:**
   - Test all features on mobile browsers
   - Verify responsive layouts
   - Check toast notifications on mobile

5. **Production Preparation:**
   - Apply migration to production database
   - Set up monitoring for payment webhooks
   - Configure error tracking (Sentry)
   - Add analytics events

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check browser console for detailed error messages
2. Review Supabase logs in dashboard
3. Verify environment variables are set correctly
4. Test database queries directly in SQL Editor
5. Check real-time subscription status

**Happy Testing!** 🚀
