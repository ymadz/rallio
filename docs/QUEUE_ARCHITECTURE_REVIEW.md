# Queue Management System - Comprehensive Architectural Review

**Date:** 2025-11-28
**Reviewer:** System Architecture & Documentation Agent
**Version:** 1.0
**Status:** Phase 4 Queue Management (70% Complete)

---

## Executive Summary

The queue management system demonstrates **solid architectural patterns** with proper separation of concerns between regular users (players) and Queue Masters. The implementation follows established conventions and successfully integrates real-time updates, payment enforcement, and match management. However, there are **critical security gaps, race conditions, and missing validations** that must be addressed before production deployment.

**Overall Assessment:** ⚠️ **CONDITIONALLY SOUND** - Architecture is well-designed, but critical security and edge case issues require immediate attention.

---

## 1. Complete User Journey Documentation

### 1.1 Regular User (Player) Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYER QUEUE JOURNEY                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Discovery   │
│  Phase       │
└──────────────┘
    │
    ├─→ Browse Active Queues (Home Page / Queue Page)
    │   - View queue status (open/active)
    │   - Check current player count (X/12)
    │   - See estimated wait time
    │   - Filter by venue/location
    │
    ├─→ Select Court with Active Queue
    │   - Navigate to court detail page
    │   - View queue details
    │
    └─→ Decision Point: Join Queue?

┌──────────────┐
│  Join Phase  │
└──────────────┘
    │
    ├─→ Click "Join Queue" Button
    │   Server Action: joinQueue(sessionId)
    │
    ├─→ Backend Validation
    │   ✓ User authenticated
    │   ✓ Session is open/active
    │   ✓ Queue not full (current_players < max_players)
    │   ✓ User not already in queue
    │   ✗ No skill level validation (MISSING)
    │   ✗ No blacklist check (MISSING)
    │
    ├─→ Database Transaction
    │   - INSERT into queue_participants
    │   - Trigger: update_queue_participant_count() increments current_players
    │   - Status: 'waiting'
    │   - Payment status: 'unpaid'
    │
    └─→ Real-time Update Broadcast (Supabase Realtime)

┌──────────────┐
│  Wait Phase  │
└──────────────┘
    │
    ├─→ User sees their position in queue
    │   - Position calculated by joined_at timestamp
    │   - Display: "Position #3 in queue"
    │   - Estimated wait: position × 15 minutes
    │
    ├─→ Real-time Position Updates
    │   Hook: useQueue(courtId)
    │   Subscription: queue_participants table changes
    │   - Players ahead leave → position moves up
    │   - New players join → position unchanged (FIFO)
    │
    ├─→ Notification System (useQueueNotifications)
    │   - Position enters top 3: "Almost Your Turn!"
    │   - Status changes to 'playing': "It's Your Turn to Play!"
    │   - Browser notification (if permission granted)
    │   - Audio beep
    │
    └─→ User can leave queue (with payment check)

┌──────────────┐
│ Playing Phase│
└──────────────┘
    │
    ├─→ Queue Master Assigns Match
    │   - Player status changes: waiting → playing
    │   - Real-time notification sent
    │   - Match record created
    │
    ├─→ Player Plays Game
    │   - Match status: scheduled → in_progress
    │   - Timer starts
    │
    ├─→ Queue Master Records Score
    │   - Match status: in_progress → completed
    │   - Participant stats updated:
    │     * games_played += 1
    │     * games_won += 1 (if winner)
    │     * amount_owed += cost_per_game
    │     * status: playing → waiting
    │
    └─→ Player Returns to Queue (Auto)

┌──────────────┐
│ Payment Phase│
└──────────────┘
    │
    ├─→ Player Decides to Leave Queue
    │   Server Action: leaveQueue(sessionId)
    │
    ├─→ Payment Enforcement Check
    │   IF (games_played > 0 AND amount_owed > 0 AND payment_status != 'paid'):
    │       ❌ REJECT: "Payment required"
    │       Return { requiresPayment: true, amountOwed, gamesPlayed }
    │   ELSE:
    │       ✅ ALLOW: Mark as 'left', set left_at timestamp
    │
    ├─→ Payment Flow (If Required)
    │   - User redirected to payment page
    │   - Generate PayMongo QR code
    │   - User pays via GCash/Maya
    │   - Webhook confirms payment
    │   - Payment status: unpaid → paid
    │   - User can now leave queue
    │
    └─→ Exit Complete

┌──────────────┐
│  Exit Flow   │
└──────────────┘
    │
    ├─→ Voluntary Leave (After Payment)
    │   - Status: waiting → left
    │   - left_at: current timestamp
    │   - Trigger: Decrement current_players
    │
    ├─→ Removed by Queue Master
    │   - Server Action: removeParticipant()
    │   - Reason logged in metadata
    │   - Amount owed calculated
    │   - Status: → left
    │
    └─→ Session Closed
        - All participants marked as 'completed' or 'left'
        - Session summary generated
```

---

### 1.2 Queue Master Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 QUEUE MASTER JOURNEY                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Session    │
│   Creation   │
└──────────────┘
    │
    ├─→ Navigate to Queue Master Dashboard
    │   - Check user has 'queue_master' role
    │   - View past sessions
    │
    ├─→ Click "Create Queue Session"
    │   Server Action: createQueueSession(data)
    │
    ├─→ Fill Session Parameters
    │   - Select court (from available courts)
    │   - Start time / End time
    │   - Mode: casual | competitive
    │   - Game format: singles | doubles | mixed
    │   - Max players (4-20)
    │   - Cost per game (PHP)
    │   - Is public? (visible to all)
    │
    ├─→ Backend Validation
    │   ✓ User has 'queue_master' role
    │   ✓ Court exists and is active
    │   ✓ End time > Start time
    │   ✓ Cost per game >= 0
    │   ✓ Max players between 4-20
    │
    ├─→ Database Insert
    │   - INSERT into queue_sessions
    │   - Status: 'open'
    │   - organizer_id: current user
    │   - current_players: 0
    │
    └─→ Session Created (Navigate to Management Page)

┌──────────────┐
│   Participant│
│  Management  │
└──────────────┘
    │
    ├─→ Real-time Participant List
    │   Component: SessionManagementClient
    │   Subscriptions:
    │   - queue_participants table (filter: session_id)
    │   - queue_sessions table (filter: id)
    │   - matches table (filter: queue_session_id)
    │
    ├─→ View Waiting Players
    │   Display:
    │   - Position (by joined_at)
    │   - Player name, avatar, skill level
    │   - Games played, games won
    │   - Amount owed
    │   - Payment status badge (unpaid/partial/paid)
    │
    ├─→ Actions on Participants
    │   1. Remove Player
    │      - Prompt for reason
    │      - Calculate amount owed
    │      - Set status: → left
    │      - Log removal in metadata
    │
    │   2. Waive Fee
    │      - Set amount_owed: 0
    │      - Set payment_status: 'paid'
    │      - Log waiver in metadata
    │
    │   3. Mark as Paid (Cash Payment)
    │      - Set payment_status: 'paid'
    │      - Keep amount_owed for records
    │      - Log cash payment in metadata
    │
    └─→ View Playing Players
        - Players currently in active matches
        - Cannot be removed while playing

┌──────────────┐
│    Match     │
│  Assignment  │
└──────────────┘
    │
    ├─→ Click "Assign Match"
    │   Server Action: assignMatchFromQueue(sessionId, numPlayers)
    │   Disabled if: waiting_players < required_players
    │
    ├─→ Select Players (Modal)
    │   - Game format determines required players
    │   - Singles: 2 players
    │   - Doubles/Mixed: 4 players
    │   - Show skill levels for balancing
    │
    ├─→ Team Assignment Algorithm
    │   Current: Simple sequential split
    │   - Team A: First N/2 players
    │   - Team B: Next N/2 players
    │
    │   Future: Skill-based balancing
    │   - Calculate team skill averages
    │   - Minimize skill gap between teams
    │
    ├─→ Create Match Record
    │   - INSERT into matches
    │   - Status: 'scheduled'
    │   - team_a_players: [uuid, ...]
    │   - team_b_players: [uuid, ...]
    │   - match_number: auto-incremented
    │
    ├─→ Update Participant Status
    │   - UPDATE queue_participants
    │   - WHERE: id IN (assigned_player_ids)
    │   - SET: status = 'playing'
    │   ⚠️  RLS policy allows Queue Master to update
    │
    └─→ Real-time Notification
        - Players see "It's Your Turn to Play!"

┌──────────────┐
│    Match     │
│  Management  │
└──────────────┘
    │
    ├─→ Start Match
    │   Server Action: startMatch(matchId)
    │   - Status: scheduled → in_progress
    │   - started_at: current timestamp
    │   - Timer starts in UI
    │
    ├─→ Monitor Active Matches
    │   Display:
    │   - Match number
    │   - Team A vs Team B player names
    │   - Match status badge
    │   - Timer (if in_progress)
    │
    ├─→ Record Match Score (Modal)
    │   Server Action: recordMatchScore(matchId, scores)
    │
    │   Input:
    │   - Team A score
    │   - Team B score
    │   - Winner: team_a | team_b | draw
    │
    ├─→ Update Match and Participants
    │   Transaction:
    │   1. UPDATE matches
    │      - score_a, score_b, winner
    │      - Status: in_progress → completed
    │      - completed_at: current timestamp
    │
    │   2. FOR EACH player in match:
    │      UPDATE queue_participants
    │      - games_played += 1
    │      - games_won += 1 (if winner)
    │      - amount_owed += cost_per_game
    │      - Status: playing → waiting
    │
    │   3. TODO: Update player ELO ratings
    │      - Not implemented yet
    │
    └─→ Players Return to Queue (Auto)

┌──────────────┐
│   Payment    │
│  Management  │
└──────────────┘
    │
    ├─→ View Payment Status (Badge)
    │   - Unpaid: Red badge (action required)
    │   - Partial: Yellow badge (some paid)
    │   - Paid: Green badge (settled)
    │
    ├─→ Click Payment Badge (Modal)
    │   Component: PaymentManagementModal
    │
    │   Display:
    │   - Games played
    │   - Cost per game
    │   - Total owed
    │   - Current payment status
    │
    ├─→ Actions
    │   1. Mark as Paid (Cash)
    │      Server Action: markAsPaid(participantId)
    │      - Verifies Queue Master is organizer
    │      - Sets payment_status: 'paid'
    │      - Logs cash payment metadata
    │
    │   2. Waive Fee
    │      Server Action: waiveFee(participantId, reason)
    │      - Sets amount_owed: 0
    │      - Sets payment_status: 'paid'
    │      - Logs waiver reason
    │
    │   3. Generate QR Payment (Future)
    │      - Initiate PayMongo QR code
    │      - Player pays digitally
    │      - Webhook updates status
    │
    └─→ Refresh on Update

┌──────────────┐
│   Session    │
│   Control    │
└──────────────┘
    │
    ├─→ Pause Session
    │   Server Action: pauseQueueSession(sessionId)
    │   - Status: active → paused
    │   - New players cannot join
    │   - Existing matches continue
    │
    ├─→ Resume Session
    │   Server Action: resumeQueueSession(sessionId)
    │   - Status: paused → active
    │   - New players can join again
    │
    ├─→ Close Session
    │   Server Action: closeQueueSession(sessionId)
    │   - Status: → closed
    │   - Confirmation required
    │
    │   Summary Generated:
    │   - Total games played
    │   - Total revenue
    │   - Total participants
    │   - Unpaid balances count
    │
    │   Stored in: queue_sessions.settings.summary
    │
    └─→ Cancel Session
        Server Action: cancelQueueSession(sessionId, reason)
        - Only allowed if: status = draft/open AND no participants
        - Status: → cancelled
        - Reason logged in metadata
```

---

## 2. Authorization & Security Analysis

### 2.1 Row-Level Security (RLS) Policies

#### ✅ **GOOD: Matches Table**
**Migration:** `008_add_matches_rls_policies.sql`

```sql
-- SELECT Policies
"Match participants can view their matches" - ✅ SOUND
  - Players see matches they're in
  - Queue Masters see matches in their sessions

"Public matches are viewable" - ✅ SOUND
  - Public session matches visible to all

-- INSERT/UPDATE/DELETE Policies
"Queue Masters can create matches" - ✅ SOUND
"Queue Masters can update matches" - ✅ SOUND
"Queue Masters can delete matches" - ✅ SOUND
  - Only organizer can manage their session matches
```

**Security Assessment:** ✅ **WELL-DESIGNED**

---

#### ⚠️ **CRITICAL ISSUE: Queue Participants Table**

**Problem:** Only ONE UPDATE policy exists, added as a bonus fix:
```sql
"Queue Masters can update session participants" - ⚠️ INCOMPLETE
  - Allows Queue Masters to update participants
  - BUT: Missing player self-update policy
```

**Missing Policies:**
```sql
-- ❌ MISSING: Players can update their own participation
CREATE POLICY "Players can update own participation" ON queue_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Only allow updating specific fields
    old.queue_session_id = new.queue_session_id AND
    old.user_id = new.user_id AND
    old.joined_at = new.joined_at
  );

-- ❌ MISSING: Players cannot modify critical fields
-- Current policy doesn't restrict WHAT Queue Masters can update
-- They could potentially:
--   - Change user_id (assign debt to wrong player)
--   - Change queue_session_id (move player to different session)
--   - Modify joined_at (change queue position)
```

**Severity:** 🔴 **CRITICAL** - Players may not be able to leave queue themselves (depending on other policies)

---

#### ⚠️ **CRITICAL ISSUE: Queue Sessions Table**

**Missing RLS Policies:**
```sql
-- ❌ MISSING: Who can SELECT queue sessions?
-- ❌ MISSING: Who can INSERT (create) sessions?
-- ❌ MISSING: Who can UPDATE session details?
-- ❌ MISSING: Who can DELETE/CANCEL sessions?
```

**Current State:** ⚠️ If RLS is enabled without policies, **all operations may be blocked**

**Required Policies:**
```sql
-- Public sessions viewable by all
CREATE POLICY "Public sessions are viewable" ON queue_sessions
  FOR SELECT USING (is_public = true);

-- Participants can view their sessions
CREATE POLICY "Participants can view their sessions" ON queue_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM queue_participants
      WHERE queue_participants.queue_session_id = queue_sessions.id
      AND queue_participants.user_id = auth.uid()
      AND queue_participants.left_at IS NULL
    )
  );

-- Queue Masters can create sessions
CREATE POLICY "Queue Masters can create sessions" ON queue_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
      AND roles.name = 'queue_master'
    )
  );

-- Organizers can update their own sessions
CREATE POLICY "Organizers can update sessions" ON queue_sessions
  FOR UPDATE
  USING (organizer_id = auth.uid());
```

**Severity:** 🔴 **CRITICAL** - System may be non-functional if RLS is enabled

---

### 2.2 Server Action Security

#### ✅ **GOOD: Role-Based Authorization**

**Example from `createQueueSession`:**
```typescript
// Check user has queue_master role
const { data: roles } = await supabase
  .from('user_roles')
  .select(`
    role_id,
    roles!inner (
      name
    )
  `)
  .eq('user_id', user.id)

const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master')

if (!hasQueueMasterRole) {
  return { success: false, error: 'Unauthorized: Queue Master role required' }
}
```

**Security Assessment:** ✅ **EXCELLENT** - Proper role checking before privileged operations

---

#### ⚠️ **ISSUE: Organizer Verification**

**Good Pattern:**
```typescript
// Verify user is session organizer
if (session.organizer_id !== user.id) {
  return { success: false, error: 'Unauthorized: Not session organizer' }
}
```

**Problem:** ⚠️ This check happens in **server actions** but **not at RLS level**

**Risk:** If server actions are bypassed (direct database access, SQL injection, compromised service role key), organizer check is bypassed.

**Recommendation:** Add RLS policies as defense-in-depth.

---

### 2.3 Data Access Patterns

#### ✅ **GOOD: Separation of Concerns**

- **Players** can only access their own participation data
- **Queue Masters** can access all participants in their sessions
- **Match participants** can view their match details
- **Public data** (public sessions, completed matches) accessible to all

---

#### ❌ **CRITICAL ISSUE: No Rate Limiting**

**Vulnerable Operations:**
- `joinQueue()` - Could spam-join queues
- `leaveQueue()` - Could repeatedly join/leave
- `createQueueSession()` - Could create spam sessions

**Recommendation:**
```typescript
// Add rate limiting to critical operations
// Example using Redis or Supabase Edge Function
const rateLimitKey = `join-queue:${user.id}:${sessionId}`
const attempts = await redis.incr(rateLimitKey)
await redis.expire(rateLimitKey, 60) // 1 minute window

if (attempts > 3) {
  return { success: false, error: 'Too many attempts. Please wait.' }
}
```

---

## 3. State Transition Analysis

### 3.1 Queue Participant Status Flow

```
       ┌──────────┐
       │   JOIN   │
       └────┬─────┘
            │
            ↓
     ┌─────────────┐
     │   waiting   │ ←──────────────┐
     └─────┬───────┘                │
           │                        │
           │ (assigned to match)    │
           ↓                        │
     ┌─────────────┐                │
     │   playing   │                │
     └─────┬───────┘                │
           │                        │
           │ (match ends)           │
           ├────────────────────────┘
           │
           │ (leaves queue)
           ↓
     ┌─────────────┐
     │    left     │ ✅ TERMINAL
     └─────────────┘

     ┌─────────────┐
     │  completed  │ ✅ TERMINAL (unused?)
     └─────────────┘
```

**Analysis:**

✅ **GOOD:**
- Clear state progression
- Status changes tracked in real-time
- Participants return to 'waiting' after match (allows multiple games)

⚠️ **ISSUES:**
1. **'completed' status never set** - Should be set when session closes
2. **No 'kicked' status** - Removed players marked as 'left' (indistinguishable from voluntary leave)
3. **Rejoining logic** - If user left, they can reactivate same record (good), but no cooldown

**Validation Missing:**
```typescript
// ❌ No validation for invalid transitions
// Example: Can a 'playing' player be marked as 'left'?
// Current code: YES (via removeParticipant)
// Should: Force match completion first

if (participant.status === 'playing') {
  return {
    success: false,
    error: 'Cannot remove player from active match. Complete match first.'
  }
}
```

---

### 3.2 Match Status Flow

```
    ┌─────────────┐
    │   CREATE    │
    └──────┬──────┘
           │
           ↓
    ┌──────────────┐
    │  scheduled   │
    └──────┬───────┘
           │
           │ (Queue Master clicks "Start")
           ↓
    ┌──────────────┐
    │ in_progress  │
    └──────┬───────┘
           │
           │ (Queue Master records score)
           ↓
    ┌──────────────┐
    │  completed   │ ✅ TERMINAL
    └──────────────┘

    ┌──────────────┐
    │  cancelled   │ ✅ TERMINAL (unused)
    └──────────────┘
```

**Analysis:**

✅ **GOOD:**
- Linear progression (no complex branching)
- Timestamps recorded (started_at, completed_at)
- Players returned to queue on completion

⚠️ **ISSUES:**
1. **No cancellation flow** - What if match needs to be cancelled mid-game?
2. **No dispute resolution** - What if score is contested?
3. **No match timeout** - Matches can remain 'in_progress' indefinitely

**Missing Validation:**
```typescript
// ❌ Can start an already completed match?
if (match.status === 'completed') {
  return {
    success: false,
    error: 'Match already completed'
  }
}

// ❌ Can record score for a scheduled match?
if (match.status === 'scheduled') {
  return {
    success: false,
    error: 'Match has not started yet'
  }
}
```

---

### 3.3 Queue Session Status Flow

```
    ┌─────────────┐
    │   CREATE    │
    └──────┬──────┘
           │
           ↓
    ┌──────────────┐
    │    open      │ ← Users can join
    └──────┬───────┘
           │
           │ (Queue Master activates)
           ↓
    ┌──────────────┐
    │   active     │ ← Matches being played
    └──────┬───────┘
           │
           ├──→ (Pause) ──→ ┌─────────┐
           │                 │ paused  │
           │                 └────┬────┘
           │                      │
           │ ←──── (Resume) ──────┘
           │
           │ (Close)
           ↓
    ┌──────────────┐
    │   closed     │ ✅ TERMINAL
    └──────────────┘

    ┌──────────────┐
    │  cancelled   │ ✅ TERMINAL
    └──────────────┘
```

**Analysis:**

✅ **GOOD:**
- Pause/Resume functionality
- Cannot cancel with active participants
- Session summary generated on close

⚠️ **ISSUES:**
1. **No 'draft' state handling** - Sessions can be created in 'draft' but no UI to activate
2. **Automatic status progression?** - Does 'open' auto-change to 'active'? (No)
3. **End time enforcement** - No automatic closure when end_time passes

**Recommendation:**
```typescript
// Add scheduled job or Edge Function
// Runs every 5 minutes
async function autoCloseExpiredSessions() {
  const { data: expired } = await supabase
    .from('queue_sessions')
    .select('id')
    .in('status', ['open', 'active'])
    .lt('end_time', new Date().toISOString())

  for (const session of expired || []) {
    await closeQueueSession(session.id)
  }
}
```

---

### 3.4 Payment Status Flow

```
    ┌─────────────┐
    │    JOIN     │
    └──────┬──────┘
           │
           ↓
    ┌──────────────┐
    │   unpaid     │ ← Initial state
    └──────┬───────┘
           │
           │ (Plays games, owes money)
           ↓
    ┌──────────────┐
    │   unpaid     │ ← amount_owed > 0
    └──────┬───────┘
           │
           ├──→ (Partial payment) ──→ ┌─────────┐
           │                           │ partial │
           │                           └────┬────┘
           │                                │
           ├────────────────────────────────┘
           │
           │ (Full payment / Waived / Marked paid)
           ↓
    ┌──────────────┐
    │     paid     │ ✅ TERMINAL
    └──────────────┘
```

**Analysis:**

✅ **GOOD:**
- Payment enforced before leaving
- Multiple payment methods supported (digital QR, cash, waived)
- amount_owed tracked accurately

⚠️ **CRITICAL ISSUES:**
1. **'partial' status never set** - Code references it but no logic assigns it
2. **No refund flow** - If session cancelled, how to refund paid players?
3. **Race condition:** Player could leave between payment check and status update

**Race Condition Example:**
```typescript
// In leaveQueue():
// Step 1: Check payment
if (gamesPlayed > 0 && amountOwed > 0 && paymentStatus !== 'paid') {
  return { success: false, error: 'Payment required' }
}

// 🚨 RACE CONDITION WINDOW 🚨
// Another request could change participant data here

// Step 2: Mark as left
await supabase
  .from('queue_participants')
  .update({ left_at: now(), status: 'left' })
  .eq('id', participant.id)
```

**Fix:**
```typescript
// Use optimistic locking
const { data, error } = await supabase
  .from('queue_participants')
  .update({ left_at: now(), status: 'left' })
  .eq('id', participant.id)
  .eq('payment_status', 'paid') // ← Verify payment hasn't changed
  .eq('left_at', null) // ← Verify hasn't already left
  .select()

if (!data || data.length === 0) {
  return { success: false, error: 'Payment status changed or already left' }
}
```

---

## 4. Real-time Synchronization Analysis

### 4.1 Subscription Architecture

**Three Real-time Channels:**

```typescript
// 1. Per-Queue Channel (useQueue hook)
channel(`queue-${sessionId}`)
  .on('queue_participants', filter: session_id)
  .on('queue_sessions', filter: id)

// 2. My Queues Channel (useMyQueues hook)
channel('my-queues')
  .on('queue_participants') // All changes

// 3. Nearby Queues Channel (useNearbyQueues hook)
channel('nearby-queues')
  .on('queue_sessions') // All sessions
  .on('queue_participants') // All participants
```

**Analysis:**

✅ **GOOD:**
- Proper channel separation (scoped vs global)
- Cleanup on unmount
- Automatic refetch on changes

⚠️ **PERFORMANCE ISSUES:**

**Problem 1: Over-Broadcasting**
```typescript
// useMyQueues subscribes to ALL queue_participants changes
.on('queue_participants')
// This triggers refresh even for OTHER users' queues

// Better approach:
.on('queue_participants', {
  filter: `user_id=eq.${user.id}` // ← Only user's changes
})
```

**Problem 2: Thundering Herd**
```typescript
// useNearbyQueues subscribes to ALL queue sessions
.on('queue_sessions')
// 100 users on homepage = 100 subscription connections

// Better: Use cached endpoint with periodic refresh
// Or: Server-side aggregation with single broadcast
```

**Problem 3: No Debouncing**
```typescript
// Every change triggers immediate fetchQueue()
payload => {
  console.log('Change detected')
  fetchQueue() // ← Full refetch, no debounce
}

// Better:
const debouncedFetch = debounce(fetchQueue, 500)
payload => debouncedFetch()
```

---

### 4.2 Notification System

**Hook:** `useQueueNotifications`

**Triggers:**
1. **Status Change:** `waiting` → `playing` → Notify "It's Your Turn!"
2. **Position Change:** Position moves into top 3 → Notify "Almost Your Turn!"

**Delivery Channels:**
1. In-app notification (useState list)
2. Audio beep (Web Audio API)
3. Browser notification (if permission granted)

**Analysis:**

✅ **GOOD:**
- Idempotency (checks shownNotifications Set)
- LocalStorage persistence (prevents duplicate notifications)
- Expiry handling (30 minute TTL)

⚠️ **ISSUES:**

**Problem 1: No Server-side Notification Backup**
```typescript
// If user's device is offline, notification is lost
// No email/SMS fallback
// No push notification for mobile app (when built)
```

**Problem 2: Notification State Management**
```typescript
// Uses ref + localStorage
// Not synced across tabs/devices
// User could miss notification if switching devices
```

**Problem 3: Audio Beep Reliability**
```typescript
// Web Audio API requires user interaction first
// May not work on first page load
// No fallback sound file
```

**Recommendations:**
1. Add server-side notification queue (Supabase Edge Function + SendGrid/Twilio)
2. Implement FCM for mobile push notifications
3. Add Toast UI library (react-hot-toast) for better UX
4. Store notification history in database for audit trail

---

## 5. Logic Issues & Improvements

### 5.1 Participant Count Synchronization

**Fixed in Migration 009:** `fix_queue_participant_count.sql`

**Problem:** Count showed 1/12 when actually 2 players (1 waiting + 1 playing)

**Root Cause:** Trigger was decrementing on ANY status change, including `waiting` → `playing`

**Fix:**
```sql
-- Only decrement when player leaves (status→'left' OR left_at set)
IF (NEW.status = 'left' AND OLD.status != 'left')
   OR (NEW.left_at IS NOT NULL AND OLD.left_at IS NULL) THEN
  UPDATE queue_sessions
  SET current_players = GREATEST(0, current_players - 1)
```

**Verification:**
```sql
-- Recalculate counts for all active sessions
UPDATE queue_sessions
SET current_players = (
  SELECT COUNT(*)
  FROM queue_participants
  WHERE queue_participants.queue_session_id = queue_sessions.id
    AND queue_participants.left_at IS NULL
    AND queue_participants.status != 'left'
)
```

✅ **FIXED** - Trigger logic now correct

---

### 5.2 Match Assignment Algorithm

**Current Implementation:** `assignMatchFromQueue()`

```typescript
// Simple sequential split
const teamA = participants.slice(0, numPlayers / 2)
const teamB = participants.slice(numPlayers / 2)
```

**Analysis:**

⚠️ **CRITICAL WEAKNESS:** No skill-based balancing

**Example:**
```
Waiting queue (by join order):
1. Player A (skill 9) ← Team A
2. Player B (skill 8) ← Team A  → Total: 17
3. Player C (skill 3) ← Team B
4. Player D (skill 2) ← Team B  → Total: 5

Result: UNFAIR MATCH (17 vs 5)
```

**Recommendation: Implement Balanced Matching**
```typescript
function balanceTeams(participants: Participant[]): {
  teamA: Participant[]
  teamB: Participant[]
} {
  // Sort by skill level descending
  const sorted = [...participants].sort((a, b) => b.skillLevel - a.skillLevel)

  const teamA: Participant[] = []
  const teamB: Participant[] = []

  // Snake draft: Strongest→A, 2nd→B, 3rd→B, 4th→A
  for (let i = 0; i < sorted.length; i++) {
    const sumA = teamA.reduce((sum, p) => sum + p.skillLevel, 0)
    const sumB = teamB.reduce((sum, p) => sum + p.skillLevel, 0)

    // Add to team with lower total skill
    if (sumA <= sumB || teamB.length >= sorted.length / 2) {
      teamA.push(sorted[i])
    } else {
      teamB.push(sorted[i])
    }
  }

  return { teamA, teamB }
}
```

**Better Result:**
```
Balanced teams:
Team A: Player A (9) + Player D (2) = 11
Team B: Player B (8) + Player C (3) = 11
```

---

### 5.3 Payment Calculation Race Condition

**Scenario:**
1. Queue Master assigns Player X to Match 1
2. Player X's `games_played` updated to 1
3. Match completes, `amount_owed` = 100 PHP
4. **Before update commits**, Queue Master assigns Player X to Match 2
5. Second update calculates `amount_owed` = 100 PHP (not 200!)

**Problem:** No database-level constraint preventing concurrent updates

**Fix: Use Atomic Increment**
```typescript
// Instead of:
const newAmountOwed = (participant.amount_owed || 0) + costPerGame

// Use PostgreSQL increment:
const { error } = await supabase.rpc('increment_participant_debt', {
  participant_id: participant.id,
  amount: costPerGame
})

// Create function:
CREATE OR REPLACE FUNCTION increment_participant_debt(
  participant_id uuid,
  amount numeric
) RETURNS void AS $$
BEGIN
  UPDATE queue_participants
  SET
    games_played = games_played + 1,
    amount_owed = amount_owed + amount
  WHERE id = participant_id;
END;
$$ LANGUAGE plpgsql;
```

---

### 5.4 Queue Position Calculation

**Current Logic:**
```typescript
const formattedParticipants = (participants || []).map((p, index) => ({
  ...p,
  position: index + 1, // ← Simple array index
}))
```

**Analysis:**

⚠️ **ISSUE:** Position recalculated on every fetch

**Problem:** If multiple clients fetch simultaneously with participants joining/leaving, positions may be inconsistent between clients for a brief moment.

**Better Approach:**
```typescript
// Calculate position based on joined_at timestamp
const { data: earlierParticipants } = await supabase
  .from('queue_participants')
  .select('id')
  .eq('queue_session_id', sessionId)
  .is('left_at', null)
  .eq('status', 'waiting')
  .lt('joined_at', participant.joined_at)

const position = (earlierParticipants?.length || 0) + 1
```

✅ **CURRENT CODE ALREADY DOES THIS** in `getMyQueues()` - Good!

---

### 5.5 Estimated Wait Time Accuracy

**Current Formula:**
```typescript
const estimatedWaitTime = userPosition * 15 // 15 min per position
```

**Analysis:**

⚠️ **OVERSIMPLIFIED:**
- Assumes every game takes exactly 15 minutes
- Ignores game format (singles faster than doubles)
- Ignores actual match history
- Ignores current match progress

**Better Formula:**
```typescript
async function calculateEstimatedWaitTime(
  sessionId: string,
  userPosition: number
): Promise<number> {
  // Get average match duration from completed matches
  const { data: matches } = await supabase
    .from('matches')
    .select('started_at, completed_at')
    .eq('queue_session_id', sessionId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)

  // Calculate average
  const durations = matches?.map(m =>
    (new Date(m.completed_at) - new Date(m.started_at)) / 60000 // minutes
  ) || []

  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 15 // Fallback to 15 min

  // How many matches ahead?
  const gamesAhead = Math.ceil(userPosition / 4) // 4 players per match

  return Math.round(gamesAhead * avgDuration)
}
```

---

### 5.6 Missing Validations

#### **Critical Missing Checks:**

```typescript
// ❌ No maximum games per player limit
// Player could play 100 games in one session
// Recommendation: Add session.max_games_per_player

// ❌ No minimum skill level for competitive sessions
// Beginner could join expert session
if (session.mode === 'competitive' && player.skillLevel < session.settings.min_skill) {
  return { success: false, error: 'Skill level too low for competitive session' }
}

// ❌ No cooldown after leaving
// Player could spam join/leave
const { data: recentLeaves } = await supabase
  .from('queue_participants')
  .select('left_at')
  .eq('user_id', user.id)
  .eq('queue_session_id', sessionId)
  .order('left_at', { ascending: false })
  .limit(1)

if (recentLeaves?.[0] && Date.now() - new Date(recentLeaves[0].left_at).getTime() < 300000) {
  return { success: false, error: 'Please wait 5 minutes before rejoining' }
}

// ❌ No verification that players are at venue
// Use geolocation check for mobile app

// ❌ No check for banned/blocked players
const { data: isBanned } = await supabase
  .from('player_bans')
  .select('id')
  .eq('player_id', user.id)
  .eq('venue_id', session.venue_id)
  .gt('banned_until', new Date().toISOString())

if (isBanned && isBanned.length > 0) {
  return { success: false, error: 'You are banned from this venue' }
}
```

---

## 6. Identified Issues (Severity Matrix)

### 🔴 CRITICAL (Production Blockers)

| # | Issue | Impact | Location | Fix Priority |
|---|-------|--------|----------|--------------|
| 1 | **Missing RLS policies for queue_sessions** | System may be non-functional | Database | P0 - Immediate |
| 2 | **Incomplete RLS for queue_participants** | Players can't self-update | Database | P0 - Immediate |
| 3 | **No rate limiting** | Spam/abuse vulnerability | Server actions | P0 - Immediate |
| 4 | **Payment race condition** | Double-charge or missed charge | `leaveQueue()` | P0 - Immediate |
| 5 | **No skill-based matching** | Unfair games, poor UX | `assignMatchFromQueue()` | P1 - High |

---

### 🟠 MAJOR (Serious Issues)

| # | Issue | Impact | Location | Fix Priority |
|---|-------|--------|----------|--------------|
| 6 | **Over-broadcasting subscriptions** | Performance degradation at scale | `useMyQueues`, `useNearbyQueues` | P1 - High |
| 7 | **No notification backup** | Missed critical notifications | `useQueueNotifications` | P1 - High |
| 8 | **No match cancellation flow** | Cannot handle disputes | Match actions | P1 - High |
| 9 | **No session auto-closure** | Sessions linger indefinitely | Queue actions | P2 - Medium |
| 10 | **Missing state validations** | Invalid transitions possible | All actions | P2 - Medium |

---

### 🟡 MINOR (Improvements)

| # | Issue | Impact | Location | Fix Priority |
|---|-------|--------|----------|--------------|
| 11 | **Simple wait time estimate** | Inaccurate user expectations | `getQueueDetails()` | P2 - Medium |
| 12 | **No player cooldown** | Join/leave spam | `joinQueue()` | P2 - Medium |
| 13 | **'partial' payment status unused** | Incomplete feature | Payment logic | P3 - Low |
| 14 | **No refund flow** | Manual refunds required | Payment logic | P3 - Low |
| 15 | **No ELO rating updates** | Incomplete player stats | `recordMatchScore()` | P3 - Low |

---

## 7. Architectural Recommendations

### 7.1 Immediate Actions (Before Production)

**1. Apply Missing RLS Policies**

Create migration: `010_add_queue_rls_policies.sql`
```sql
-- Queue Sessions Policies
CREATE POLICY "Public sessions viewable" ON queue_sessions
  FOR SELECT USING (is_public = true);

CREATE POLICY "Participants view their sessions" ON queue_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM queue_participants
      WHERE queue_participants.queue_session_id = queue_sessions.id
      AND queue_participants.user_id = auth.uid()
      AND queue_participants.left_at IS NULL
    )
  );

CREATE POLICY "Queue Masters create sessions" ON queue_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
      AND roles.name = 'queue_master'
    )
  );

CREATE POLICY "Organizers update own sessions" ON queue_sessions
  FOR UPDATE USING (organizer_id = auth.uid());

-- Queue Participants Policies (enhance existing)
CREATE POLICY "Players update own participation" ON queue_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Cannot modify critical fields
    old.queue_session_id = new.queue_session_id AND
    old.user_id = new.user_id AND
    old.joined_at = new.joined_at
  );

-- Restrict what Queue Masters can update
DROP POLICY "Queue Masters can update session participants" ON queue_participants;

CREATE POLICY "Queue Masters update participants safely" ON queue_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE queue_sessions.id = queue_participants.queue_session_id
      AND queue_sessions.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Can only update status, games, payment fields
    old.queue_session_id = new.queue_session_id AND
    old.user_id = new.user_id AND
    old.joined_at = new.joined_at
  );
```

---

**2. Add Rate Limiting**

Install Upstash Redis or use Supabase Edge Function with Deno KV:

```typescript
// rate-limiter.ts
import { createClient } from '@supabase/supabase-js'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  // Clean expired records
  if (record && now > record.resetAt) {
    rateLimitStore.delete(key)
  }

  // Get or create record
  const current = rateLimitStore.get(key) || {
    count: 0,
    resetAt: now + windowMs
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  current.count++
  rateLimitStore.set(key, current)

  return { allowed: true, remaining: limit - current.count }
}

// Usage in server action
const rateLimitKey = `join-queue:${user.id}`
const { allowed, remaining } = await checkRateLimit(rateLimitKey, 3, 60000)

if (!allowed) {
  return { success: false, error: 'Too many join attempts. Please wait 1 minute.' }
}
```

---

**3. Fix Payment Race Condition**

Use optimistic locking in `leaveQueue()`:

```typescript
export async function leaveQueue(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'User not authenticated' }
  }

  // Get current state
  const { data: participant } = await supabase
    .from('queue_participants')
    .select('*')
    .eq('queue_session_id', sessionId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (!participant) {
    return { success: false, error: 'Not in queue' }
  }

  // Check payment requirement
  const gamesPlayed = participant.games_played || 0
  const amountOwed = parseFloat(participant.amount_owed || '0')

  if (gamesPlayed > 0 && amountOwed > 0 && participant.payment_status !== 'paid') {
    return {
      success: false,
      error: 'Payment required',
      requiresPayment: true,
      amountOwed,
      gamesPlayed,
    }
  }

  // Optimistic update with conditions
  const { data: updated, error } = await supabase
    .from('queue_participants')
    .update({
      left_at: new Date().toISOString(),
      status: 'left',
    })
    .eq('id', participant.id)
    .eq('payment_status', participant.payment_status) // ← Verify unchanged
    .eq('left_at', null) // ← Verify not already left
    .select()

  if (error || !updated || updated.length === 0) {
    return {
      success: false,
      error: 'State changed during operation. Please try again.'
    }
  }

  revalidatePath(`/queue/${courtId}`)
  return { success: true }
}
```

---

**4. Implement Skill-Based Matching**

Replace simple split in `assignMatchFromQueue()`:

```typescript
export async function assignMatchFromQueue(
  sessionId: string,
  numPlayers: number = 4,
  balanceTeams: boolean = true
) {
  // ... existing validation ...

  // Get waiting participants WITH skill levels
  const { data: participants, error: participantsError } = await supabase
    .from('queue_participants')
    .select(`
      *,
      players!inner(skill_level)
    `)
    .eq('queue_session_id', sessionId)
    .eq('status', 'waiting')
    .is('left_at', null)
    .order('joined_at', { ascending: true })
    .limit(numPlayers)

  if (participantsError || !participants || participants.length < numPlayers) {
    return {
      success: false,
      error: `Not enough waiting players. Need ${numPlayers}, found ${participants?.length || 0}`,
    }
  }

  let teamA: string[], teamB: string[]

  if (balanceTeams && session.mode === 'competitive') {
    // Skill-based balancing
    const sorted = [...participants].sort((a, b) =>
      (b.players.skill_level || 5) - (a.players.skill_level || 5)
    )

    const teamAList: typeof participants = []
    const teamBList: typeof participants = []

    for (const player of sorted) {
      const sumA = teamAList.reduce((s, p) => s + (p.players.skill_level || 5), 0)
      const sumB = teamBList.reduce((s, p) => s + (p.players.skill_level || 5), 0)

      if (sumA <= sumB || teamBList.length >= sorted.length / 2) {
        teamAList.push(player)
      } else {
        teamBList.push(player)
      }
    }

    teamA = teamAList.map(p => p.user_id)
    teamB = teamBList.map(p => p.user_id)
  } else {
    // Simple sequential split (for casual games)
    teamA = participants.slice(0, numPlayers / 2).map(p => p.user_id)
    teamB = participants.slice(numPlayers / 2).map(p => p.user_id)
  }

  // ... rest of existing match creation logic ...
}
```

---

### 7.2 Short-term Improvements (Next Sprint)

**1. Add Debounced Real-time Updates**

```typescript
// utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// useQueue.ts
const debouncedFetchQueue = useCallback(
  debounce(() => fetchQueue(), 500),
  [fetchQueue]
)

channel(`queue-${sessionId}`)
  .on('queue_participants', () => {
    console.log('Participant change detected')
    debouncedFetchQueue() // ← Debounced
  })
```

---

**2. Add Server-side Notification Queue**

Supabase Edge Function: `notify-queue-turn`

```typescript
// Edge Function triggered on queue_participants UPDATE
Deno.serve(async (req) => {
  const payload = await req.json()

  // Check if status changed to 'playing'
  if (payload.record.status === 'playing' && payload.old_record.status === 'waiting') {
    const userId = payload.record.user_id

    // Get user contact info
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, phone, display_name')
      .eq('id', userId)
      .single()

    // Send notification via multiple channels
    await Promise.all([
      sendEmail(profile.email, 'Your Turn to Play!', emailTemplate),
      sendSMS(profile.phone, 'Your turn at queue! Head to court now.'),
      storePushNotification(userId, { title: 'Your Turn!', body: '...' })
    ])
  }

  return new Response('OK')
})
```

---

**3. Add Match Cancellation Flow**

```typescript
export async function cancelMatch(
  matchId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'User not authenticated' }
  }

  // Get match
  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      queue_sessions (organizer_id, court_id)
    `)
    .eq('id', matchId)
    .single()

  if (!match) {
    return { success: false, error: 'Match not found' }
  }

  // Only organizer can cancel
  if (match.queue_sessions.organizer_id !== user.id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Cannot cancel completed matches
  if (match.status === 'completed') {
    return { success: false, error: 'Cannot cancel completed match' }
  }

  // Update match
  await supabase
    .from('matches')
    .update({
      status: 'cancelled',
      metadata: {
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason
      }
    })
    .eq('id', matchId)

  // Return players to queue
  const allPlayers = [...match.team_a_players, ...match.team_b_players]
  await supabase
    .from('queue_participants')
    .update({ status: 'waiting' })
    .eq('queue_session_id', match.queue_session_id)
    .in('user_id', allPlayers)

  revalidatePath(`/queue/${match.queue_sessions.court_id}`)
  return { success: true }
}
```

---

**4. Add Session Auto-Closure**

Create Edge Function or scheduled task:

```typescript
// Supabase Edge Function: auto-close-sessions
// Runs every 5 minutes via pg_cron or external scheduler

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find expired sessions
  const { data: expired } = await supabaseAdmin
    .from('queue_sessions')
    .select('id, organizer_id')
    .in('status', ['open', 'active'])
    .lt('end_time', new Date().toISOString())

  // Close each session
  for (const session of expired || []) {
    console.log(`Auto-closing expired session: ${session.id}`)

    // Get summary data
    const { data: participants } = await supabaseAdmin
      .from('queue_participants')
      .select('games_played, amount_owed, payment_status')
      .eq('queue_session_id', session.id)

    const summary = {
      totalGames: participants?.reduce((s, p) => s + (p.games_played || 0), 0) || 0,
      totalRevenue: participants?.reduce((s, p) => s + parseFloat(p.amount_owed || '0'), 0) || 0,
      totalParticipants: participants?.length || 0,
      unpaidBalances: participants?.filter(p =>
        p.payment_status !== 'paid' && parseFloat(p.amount_owed || '0') > 0
      ).length || 0,
      autoclosed: true
    }

    // Update session
    await supabaseAdmin
      .from('queue_sessions')
      .update({
        status: 'closed',
        settings: { closed_at: new Date().toISOString(), summary }
      })
      .eq('id', session.id)

    // Notify organizer
    // ... send email/notification ...
  }

  return new Response(JSON.stringify({ closed: expired?.length || 0 }))
})
```

---

### 7.3 Long-term Enhancements (Technical Debt Backlog)

**1. Implement ELO Rating System**

Create shared utility in `@rallio/shared`:

```typescript
// shared/src/utils/elo.ts
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): number {
  // Expected score
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))

  // Actual score
  const actualScore = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5

  // Rating change
  return Math.round(kFactor * (actualScore - expectedScore))
}

// Usage in recordMatchScore()
for (const playerId of allPlayers) {
  const won = winners.includes(playerId)
  const player = await getPlayerRating(playerId)
  const opponents = allPlayers.filter(id => id !== playerId)
  const avgOpponentRating = await getAverageRating(opponents)

  const eloChange = calculateEloChange(
    player.rating,
    avgOpponentRating,
    won ? 'win' : 'loss'
  )

  await updatePlayerRating(playerId, player.rating + eloChange)
}
```

---

**2. Add Player Ban/Blacklist System**

```sql
-- Migration: add player bans table
CREATE TABLE player_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES profiles(id),
  reason text NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_until timestamptz, -- NULL = permanent
  metadata jsonb DEFAULT '{}',
  UNIQUE(player_id, venue_id)
);

-- Check in joinQueue()
SELECT 1 FROM player_bans
WHERE player_id = $1
AND venue_id = $2
AND (banned_until IS NULL OR banned_until > now())
```

---

**3. Add Refund Flow for Cancelled Sessions**

```typescript
export async function processRefundsForCancelledSession(sessionId: string) {
  const { data: participants } = await supabase
    .from('queue_participants')
    .select('*')
    .eq('queue_session_id', sessionId)
    .eq('payment_status', 'paid')
    .gt('amount_owed', 0)

  for (const participant of participants || []) {
    // Create refund record
    await supabase.from('refunds').insert({
      participant_id: participant.id,
      amount: participant.amount_owed,
      reason: 'Session cancelled',
      status: 'pending'
    })

    // Initiate PayMongo refund (if digital payment)
    // Or flag for manual processing (if cash)
  }
}
```

---

## 8. Flow Diagrams

### 8.1 User ↔ Queue Master Interaction Flow

```
┌────────────────────────────────────────────────────────────────┐
│                   REAL-TIME BIDIRECTIONAL FLOW                  │
└────────────────────────────────────────────────────────────────┘

PLAYER                          SUPABASE                    QUEUE MASTER
  │                                │                              │
  │ 1. joinQueue()                 │                              │
  ├───────────────────────────────>│                              │
  │                                │ INSERT queue_participants    │
  │                                │ Trigger: increment count     │
  │                                │                              │
  │                                │ <──────── Real-time ─────────┤
  │                                │         Broadcast            │
  │                                │                              │ UI Updates:
  │                                │                              │ - New player in list
  │                                │                              │ - Count: 2/12
  │                                │                              │
  │ UI Updates:                    │                              │
  │ - "Joined queue"               │                              │
  │ - Position #2                  │                              │
  │                                │                              │
  │                                │                   2. Queue Master
  │                                │                   assigns match
  │                                │                              │
  │                                │ <────────────────────────────┤
  │                                │ assignMatchFromQueue()       │
  │                                │                              │
  │                                │ INSERT matches               │
  │                                │ UPDATE participants          │
  │                                │   status: waiting→playing    │
  │                                │                              │
  │ <──────── Real-time ───────────│                              │
  │         Broadcast              │ ──────── Real-time ────────>│
  │                                │         Broadcast            │
  │                                │                              │
  │ Notification:                  │                              │ UI Updates:
  │ "It's your turn!"              │                              │ - Player moved to
  │ Audio beep + Browser notif     │                              │   "Playing" section
  │                                │                              │
  │ 3. Player completes game       │                              │
  │    (offline, on court)         │                              │
  │                                │                              │
  │                                │                   4. Queue Master
  │                                │                   records score
  │                                │                              │
  │                                │ <────────────────────────────┤
  │                                │ recordMatchScore()           │
  │                                │                              │
  │                                │ UPDATE matches               │
  │                                │   status: completed          │
  │                                │   scores, winner             │
  │                                │                              │
  │                                │ UPDATE participants          │
  │                                │   games_played += 1          │
  │                                │   amount_owed += cost        │
  │                                │   status: playing→waiting    │
  │                                │                              │
  │ <──────── Real-time ───────────│                              │
  │         Broadcast              │ ──────── Real-time ────────>│
  │                                │         Broadcast            │
  │                                │                              │
  │ UI Updates:                    │                              │ UI Updates:
  │ - Back in queue (pos #5)       │                              │ - Match completed
  │ - Stats: 1 game played         │                              │ - Player stats updated
  │ - Amount owed: ₱100            │                              │ - Payment badge: unpaid
  │                                │                              │
  │ 5. Player tries to leave       │                              │
  ├───────────────────────────────>│                              │
  │ leaveQueue()                   │                              │
  │                                │                              │
  │ <──────────────────────────────┤                              │
  │ Error: "Payment required"      │                              │
  │ { requiresPayment: true,       │                              │
  │   amountOwed: 100,             │                              │
  │   gamesPlayed: 1 }             │                              │
  │                                │                              │
  │ 6. Player pays (GCash QR)      │                              │
  ├───────────────────────────────>│                              │
  │ initiateQueuePayment()         │                              │
  │                                │                              │
  │ <──────────────────────────────┤                              │
  │ Returns: PayMongo QR URL       │                              │
  │                                │                              │
  │ [Opens GCash app, pays]        │                              │
  │                                │                              │
  │                    7. PayMongo Webhook                        │
  │                                │                              │
  │                   Webhook ────>│                              │
  │                   /api/webhooks/paymongo                      │
  │                                │                              │
  │                                │ UPDATE participants          │
  │                                │   payment_status: paid       │
  │                                │                              │
  │ <──────── Real-time ───────────│                              │
  │         Broadcast              │ ──────── Real-time ────────>│
  │                                │         Broadcast            │
  │                                │                              │
  │ UI Updates:                    │                              │ UI Updates:
  │ - Payment confirmed            │                              │ - Badge: paid (green)
  │ - Can now leave                │                              │
  │                                │                              │
  │ 8. leaveQueue() (retry)        │                              │
  ├───────────────────────────────>│                              │
  │                                │                              │
  │                                │ UPDATE participants          │
  │                                │   status: left               │
  │                                │   left_at: now()             │
  │                                │ Trigger: decrement count     │
  │                                │                              │
  │ <──────────────────────────────┤                              │
  │ Success: "Left queue"          │ ──────── Real-time ────────>│
  │                                │         Broadcast            │
  │                                │                              │
  │                                │                              │ UI Updates:
  │                                │                              │ - Player removed from list
  │                                │                              │ - Count: 1/12
```

---

## 9. Overall Assessment

### ✅ Architectural Strengths

1. **Clear Separation of Concerns**
   - Server actions encapsulate business logic
   - Client components handle presentation
   - Database layer enforces data integrity

2. **Real-time Synchronization**
   - Supabase Realtime properly implemented
   - Multiple subscription channels appropriately scoped
   - Automatic UI updates on data changes

3. **Role-Based Access Control**
   - Queue Master permissions verified in server actions
   - Participant permissions checked before operations
   - RLS policies (where implemented) follow principle of least privilege

4. **Transaction Safety**
   - Database triggers maintain count consistency
   - Payment status tracked accurately
   - Match state transitions logged with timestamps

5. **Developer Experience**
   - Extensive logging for debugging
   - Clear TypeScript types throughout
   - Consistent naming conventions
   - Good code documentation

---

### ⚠️ Critical Gaps

1. **Incomplete Security Layer**
   - Missing RLS policies (queue_sessions, partial queue_participants)
   - No rate limiting on critical operations
   - No input sanitization documented
   - No protection against SQL injection in filters

2. **Race Conditions**
   - Payment enforcement in `leaveQueue()` vulnerable
   - Participant count updates not atomic
   - Match assignment not transactional

3. **Missing Business Logic**
   - No skill-based team balancing
   - No player banning/blacklist
   - No session auto-closure
   - No refund processing

4. **Performance Concerns**
   - Over-broadcasting in real-time subscriptions
   - No query result caching
   - Full refetch on every change
   - No pagination for large participant lists

5. **Production Readiness**
   - No health checks or monitoring
   - No error alerting system
   - No audit logging for sensitive operations
   - No disaster recovery plan

---

### Final Verdict

**Architecture:** ✅ **SOUND** - Well-designed, follows best practices, properly layered

**Security:** 🔴 **CRITICAL GAPS** - Must fix RLS policies and rate limiting before production

**Functionality:** 🟠 **MOSTLY COMPLETE** - Core flows work, but missing edge case handling

**Scalability:** 🟡 **MODERATE CONCERNS** - Real-time subscriptions need optimization

**Production Readiness:** 🔴 **NOT READY** - Critical issues must be resolved

---

## 10. Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)
- [ ] Apply missing RLS policies (migration 010)
- [ ] Implement rate limiting on all public actions
- [ ] Fix payment race condition with optimistic locking
- [ ] Add state transition validations

### Phase 2: Security Hardening (Week 2)
- [ ] Audit all server actions for injection vulnerabilities
- [ ] Implement request signing for sensitive operations
- [ ] Add comprehensive error logging
- [ ] Set up monitoring and alerting

### Phase 3: Functionality (Week 3)
- [ ] Implement skill-based team balancing
- [ ] Add match cancellation flow
- [ ] Create session auto-closure Edge Function
- [ ] Add server-side notification queue

### Phase 4: Performance (Week 4)
- [ ] Optimize real-time subscriptions (add filters)
- [ ] Implement debouncing for UI updates
- [ ] Add query result caching
- [ ] Paginate participant lists

### Phase 5: Production Prep (Week 5)
- [ ] Load testing and performance tuning
- [ ] Security audit by external team
- [ ] Document disaster recovery procedures
- [ ] Create runbooks for common operations

---

## Appendix: Testing Recommendations

### Edge Cases to Test

1. **Concurrent Join Attempts**
   - 13 players try to join 12-player queue simultaneously
   - Expected: 12 succeed, 1 rejected with "Queue is full"

2. **Payment During Leave**
   - Player initiates leave → payment → webhook arrives → leave completes
   - Expected: No double-charge, status updates correctly

3. **Match Assignment During Player Leave**
   - Queue Master assigns match while player is leaving
   - Expected: Assignment fails gracefully or player stays for match

4. **Session Closure with Unpaid Players**
   - Session closes with players having outstanding balances
   - Expected: Payments tracked, organizer notified

5. **Network Disconnection**
   - Player loses connection mid-game
   - Expected: Real-time syncs on reconnection, no data loss

6. **Simultaneous Match Assignments**
   - Queue Master assigns multiple matches rapidly
   - Expected: No player assigned to multiple matches

7. **Queue Master Leaves Own Session**
   - Organizer participates as player and tries to manage session
   - Expected: Can perform both roles without conflicts

---

**Review Complete:** 2025-11-28
**Next Review:** After implementing Phase 1 critical fixes
**Reviewer Contact:** System Architecture Agent
