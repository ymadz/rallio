# Queue Manager Role - Complete Specification

**Version:** 1.0
**Last Updated:** November 26, 2025
**Status:** In Development

---

## Table of Contents

1. [Overview](#overview)
2. [Role Definition](#role-definition)
3. [How to Become a Queue Manager](#how-to-become-a-queue-manager)
4. [Complete Feature List](#complete-feature-list)
5. [Queue Management Workflows](#queue-management-workflows)
6. [Permissions & Access Control](#permissions--access-control)
7. [UI Requirements](#ui-requirements)
8. [Implementation Plan](#implementation-plan)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Design Decisions](#design-decisions)

---

## Overview

The **Queue Manager** (also called Queue Master) is a facilitator role in the Rallio badminton platform responsible for creating and managing real-time walk-in queue sessions at badminton venues. They act as session organizers who keep games running smoothly through player rotation, match assignments, and payment tracking.

### Core Concept

The queue system implements a **walk-in court rotation model** (similar to a "next up" system) where players cycle through:

```
waiting → playing → waiting → playing
```

Everyone pays based on the **number of games they actually played** (games_played × cost_per_game).

### Key Statistics

- **Role Type:** Facilitator/Organizer
- **Permissions Level:** Session-specific (can only manage own sessions)
- **Typical Use Case:** Venue staff, regular organizers, community leaders
- **Payment Model:** Per-game billing (e.g., ₱50 per game)
- **Session Duration:** Typically 2-4 hours

---

## Role Definition

### What is a Queue Manager?

A Queue Manager is responsible for:

1. **Creating queue sessions** for specific courts and time periods
2. **Monitoring participant lists** in real-time
3. **Assigning players to matches** (manual or AI-assisted)
4. **Tracking match progress** and recording scores
5. **Managing payments** (players pay per game played)
6. **Handling disputes** and edge cases (no-shows, conflicts)
7. **Closing sessions** and facilitating final payments

### Comparison with Other Roles

| Feature | Player | Queue Manager | Court Admin | Global Admin |
|---------|--------|---------------|-------------|--------------|
| **Join queues** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Create sessions** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Assign matches** | ❌ No | ✅ Yes (own sessions) | ✅ Yes (venue sessions) | ✅ Yes (all) |
| **Record scores** | ❌ No | ✅ Yes (own sessions) | ✅ Yes (venue sessions) | ✅ Yes (all) |
| **Manage venues** | ❌ No | ❌ No | ✅ Yes (own venues) | ✅ Yes (all) |
| **Handle disputes** | ❌ No | ⚠️ Limited (own sessions) | ⚠️ Limited (venue) | ✅ Yes (all) |
| **Platform config** | ❌ No | ❌ No | ❌ No | ✅ Yes |

### Responsibilities Summary

**Primary Duties:**
- Create and configure queue sessions
- Monitor participant flow
- Ensure fair player rotation
- Facilitate smooth gameplay
- Track and collect payments
- Resolve minor disputes

**Secondary Duties:**
- Provide excellent customer service
- Maintain session quality
- Report technical issues
- Suggest venue improvements
- Build community engagement

---

## How to Become a Queue Manager

### Phase 1: Manual Assignment (Current)

**Who Can Assign:**
- Global Admins
- Court Admins (for their venues - future)

**Process:**
```sql
-- Database assignment
INSERT INTO user_roles (user_id, role_id, assigned_by)
VALUES (
  'user-uuid-here',
  (SELECT id FROM roles WHERE name = 'queue_master'),
  'admin-user-id'
);
```

### Phase 2: Application Flow (Future)

**Workflow:**
1. Player clicks "Apply to be Queue Manager"
2. Fills out application form:
   - Experience level with badminton
   - Preferred venues
   - Availability schedule
   - Why they want to be Queue Manager
3. Application submitted to venue owner or Global Admin
4. Admin reviews application and player history
5. Optional: Conduct interview or trial session
6. Approve or reject with feedback
7. Upon approval, role granted

### Prerequisites & Requirements

**Minimum Requirements:**
- ✅ Active player account
- ✅ Profile completed (name, skill level, etc.)
- ✅ Played at least 10-20 games
- ✅ Good reputation score (4.0+ stars recommended)
- ✅ No recent disputes or violations

**Recommended Qualifications:**
- Badminton coaching or organizing experience
- Regular player at specific venue
- Recommendation from venue owner
- Strong communication skills
- Conflict resolution abilities

### Venue Restrictions

**Global Queue Manager:**
- Can create sessions at ANY venue
- Granted by Global Admin only
- Used for platform staff or super users

**Venue-Specific Queue Manager (Future):**
- Can only create sessions at assigned venues
- Typical for venue staff or regular organizers
- Stored in `user_roles.metadata`:
  ```json
  {
    "venue_restrictions": ["venue-uuid-1", "venue-uuid-2"]
  }
  ```

---

## Complete Feature List

### Session Management Features

#### A. Queue Session Creation

**What:** Create new queue sessions for walk-in players

**Parameters:**
- **Court Selection:** Choose venue and specific court
- **Schedule:**
  - Start time (default: now)
  - End time (default: +3 hours)
- **Game Format:**
  - `singles` - 2 players per match
  - `doubles` - 4 players per match
  - `mixed` - Alternating singles/doubles
- **Session Mode:**
  - `casual` - Just for fun, no ranking impact
  - `competitive` - Affects ELO ratings
- **Capacity:** Max players (typically 8-16)
- **Pricing:** Cost per game (e.g., ₱50 PHP)
- **Visibility:**
  - `public` - Anyone can join
  - `private` - Invite-only (future feature)

**Database Schema:**
```typescript
interface CreateQueueSessionParams {
  courtId: string
  startTime: Date
  endTime: Date
  mode: 'casual' | 'competitive'
  gameFormat: 'singles' | 'doubles' | 'mixed'
  maxPlayers: number
  costPerGame: number
  isPublic: boolean
}
```

#### B. Monitor Active Sessions

**Real-Time Dashboard Shows:**
- Current participants list with:
  - Name, avatar, skill level
  - Join time and position in queue
  - Games played and games won
  - Amount owed and payment status
- Live participant count vs max capacity
- Session timeline (start/end times with countdown)
- Active matches in progress
- Total revenue collected

#### C. Session Control Actions

**Available Actions:**
- **Activate Session:** `draft` → `open` → `active`
- **Pause Session:** Temporarily halt new match assignments
- **Resume Session:** Continue after pause
- **Close Session:** Prevent new joiners, wrap up payments
- **Cancel Session:** Abort session (refund participants)

### Match Management Features

#### D. Player Assignment to Matches

**Manual Assignment (Phase 1):**
1. View waiting players sorted by join time
2. Select N players (2 for singles, 4 for doubles)
3. System suggests team balance based on skill/rating
4. Queue Master can accept or manually adjust teams
5. Confirm assignment
6. Players notified: "You're up! Head to Court 2"

**Server Action:**
```typescript
assignMatchFromQueue(sessionId: string, numPlayers: number)
```

**Team Balancing Logic:**
```typescript
Team A Total Rating = player1.rating + player2.rating
Team B Total Rating = player3.rating + player4.rating
Difference = |Team A - Team B|

Goal: Difference < 100 for fair match
```

**AI-Assisted Matching (Phase 2 - Future):**
- Algorithm suggests optimal player combinations
- Considers:
  - Skill balance (minimize rating difference)
  - Wait time fairness (prioritize longest waiters)
  - Play style compatibility
  - Historical data (avoid poor pairings)
- Queue Master can accept or override suggestions

#### E. Match Status Tracking

**Match Lifecycle:**

1. **Scheduled** - Match created, players assigned
   ```typescript
   assignMatchFromQueue(sessionId, 4)
   ```

2. **In Progress** - Game started
   ```typescript
   startMatch(matchId)
   // Records started_at timestamp
   ```

3. **Completed** - Score recorded
   ```typescript
   recordMatchScore(matchId, {
     teamAScore: 21,
     teamBScore: 19,
     winner: 'team_a'
   })
   // Auto-updates: games_played, games_won, amount_owed
   // Returns players to 'waiting' status
   ```

#### F. Player Rotation Management

**Rotation Logic:**
- Players automatically return to queue after match ends
- Position determined by: `joined_at` + `games_played`
- Fair rotation ensures everyone gets equal playing time
- System prevents overlapping match assignments

**Manual Overrides (Future):**
- Temporarily skip a player (break)
- Adjust queue order manually
- Force specific matchups

### Player Management Features

#### G. Remove Players from Session

**Reasons:**
- No-show (missed multiple turns)
- Disruptive behavior
- Rule violations
- Player request

**Actions:**
1. Click [Remove] button on participant
2. Confirm removal reason
3. System calculates amount owed for games played
4. Generate payment request if needed
5. Update `current_players` count
6. Notify player of removal

#### H. Handle No-Shows

**Detection:**
- Player's turn arrives but not present
- Queue Master marks as "inactive"

**Actions:**
1. Skip player for this rotation
2. Assign next waiting player instead
3. Send notification: "You missed your turn. Rejoin?"
4. Track `missed_turns` counter
5. Auto-remove after 2 missed turns

**Database Field:**
```sql
ALTER TABLE queue_participants ADD COLUMN missed_turns INT DEFAULT 0;
```

#### I. Approve/Reject Join Requests (Future)

**For Competitive/Private Sessions:**
- Review pending join requests
- View player profile (skill, rating, history)
- Approve or reject with reason
- Auto-approve for casual public sessions

### Payment Management Features

#### J. Track Payment Status

**Per-Player Breakdown:**
```
Player: John Doe
Games Played: 3
Cost Per Game: ₱50
Total Owed: ₱150
Payment Status: Unpaid
```

**Session-Wide Summary:**
- Total games played
- Total revenue collected
- Outstanding balances
- Payment completion rate

#### K. Generate Payment Links

**Workflow:**
1. Calculate amount owed: `games_played × cost_per_game`
2. Server action: `calculateQueuePayment(sessionId, playerId)`
3. Generate PayMongo QR code/checkout URL
4. Send payment link to participant
5. Track payment via webhook
6. Update `payment_status` to `paid`

**PayMongo Integration:**
```typescript
const paymentResult = await createPayment({
  source: { id: sourceId, type: 'source' },
  amount: amountOwed * 100, // Convert to centavos
  currency: 'PHP',
  description: `Queue Session - ${gamesPlayed} games`
})
```

#### L. Enforce Payment Rules

**Rule:** Players who owe money cannot leave until paid

**Implementation:**
```typescript
async function leaveQueue(sessionId: string) {
  const participant = await getParticipant(sessionId, userId)

  if (participant.amount_owed > 0) {
    return {
      success: false,
      requiresPayment: true,
      amountOwed: participant.amount_owed,
      gamesPlayed: participant.games_played
    }
  }

  // Allow leave
  await markParticipantAsLeft(participant.id)
  return { success: true }
}
```

#### M. Waive Fees

**Use Cases:**
- VIP guests
- Charity events
- Venue staff
- Promotional periods
- Dispute resolutions

**Action:**
```typescript
waiveFee(participantId: string, reason: string)
// Marks amount_owed as 0
// Logs action in audit trail
```

### Reporting & Analytics Features

#### N. Session Summary Report

**Generated After Session Closes:**

```
Session #1234 - Court 2A, Fewddicts
Date: November 26, 2025
Duration: 2:30 PM - 5:30 PM (3 hours)

Participants: 12 players
Total Games Played: 18 games
Total Revenue: ₱900 PHP

Top Performers:
1. John Doe - 5 games, 4 wins
2. Maria Garcia - 5 games, 3 wins

Average Wait Time: 12 minutes
Court Utilization: 95%
Player Satisfaction: 4.7/5.0
```

**Export Options:**
- PDF download
- CSV export
- Email to venue owner
- Share link

#### O. Queue Master Analytics Dashboard

**Metrics:**
- Total sessions created (lifetime)
- Total revenue facilitated
- Average players per session
- Average games per session
- Player satisfaction ratings
- Most popular time slots

**Charts:**
- Sessions over time (line chart)
- Revenue trends (bar chart)
- Court utilization rates (pie chart)
- Peak hours heatmap

---

## Queue Management Workflows

### Workflow 1: Creating a Queue Session

**Step-by-Step Process:**

1. **Navigate to Creation Page**
   - From dashboard: Click [+ Create New Session]
   - From venue page: Click [Start Queue] on specific court

2. **Select Court**
   ```typescript
   // System checks:
   - Is court active?
   - Any existing reservations?
   - Queue Master has permission for this venue?
   ```

3. **Set Session Parameters**

   **Date & Time:**
   - Start time (default: now)
   - End time (default: +3 hours)
   - Validation: `endTime > startTime`, not in past

   **Game Format:**
   - ○ Singles (2 players)
   - ○ Doubles (4 players)  ← Default
   - ○ Mixed (alternating)

   **Session Mode:**
   - ○ Casual (just for fun)
   - ○ Competitive (affects rankings)

   **Capacity:**
   - Slider: [4 --- 12 --- 20] players
   - Suggested: 12-16 for doubles

   **Pricing:**
   - Input: ₱[50] per game
   - Preview: "3 games = ₱150"

   **Visibility:**
   - ☑ Public session (anyone can join)

4. **Review & Create**
   ```
   Preview:
   Court 2A at Fewddicts
   Nov 26, 2:00 PM - 5:00 PM
   Doubles • Casual • ₱50/game
   Max 12 players

   [Cancel] [Create Session]
   ```

5. **Session Created**
   - Redirect to `/queue-master/sessions/[id]`
   - Session now visible in queue listings
   - Real-time subscriptions activated
   - Players can start joining

**Backend Flow:**
```typescript
// Server Action
async function createQueueSession(data: CreateQueueSessionParams) {
  // 1. Verify user has queue_master role
  const hasRole = await checkUserRole(userId, 'queue_master')
  if (!hasRole) return { error: 'Unauthorized' }

  // 2. Validate court availability
  const conflicts = await checkCourtConflicts(data.courtId, data.startTime, data.endTime)
  if (conflicts.length > 0) return { error: 'Court unavailable' }

  // 3. Create session
  const session = await supabase
    .from('queue_sessions')
    .insert({
      court_id: data.courtId,
      organizer_id: userId,
      start_time: data.startTime,
      end_time: data.endTime,
      mode: data.mode,
      game_format: data.gameFormat,
      max_players: data.maxPlayers,
      cost_per_game: data.costPerGame,
      is_public: data.isPublic,
      status: 'open'
    })
    .select()
    .single()

  // 4. Revalidate paths
  revalidatePath('/queue')
  revalidatePath('/queue-master')

  return { success: true, session }
}
```

---

### Workflow 2: Managing an Active Session

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ Session #1234 - Court 2A         [Pause] [Close]        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Session Info Card]                                      │
│ Status: Active • Mode: Doubles • Cost: ₱50/game         │
│ Players: 8/12 • Games Played: 5 • Revenue: ₱2,000       │
│ Started: 2:30 PM • Ends: 5:30 PM (1h 15m remaining)     │
│                                                          │
├──────────────────────────────┬──────────────────────────┤
│ Participants (8)             │ Active Matches (1)       │
├──────────────────────────────┼──────────────────────────┤
│ [+ Assign New Match]         │ Match #5 - In Progress   │
│                              │ Team A: John & Maria     │
│ WAITING (6)                  │ Team B: Alex & Sarah     │
│                              │                          │
│ 1. □ John Doe                │ Started: 3:45 PM         │
│    5 played, 3 won           │ [Record Score]           │
│    Adv • ₱150 owed           │                          │
│    [Remove]                  │ Match History (4)        │
│                              │ #4: Team C won 21-18     │
│ 2. □ Maria Garcia            │ #3: Team D won 21-15     │
│    4 played, 2 won           │ [View All]               │
│    Int • ₱200 owed           │                          │
│    [Remove]                  │                          │
│                              │                          │
│ ... (4 more players)         │                          │
│                              │                          │
│ PLAYING (2)                  │                          │
│ □ Alex Smith - Match #5      │                          │
│ □ Sarah Lee - Match #5       │                          │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

**Real-Time Updates:**

Supabase subscriptions on:
- `queue_participants` table (joins, leaves, stat changes)
- `queue_sessions` table (status updates)
- `matches` table (score updates)

**Key Actions:**

1. **Monitor Joins**
   - Notification when new player joins
   - Auto-update participant count
   - Check if session full

2. **Assign Next Match**
   - Click [+ Assign New Match]
   - System highlights top 4 waiting players:
     ```
     Suggested Match #6 (Doubles):
     Team A: John (1580) + Maria (1420) = 3000
     Team B: Alex (1540) + Sarah (1460) = 3000
     ✓ Balanced | ✓ Both waited 2+ games

     [Accept] [Adjust Teams]
     ```
   - Confirm → Players notified → Status changes to `playing`

3. **Record Score**
   - After match ends, click [Record Score]
   - Enter Team A score and Team B score
   - Select winner
   - Save → Stats auto-update → Players return to waiting

4. **Handle Removals**
   - Click [Remove] on disruptive player
   - Confirm reason
   - System calculates owed amount
   - Generate payment request

---

### Workflow 3: Assigning Players to Matches

**Current Implementation (Manual):**

1. **View Waiting Players**
   ```
   WAITING (6 players):

   □ 1. John Doe        | Int | 5 played | Waited: 12 min
   □ 2. Maria Garcia    | Adv | 4 played | Waited: 15 min
   □ 3. Alex Smith      | Int | 3 played | Waited: 10 min
   □ 4. Sarah Lee       | Beg | 4 played | Waited: 18 min
   □ 5. Mike Chen       | Adv | 5 played | Waited: 8 min
   □ 6. Anna Wong       | Int | 3 played | Waited: 20 min

   [Select 4] [Assign to Match]
   ```

2. **Select Players**
   - Click checkboxes for top 4 players
   - OR manually select any 4 players

3. **Balance Teams**
   ```
   Auto-Suggested Teams:

   Team A:                Team B:
   John (1580)            Alex (1540)
   Maria (1420)           Sarah (1460)
   ─────────              ─────────
   Total: 3000            Total: 3000

   Balance: Perfect ✓

   [Accept] [Adjust Teams] [Cancel]
   ```

4. **Confirm Assignment**
   - Click [Accept]
   - Backend creates match record
   - Players status → `playing`
   - Notifications sent

**Server Action Flow:**
```typescript
const result = await assignMatchFromQueue(sessionId, 4)

// Backend logic:
1. Verify user is session organizer
2. Get top 4 waiting participants (status = 'waiting', sorted by joined_at)
3. Check enough players available
4. Calculate match number
5. Split players: [0-1] = Team A, [2-3] = Team B
6. Create match in database
7. Update participant statuses
8. Send notifications
9. Return match details
```

---

### Workflow 4: Recording Match Results

**Step-by-Step:**

1. **Match Completion**
   - Players finish game (e.g., 21-19)
   - Return to Queue Master
   - Report score

2. **Open Score Entry Modal**
   ```
   ┌─────────────────────────────────────┐
   │ Record Match Score                  │
   ├─────────────────────────────────────┤
   │ Match #5 - Court 2A                 │
   │ Duration: 18 minutes                │
   │                                     │
   │ Team A            VS    Team B      │
   │ John Doe                Alex Smith  │
   │ Maria Garcia            Sarah Lee   │
   │                                     │
   │ Score: [21]             Score: [19] │
   │                                     │
   │ Winner:                             │
   │ ○ Team A  ○ Team B  ○ Draw          │
   │                                     │
   │ [Cancel] [Save Score]               │
   └─────────────────────────────────────┘
   ```

3. **Validate Input**
   - Frontend: Scores are numbers, winner matches higher score
   - Backend: User is organizer, match exists and is `in_progress`

4. **Save Score**
   ```typescript
   recordMatchScore(matchId, {
     teamAScore: 21,
     teamBScore: 19,
     winner: 'team_a'
   })
   ```

5. **Auto-Update Stats**
   ```sql
   -- Update match record
   UPDATE matches
   SET score_a = 21, score_b = 19, winner = 'team_a',
       status = 'completed', completed_at = NOW()
   WHERE id = matchId;

   -- Update all 4 participants
   UPDATE queue_participants
   SET
     games_played = games_played + 1,
     games_won = CASE
       WHEN user_id IN (teamA_players) THEN games_won + 1
       ELSE games_won
     END,
     status = 'waiting',
     amount_owed = (games_played + 1) * cost_per_game
   WHERE id IN (participant_ids);
   ```

6. **Post-Match**
   - Players notified: "Match complete! Back in queue."
   - Stats reflected immediately
   - Match appears in history

---

### Workflow 5: Handling Edge Cases

#### Case 1: No-Show Player

**Scenario:** Player's turn comes but they're absent

**Steps:**
1. Queue Master clicks [Mark No-Show] on player
2. System increments `missed_turns` counter
3. Player skipped → Next player assigned instead
4. Send notification: "You missed your turn"
5. If `missed_turns >= 2`:
   - Auto-remove from session
   - Calculate amount owed
   - Generate payment request

#### Case 2: Disputed Score

**Scenario:** Player claims score recorded incorrectly

**Steps:**
1. Player reports dispute (via app or verbally)
2. Queue Master receives notification
3. Opens dispute resolution UI:
   ```
   Dispute: Match #5

   Reported Score: Team A 21 - Team B 19 (Team A won)

   Player Claims:
   - John (Team A): Score correct ✓
   - Alex (Team B): Score was 19-21, Team B won ✗

   Evidence: [View Photos] [Ask Witnesses]

   Decision:
   ○ Confirm original score
   ○ Correct to: Team A [__] - Team B [__]
   ○ Void game (refund)

   Reason: [____________]

   [Cancel] [Save Decision]
   ```
4. Queue Master investigates
5. Makes decision and logs reason
6. System updates records if corrected
7. Notify all involved players

#### Case 3: Early Session Closure

**Scenario:** Need to close session before scheduled end time

**Steps:**
1. Queue Master clicks [Close Session Early]
2. Modal confirms: "8 players still waiting. Continue?"
3. Select reason: [Emergency | Low Turnout | Facility Issue | Other]
4. System actions:
   - Mark status = `closed`
   - Calculate all `amount_owed`
   - Generate payment summary
   - Notify all participants
   - Optional: Offer refunds for waiting players
5. Process payments and close

#### Case 4: Payment Failure

**Scenario:** Player's PayMongo payment fails

**Steps:**
1. Webhook receives `payment.failed` event
2. System updates `payment_status` to `failed`
3. Queue Master notified: "Alex's payment failed"
4. Options:
   - Retry payment (new QR code)
   - Accept cash (mark as paid)
   - Waive fee (forgive amount)
   - Ban player (prevent future joins)
5. Track outstanding balance

---

## Permissions & Access Control

### What Queue Masters Can See

#### Full Access:
- ✅ Own sessions (complete details)
  - All participants (names, stats, payment status)
  - All matches (scores, timestamps)
  - Revenue and analytics
- ✅ Own profile and stats
- ✅ Public queue sessions (view only, cannot manage)
- ✅ Court listings (all active venues)
- ✅ Player public profiles (names, skill levels, ratings)

#### Limited/No Access:
- ❌ Other Queue Masters' sessions (view only, no edit)
- ❌ Private user data (email, phone, addresses)
- ❌ Payment details (credit card info)
- ❌ Venue management settings
- ❌ Platform configurations
- ❌ User role assignment

### What Queue Masters Can Do

#### Allowed Actions (Own Sessions Only):
- ✅ Create new queue sessions
- ✅ Edit session details (before active)
- ✅ Pause/resume session
- ✅ Close session
- ✅ Cancel session (before players join)
- ✅ Assign players to matches
- ✅ Record match scores
- ✅ Generate payment links
- ✅ Waive fees for specific players
- ✅ Remove players from session
- ✅ Handle disputes within session
- ✅ Export session reports

#### Cannot Do:
- ❌ Edit other Queue Masters' sessions
- ❌ Manage venue pricing or schedules
- ❌ Approve/reject court reservations
- ❌ Access global user database
- ❌ Assign roles to users
- ❌ Modify platform settings
- ❌ Process refunds (requires admin)
- ❌ Ban users permanently (requires admin)

### Authorization Checks

**Server-Side Validation:**
```typescript
// Check if user has queue_master role
async function checkQueueMasterRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('role_id', (await getRoleId('queue_master')))
    .single()

  return !!data
}

// Check if user is session organizer
async function checkSessionOrganizer(userId: string, sessionId: string): Promise<boolean> {
  const { data } = await supabase
    .from('queue_sessions')
    .select('organizer_id')
    .eq('id', sessionId)
    .single()

  return data?.organizer_id === userId
}

// Combined authorization
async function canManageSession(userId: string, sessionId: string): Promise<boolean> {
  const isQueueMaster = await checkQueueMasterRole(userId)
  const isOrganizer = await checkSessionOrganizer(userId, sessionId)
  return isQueueMaster && isOrganizer
}
```

### RLS Policies Required

**`queue_sessions` Table:**
```sql
-- Queue Masters can create sessions
CREATE POLICY "queue_masters_can_create_sessions" ON queue_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role_id = (SELECT id FROM roles WHERE name = 'queue_master')
    )
    AND auth.uid() = organizer_id
  );

-- Organizers can update their own sessions
CREATE POLICY "organizers_can_update_own_sessions" ON queue_sessions
  FOR UPDATE USING (auth.uid() = organizer_id);

-- Organizers can delete draft sessions
CREATE POLICY "organizers_can_delete_draft_sessions" ON queue_sessions
  FOR DELETE USING (
    auth.uid() = organizer_id
    AND status = 'draft'
  );

-- Everyone can view public sessions
CREATE POLICY "public_can_view_public_sessions" ON queue_sessions
  FOR SELECT USING (is_public = true OR auth.uid() = organizer_id);
```

**`matches` Table:**
```sql
-- Organizers can create matches for their sessions
CREATE POLICY "organizers_can_create_matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE id = queue_session_id
      AND organizer_id = auth.uid()
    )
  );

-- Organizers can update matches in their sessions
CREATE POLICY "organizers_can_update_matches" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE id = queue_session_id
      AND organizer_id = auth.uid()
    )
  );
```

**`queue_participants` Table:**
```sql
-- Organizers can view all participants in their sessions
CREATE POLICY "organizers_can_view_session_participants" ON queue_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE id = queue_session_id
      AND organizer_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- Organizers can update participants in their sessions
CREATE POLICY "organizers_can_update_participants" ON queue_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM queue_sessions
      WHERE id = queue_session_id
      AND organizer_id = auth.uid()
    )
  );
```

---

## UI Requirements

### Page Structure

```
/queue-master/                    Queue Master Dashboard
/queue-master/create              Create New Session Form
/queue-master/sessions/[id]       Manage Active Session
/queue-master/sessions/[id]/edit  Edit Session Details
/queue-master/analytics           Analytics Dashboard
/queue-master/history             Past Sessions List
```

### 1. Queue Master Dashboard

**Route:** `/queue-master`

**Components:**
- Session list with filters (active/upcoming/past)
- Quick stats cards
- [+ Create New Session] button
- Recent activity feed

**Layout:**
```tsx
<DashboardLayout>
  <Header>
    <Title>Queue Master Dashboard</Title>
    <CreateSessionButton />
  </Header>

  <StatsGrid>
    <StatCard title="Total Sessions" value={totalSessions} />
    <StatCard title="Total Revenue" value={`₱${totalRevenue}`} />
    <StatCard title="Avg Rating" value={avgRating} />
  </StatsGrid>

  <SessionsList>
    <TabGroup>
      <Tab>Active (2)</Tab>
      <Tab>Upcoming (1)</Tab>
      <Tab>Past (15)</Tab>
    </TabGroup>

    <SessionCard session={session} onClick={navigateToSession} />
    ...
  </SessionsList>
</DashboardLayout>
```

### 2. Session Creation Form

**Route:** `/queue-master/create`

**Form Fields:**
```tsx
<Form onSubmit={createSession}>
  <FormSection title="Court Selection">
    <VenueSelect venues={venues} />
    <CourtSelect courts={courts} />
  </FormSection>

  <FormSection title="Schedule">
    <DatePicker label="Date" min={today} />
    <TimePicker label="Start Time" />
    <TimePicker label="End Time" />
  </FormSection>

  <FormSection title="Game Settings">
    <RadioGroup label="Mode">
      <Radio value="casual">Casual</Radio>
      <Radio value="competitive">Competitive</Radio>
    </RadioGroup>

    <RadioGroup label="Format">
      <Radio value="singles">Singles (2 players)</Radio>
      <Radio value="doubles">Doubles (4 players)</Radio>
    </RadioGroup>

    <Slider
      label="Max Players"
      min={4} max={20} step={2}
      defaultValue={12}
    />
  </FormSection>

  <FormSection title="Pricing">
    <NumberInput
      label="Cost Per Game"
      suffix="PHP"
      placeholder="50"
    />
  </FormSection>

  <FormSection title="Visibility">
    <Switch
      label="Public Session"
      defaultChecked={true}
    />
  </FormSection>

  <FormActions>
    <Button variant="secondary">Save Draft</Button>
    <Button variant="primary">Create & Publish</Button>
  </FormActions>
</Form>
```

### 3. Session Management View

**Route:** `/queue-master/sessions/[id]`

**Key Sections:**
1. Session header with status and controls
2. Participants list (waiting + playing)
3. Active matches panel
4. Match history
5. Payment tracking

**Components:**
```tsx
<SessionManagementLayout>
  <SessionHeader session={session}>
    <StatusBadge status={session.status} />
    <ActionButtons>
      <Button onClick={pauseSession}>Pause</Button>
      <Button onClick={closeSession}>Close</Button>
    </ActionButtons>
  </SessionHeader>

  <TwoColumnLayout>
    <LeftColumn>
      <ParticipantsList participants={participants}>
        <AssignMatchButton
          onClick={openMatchAssignment}
          disabled={waitingPlayers.length < requiredPlayers}
        />

        <ParticipantRow participant={p}>
          <Position>{p.position}</Position>
          <Avatar src={p.avatarUrl} />
          <Name>{p.name}</Name>
          <Stats>
            {p.gamesPlayed} played, {p.gamesWon} won
          </Stats>
          <AmountOwed>₱{p.amountOwed}</AmountOwed>
          <Actions>
            <IconButton icon="trash" onClick={removePlayer} />
          </Actions>
        </ParticipantRow>
      </ParticipantsList>
    </LeftColumn>

    <RightColumn>
      <ActiveMatchesPanel matches={activeMatches}>
        <MatchCard match={match}>
          <Teams>
            <Team side="A">{match.teamA}</Team>
            <Team side="B">{match.teamB}</Team>
          </Teams>
          <Duration>{match.duration}</Duration>
          <Button onClick={recordScore}>Record Score</Button>
        </MatchCard>
      </ActiveMatchesPanel>

      <MatchHistory matches={completedMatches} />
    </RightColumn>
  </TwoColumnLayout>
</SessionManagementLayout>
```

### 4. Score Recording Modal

**Component:** `<RecordScoreModal />`

```tsx
<Modal open={isOpen} onClose={onClose}>
  <ModalHeader>
    <Title>Record Match Score</Title>
    <MatchInfo>
      Match #{match.number} - {match.courtName}
    </MatchInfo>
  </ModalHeader>

  <ModalBody>
    <TeamsDisplay>
      <TeamColumn side="A">
        <TeamLabel>Team A</TeamLabel>
        <PlayerList>
          {teamA.map(player => (
            <Player key={player.id}>
              {player.name} ({player.rating})
            </Player>
          ))}
        </PlayerList>
        <ScoreInput
          label="Score"
          value={teamAScore}
          onChange={setTeamAScore}
          placeholder="21"
        />
      </TeamColumn>

      <Divider>VS</Divider>

      <TeamColumn side="B">
        <TeamLabel>Team B</TeamLabel>
        <PlayerList>
          {teamB.map(player => (
            <Player key={player.id}>
              {player.name} ({player.rating})
            </Player>
          ))}
        </PlayerList>
        <ScoreInput
          label="Score"
          value={teamBScore}
          onChange={setTeamBScore}
          placeholder="19"
        />
      </TeamColumn>
    </TeamsDisplay>

    <RadioGroup label="Winner">
      <Radio value="team_a">Team A</Radio>
      <Radio value="team_b">Team B</Radio>
      <Radio value="draw">Draw</Radio>
    </RadioGroup>

    <Alert type="info">
      Stats Update:
      • All players: Games Played +1
      • Winners: Games Won +1
      • Amount Owed: +₱{costPerGame} each
    </Alert>
  </ModalBody>

  <ModalActions>
    <Button variant="ghost" onClick={onClose}>
      Cancel
    </Button>
    <Button
      variant="primary"
      onClick={submitScore}
      disabled={!isValid}
    >
      Save Score
    </Button>
  </ModalActions>
</Modal>
```

### 5. Match Assignment Interface

**Component:** `<MatchAssignmentModal />`

```tsx
<Modal open={isOpen} onClose={onClose}>
  <ModalHeader>
    <Title>Assign Players to Match</Title>
  </ModalHeader>

  <ModalBody>
    <WaitingPlayersList>
      <Instructions>
        Select {requiredPlayers} players for {gameFormat}
      </Instructions>

      {waitingPlayers.map((player, index) => (
        <PlayerCheckbox
          key={player.id}
          player={player}
          checked={selectedPlayers.includes(player.id)}
          onChange={togglePlayer}
          recommended={index < requiredPlayers}
        >
          <Position>{index + 1}</Position>
          <Avatar src={player.avatarUrl} />
          <Name>{player.name}</Name>
          <SkillLevel>{player.skillLevel}</SkillLevel>
          <WaitTime>{player.waitTime} min</WaitTime>
        </PlayerCheckbox>
      ))}
    </WaitingPlayersList>

    {selectedPlayers.length === requiredPlayers && (
      <TeamSuggestion>
        <SuggestionHeader>
          Suggested Team Balance
        </SuggestionHeader>

        <TeamsPreview>
          <Team side="A">
            {teamA.map(p => (
              <Player key={p.id}>{p.name} ({p.rating})</Player>
            ))}
            <Total>{teamATotal}</Total>
          </Team>

          <Vs>VS</Vs>

          <Team side="B">
            {teamB.map(p => (
              <Player key={p.id}>{p.name} ({p.rating})</Player>
            ))}
            <Total>{teamBTotal}</Total>
          </Team>
        </TeamsPreview>

        <BalanceIndicator>
          {isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
        </BalanceIndicator>
      </TeamSuggestion>
    )}
  </ModalBody>

  <ModalActions>
    <Button variant="ghost" onClick={onClose}>
      Cancel
    </Button>
    <Button
      variant="primary"
      onClick={assignMatch}
      disabled={selectedPlayers.length !== requiredPlayers}
    >
      Assign to Match
    </Button>
  </ModalActions>
</Modal>
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Sprint 1)

**Tasks:**
1. Create server actions:
   - `createQueueSession()`
   - `updateQueueSession()`
   - `closeQueueSession()`
   - `cancelQueueSession()`
   - `removeParticipant()`
   - `waiveFee()`

2. Add RLS policies for queue_master role

3. Create authorization helpers:
   - `checkQueueMasterRole()`
   - `checkSessionOrganizer()`
   - `canManageSession()`

**Deliverables:**
- ✅ All Queue Master backend logic complete
- ✅ Security policies enforced
- ✅ API tested via direct calls

### Phase 2: Dashboard & Navigation (Sprint 2)

**Tasks:**
4. Create `/queue-master` dashboard page
5. Add role-based navigation guard
6. Build session list with filters
7. Add quick stats cards

**Deliverables:**
- ✅ Queue Masters can access dashboard
- ✅ Non-Queue Masters redirected
- ✅ View all own sessions

### Phase 3: Session Creation (Sprint 2)

**Tasks:**
8. Build session creation form
9. Add Zod validation schema
10. Connect to `createQueueSession()` action
11. Handle success/error states

**Deliverables:**
- ✅ Queue Masters can create sessions from UI
- ✅ Form validation working
- ✅ Sessions appear in database and dashboard

### Phase 4: Session Management (Sprint 3)

**Tasks:**
12. Create `/queue-master/sessions/[id]` page
13. Build real-time participant list
14. Add active matches panel
15. Implement session control buttons

**Deliverables:**
- ✅ Queue Masters can monitor sessions
- ✅ Real-time updates working
- ✅ Can pause/close sessions

### Phase 5: Match Management UI (Sprint 3)

**Tasks:**
16. Build match assignment modal
17. Create score recording modal
18. Add match history view
19. Connect to existing backend actions

**Deliverables:**
- ✅ Queue Masters can assign matches via UI
- ✅ Can record scores via modal
- ✅ Match history displays correctly

### Phase 6: Payment Management (Sprint 4)

**Tasks:**
20. Build payment tracking panel
21. Add waive fee functionality
22. Create payment summary export

**Deliverables:**
- ✅ Queue Masters can track payments
- ✅ Can waive fees for players
- ✅ Export payment reports

### Phase 7: Polish & Mobile (Sprint 4)

**Tasks:**
23. Add loading states
24. Implement error handling
25. Make responsive for mobile
26. Add confirmation modals

**Deliverables:**
- ✅ Smooth user experience
- ✅ Graceful error handling
- ✅ Works on all devices

---

## Database Schema

### Relevant Tables

#### `queue_sessions`
```sql
CREATE TABLE queue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID REFERENCES courts(id),
  organizer_id UUID REFERENCES profiles(id),  -- Queue Master
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  mode VARCHAR(20) DEFAULT 'casual' CHECK (mode IN ('casual', 'competitive')),
  game_format VARCHAR(20) DEFAULT 'doubles' CHECK (game_format IN ('singles', 'doubles', 'mixed')),
  max_players SMALLINT DEFAULT 12,
  current_players INT DEFAULT 0,
  cost_per_game NUMERIC(9,2),
  is_public BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('draft', 'open', 'active', 'paused', 'closed', 'cancelled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_queue_sessions_organizer ON queue_sessions(organizer_id);
CREATE INDEX idx_queue_sessions_status ON queue_sessions(status);
```

#### `queue_participants`
```sql
CREATE TABLE queue_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id UUID NOT NULL REFERENCES queue_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'completed', 'left')),
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  amount_owed NUMERIC(9,2) DEFAULT 0,
  missed_turns INT DEFAULT 0,  -- New field for no-show tracking
  UNIQUE (queue_session_id, user_id)
);

CREATE INDEX idx_queue_participants_session ON queue_participants(queue_session_id);
CREATE INDEX idx_queue_participants_user ON queue_participants(user_id);
```

#### `matches`
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_session_id UUID REFERENCES queue_sessions(id),
  court_id UUID REFERENCES courts(id),
  match_number INT,
  game_format VARCHAR(20) DEFAULT 'doubles',
  team_a_players UUID[] NOT NULL,
  team_b_players UUID[] NOT NULL,
  score_a INT,
  score_b INT,
  winner VARCHAR(10) CHECK (winner IN ('team_a', 'team_b', 'draw')),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_session ON matches(queue_session_id);
```

#### `user_roles`
```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}',  -- For venue restrictions (future)
  PRIMARY KEY (user_id, role_id)
);

-- Grant queue_master role
INSERT INTO user_roles (user_id, role_id, assigned_by)
VALUES (
  'user-uuid',
  (SELECT id FROM roles WHERE name = 'queue_master'),
  'admin-uuid'
);
```

---

## API Reference

### Server Actions

#### `createQueueSession(data: CreateQueueSessionParams)`

**Description:** Create a new queue session

**Parameters:**
```typescript
interface CreateQueueSessionParams {
  courtId: string
  startTime: Date
  endTime: Date
  mode: 'casual' | 'competitive'
  gameFormat: 'singles' | 'doubles' | 'mixed'
  maxPlayers: number
  costPerGame: number
  isPublic: boolean
}
```

**Returns:**
```typescript
{
  success: true,
  session: QueueSession
} | {
  success: false,
  error: string
}
```

**Authorization:** User must have `queue_master` role

---

#### `updateQueueSession(sessionId: string, data: Partial<CreateQueueSessionParams>)`

**Description:** Update session details (only before it starts)

**Authorization:** User must be session organizer

---

#### `closeQueueSession(sessionId: string)`

**Description:** Close session, calculate all payments

**Returns:**
```typescript
{
  success: true,
  summary: {
    totalGames: number
    totalRevenue: number
    participants: number
    unpaidBalances: number
  }
}
```

---

#### `cancelQueueSession(sessionId: string, reason: string)`

**Description:** Cancel session before it starts

**Authorization:** User must be organizer, status must be `draft` or `open`

---

#### `removeParticipant(sessionId: string, userId: string, reason: string)`

**Description:** Remove a player from the session

**Returns:**
```typescript
{
  success: true,
  amountOwed: number
}
```

---

#### `waiveFee(participantId: string, reason: string)`

**Description:** Mark participant's fee as waived

**Authorization:** User must be session organizer

**Audit:** Logs action in metadata

---

#### `assignMatchFromQueue(sessionId: string, numPlayers: number)`

**Description:** Assign top N waiting players to new match

**Existing:** ✅ Already implemented

---

#### `recordMatchScore(matchId: string, scores: ScoreData)`

**Description:** Record match result and update stats

**Existing:** ✅ Already implemented

---

## Design Decisions

### Decision 1: Venue Access

**Decision:** Queue Masters can create sessions at ANY venue (global permissions)

**Rationale:**
- Simpler implementation (no venue restriction logic needed)
- Better for Phase 1 with limited Queue Masters
- Can add venue restrictions later via `metadata` field

**Future:** Add venue-specific Queue Masters when needed

---

### Decision 2: Match Assignment

**Decision:** Manual selection only in Phase 1, AI suggestions in Phase 2

**Rationale:**
- Manual gives Queue Master full control
- Simpler to implement
- AI requires complex matchmaking algorithm
- Can validate manual flow before adding AI

**Implementation:**
- Phase 1: Checkbox selection + simple team balance
- Phase 2: Add AI suggestions that Queue Master can override

---

### Decision 3: Role Assignment

**Decision:** Admin assigns manually via database/admin panel

**Rationale:**
- Controlled rollout of Queue Master feature
- Ensures quality of early Queue Masters
- Prevents abuse during beta
- Self-service application can be added later

**Future:** Build application flow with admin approval

---

### Decision 4: Payment Enforcement

**Decision:** Block exit if `amount_owed > 0` (strict enforcement)

**Rationale:**
- Ensures venue gets paid
- Clear expectation for players
- Queue Master can waive fees for exceptions
- Reduces payment disputes

**Alternative:** Allow leave with outstanding balance (tracked separately)

---

### Decision 5: Real-Time Updates

**Decision:** Use Supabase Realtime subscriptions for live updates

**Rationale:**
- Already integrated in player flow
- Automatic synchronization across clients
- No polling required
- Works well for queue dynamics

**Implementation:** Subscribe to `queue_participants`, `queue_sessions`, `matches` tables

---

### Decision 6: Session Ownership

**Decision:** Sessions cannot be transferred between Queue Masters

**Rationale:**
- Simpler accountability model
- Clear ownership for disputes
- Prevents confusion
- Queue Master must close if leaving early

**Future:** Could add transfer with admin approval

---

## Testing Checklist

### Unit Tests

- [ ] `createQueueSession()` - Valid data creates session
- [ ] `createQueueSession()` - Rejects if not Queue Master
- [ ] `createQueueSession()` - Validates date range
- [ ] `updateQueueSession()` - Only organizer can update
- [ ] `closeQueueSession()` - Calculates payments correctly
- [ ] `removeParticipant()` - Calculates owed amount
- [ ] `waiveFee()` - Zeros out amount_owed

### Integration Tests

- [ ] Create session → Appears in dashboard
- [ ] Assign match → Players status changes to `playing`
- [ ] Record score → Stats update correctly
- [ ] Close session → All participants processed
- [ ] Real-time updates → Changes sync across browsers

### E2E Tests

- [ ] Queue Master creates session from UI
- [ ] Player joins session
- [ ] Queue Master assigns match
- [ ] Queue Master records score
- [ ] Player leaves and pays
- [ ] Queue Master closes session

---

## Future Enhancements

### Phase 2 Features

1. **AI-Assisted Matching**
   - Skill-based team balancing algorithm
   - Wait time fairness optimization
   - Play style compatibility
   - Historical pairing data

2. **Queue Master Application Flow**
   - Self-service application form
   - Admin review and approval
   - Venue-specific permissions

3. **Advanced Analytics**
   - Session performance metrics
   - Player satisfaction tracking
   - Revenue trends
   - Peak hours analysis

4. **Mobile Optimization**
   - Responsive layouts
   - Touch-friendly controls
   - Push notifications

### Phase 3 Features

5. **Dispute Resolution System**
   - Formal dispute submission
   - Evidence uploads
   - Witness statements
   - Escalation to admins

6. **Automated Features**
   - Auto-match assignment (optional)
   - Dynamic pricing suggestions
   - Fatigue detection
   - Break recommendations

7. **Communication Tools**
   - In-app messaging
   - Broadcast announcements
   - Session updates
   - Payment reminders

8. **Training & Certification**
   - Tutorial videos
   - Interactive walkthrough
   - Best practices guide
   - Certification quiz

---

## Support & Resources

### For Queue Masters

**Getting Started:**
1. Ensure you have Queue Master role assigned
2. Visit `/queue-master` dashboard
3. Click [+ Create New Session]
4. Follow the setup wizard

**Best Practices:**
- Arrive 15 minutes before session start
- Keep matches moving (~20 minutes each)
- Communicate clearly with players
- Record scores promptly
- Handle disputes fairly

**Common Issues:**
- Session not appearing? Check role assignment
- Can't assign match? Ensure enough waiting players
- Payment failed? Generate new payment link
- Player dispute? Document and resolve quickly

### For Developers

**Documentation:**
- `/docs/QUEUE_MANAGER_ROLE.md` (this file)
- `/docs/QUEUE_SYSTEM_USAGE_GUIDE.md` - API reference
- `/CLAUDE.md` - Project overview

**Key Files:**
- `/web/src/app/actions/queue-actions.ts` - Server actions
- `/web/src/app/actions/match-actions.ts` - Match management
- `/web/src/hooks/use-queue.ts` - React hooks
- `/backend/supabase/migrations/001_initial_schema_v2.sql` - Database

**Testing:**
- Use `/backend/supabase/test-queue-data.sql` for test sessions
- Supabase dashboard for direct database queries
- Browser DevTools for real-time subscription debugging

---

## Changelog

### Version 1.0 (November 26, 2025)
- Initial specification
- Complete feature list documented
- Implementation plan created
- API reference added

---

## Appendix

### Glossary

- **Queue Master**: User who organizes and manages queue sessions
- **Queue Session**: Time-bound rotation system for walk-in players
- **Match**: Single game between 2 or 4 players
- **Participant**: Player who has joined a queue session
- **Organizer**: Queue Master who created a specific session
- **Cost Per Game**: Amount charged for each game played
- **Amount Owed**: Total payment due (games_played × cost_per_game)

### Related Documents

- [Queue System Usage Guide](/docs/QUEUE_SYSTEM_USAGE_GUIDE.md)
- [System Analysis](/docs/system-analysis/rallio-system-analysis.md)
- [Database Schema](/backend/supabase/migrations/001_initial_schema_v2.sql)
- [Implementation Report](/QUEUE_BACKEND_IMPLEMENTATION_REPORT.md)

---

**Document Status:** Living Document
**Maintained By:** Development Team
**Last Review:** November 26, 2025
