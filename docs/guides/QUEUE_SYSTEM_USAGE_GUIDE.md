# Queue System - Usage Guide

**Version:** 1.0
**Last Updated:** 2025-11-26

---

## Overview

The Queue Management System allows players to join queues at badminton courts, get matched into games, track their performance, and handle payments for games played.

---

## For Players

### Viewing Available Queues

**Dashboard:** Navigate to `/queue`
- View "Your Active Queues" (queues you've joined)
- View "Available Queues Near You" (open queues)
- See real-time player counts and estimated wait times

**Court Detail Page:** Navigate to `/queue/[courtId]`
- View specific queue for a court
- See full list of players in queue
- Monitor your position in real-time

### Joining a Queue

1. Navigate to queue dashboard or specific court queue page
2. Click "Join Queue" button
3. Your position is calculated automatically
4. Receive real-time updates as others join/leave

**Requirements:**
- Must be authenticated
- Queue must not be full (`current_players < max_players`)
- Cannot join if already in that queue

### Leaving a Queue

1. Click "Leave Queue" button from queue detail page
2. **If you haven't played any games:** Leave immediately
3. **If you played games:** System blocks leaving and shows payment required

**Payment Required Scenario:**
```
Error: "Payment required: 150 PHP for 3 games"
```
You must complete payment before leaving.

### Queue Payment Flow

**Trigger:** Attempting to leave after playing games

**Steps:**
1. System calculates: `amount_owed = games_played × cost_per_game`
2. User initiates payment via server action:
   ```typescript
   import { initiateQueuePaymentAction } from '@/app/actions/payments'

   const result = await initiateQueuePaymentAction(sessionId, 'gcash')
   if (result.success) {
     window.location.href = result.checkoutUrl
   }
   ```
3. User completes payment via PayMongo (GCash or Maya)
4. Webhook updates payment status
5. User can now leave queue

**Payment Methods:**
- GCash
- Maya (PayMaya)
- Cash (future - not yet implemented)

---

## For Queue Masters

### Assigning Players to Matches

**Server Action:** `assignMatchFromQueue(sessionId, numPlayers)`

**Example:**
```typescript
import { assignMatchFromQueue } from '@/app/actions/match-actions'

// Assign 4 players (2v2 doubles match)
const result = await assignMatchFromQueue(sessionId, 4)

if (result.success) {
  console.log('Match assigned:', result.match)
  // Match ID, team_a_players, team_b_players created
}
```

**What Happens:**
1. Top N waiting players selected (ORDER BY joined_at)
2. Players split into Team A and Team B
3. Match record created with status='scheduled'
4. Participants updated to status='playing'

**Requirements:**
- User must be the queue organizer (`queue_sessions.organizer_id`)
- Must have enough waiting players (`N >= numPlayers`)

### Starting a Match

**Server Action:** `startMatch(matchId)`

**Example:**
```typescript
import { startMatch } from '@/app/actions/match-actions'

const result = await startMatch(matchId)
// Match status → 'in_progress', started_at timestamp recorded
```

**Authorization:**
- Queue organizer OR match participant

### Recording Match Scores

**Server Action:** `recordMatchScore(matchId, scores)`

**Example:**
```typescript
import { recordMatchScore } from '@/app/actions/match-actions'

const result = await recordMatchScore(matchId, {
  teamAScore: 21,
  teamBScore: 15,
  winner: 'team_a'
})
```

**What Happens:**
1. Match status → 'completed'
2. Final scores recorded
3. Winner determined
4. **For each participant:**
   - `games_played += 1`
   - `games_won += 1` (if on winning team)
   - `amount_owed += cost_per_game`
   - Status → 'waiting' (returned to queue)

**Requirements:**
- User must be the queue organizer
- Match must exist and be in progress

### Viewing Active Matches

**Server Action:** `getActiveMatch(playerId?)`

**Example:**
```typescript
import { getActiveMatch } from '@/app/actions/match-actions'

// Get current user's active match
const result = await getActiveMatch()

// Get specific player's active match
const result = await getActiveMatch(playerId)
```

Returns match details if player is in a scheduled or in_progress match.

---

## Real-Time Updates

### Automatic Refresh Events

**Queue Participants Changes:**
- When someone joins the queue
- When someone leaves the queue
- When player status changes (waiting → playing)

**Queue Session Updates:**
- Session status changes (open → active → closed)
- Max players updated
- Cost per game updated

**Subscription Channels:**

1. **Specific Queue:** `queue-{sessionId}`
   - Listens to: `queue_participants` (all events), `queue_sessions` (UPDATE)
   - Used by: `useQueue(courtId)`

2. **User's Queues:** `my-queues`
   - Listens to: `queue_participants` (all events)
   - Used by: `useMyQueues()`

3. **Nearby Queues:** `nearby-queues`
   - Listens to: `queue_sessions` (all events)
   - Used by: `useNearbyQueues()`

---

## API Reference

### Queue Server Actions

**File:** `/web/src/app/actions/queue-actions.ts`

#### `getQueueDetails(courtId: string)`
Fetch queue session details with all participants.

**Returns:**
```typescript
{
  success: boolean
  queue?: QueueSessionData & {
    players: QueueParticipantData[]
    userPosition: number | null
    estimatedWaitTime: number
  }
  error?: string
}
```

#### `joinQueue(sessionId: string)`
Add authenticated user to queue.

**Validations:**
- User authenticated
- Session exists and is joinable (status = 'open' or 'active')
- Queue not full
- User not already in queue

**Returns:**
```typescript
{
  success: boolean
  participant?: QueueParticipant
  error?: string
}
```

#### `leaveQueue(sessionId: string)`
Remove authenticated user from queue.

**Special Case - Payment Required:**
```typescript
{
  success: false
  error: 'Payment required'
  requiresPayment: true
  amountOwed: number
  gamesPlayed: number
}
```

#### `getMyQueues()`
Fetch all active queues for authenticated user.

**Returns:**
```typescript
{
  success: boolean
  queues: Array<{
    id: string
    courtId: string
    courtName: string
    venueName: string
    status: string
    userPosition: number
    estimatedWaitTime: number
    maxPlayers: number
    currentPlayers: number
  }>
  error?: string
}
```

#### `getNearbyQueues(latitude?: number, longitude?: number)`
Fetch public queue sessions (future: filter by distance).

**Returns:** Same structure as `getMyQueues()`

#### `calculateQueuePayment(sessionId: string)`
Calculate amount owed by authenticated user.

**Returns:**
```typescript
{
  success: boolean
  payment?: {
    participantId: string
    sessionId: string
    gamesPlayed: number
    costPerGame: number
    totalOwed: number
    amountPaid: number
    remainingBalance: number
    courtName: string
    venueName: string
  }
  error?: string
}
```

---

### Match Server Actions

**File:** `/web/src/app/actions/match-actions.ts`

#### `assignMatchFromQueue(sessionId: string, numPlayers: number = 4)`
Assign top N waiting players to a new match.

**Authorization:** Queue organizer only

**Returns:**
```typescript
{
  success: boolean
  match?: MatchData
  error?: string
}
```

#### `startMatch(matchId: string)`
Mark match as in progress.

**Authorization:** Queue organizer OR match participant

#### `recordMatchScore(matchId: string, scores: { teamAScore: number, teamBScore: number, winner: 'team_a' | 'team_b' | 'draw' })`
Record final match scores and update participant stats.

**Authorization:** Queue organizer only

**Side Effects:**
- Updates `games_played`, `games_won`, `amount_owed` for all participants
- Returns players to 'waiting' status
- Match status → 'completed'

#### `getActiveMatch(playerId?: string)`
Check if player has an active match.

**Returns:**
```typescript
{
  success: boolean
  match?: MatchData | null
  error?: string
}
```

---

### Payment Server Actions

**File:** `/web/src/app/actions/payments.ts`

#### `initiateQueuePaymentAction(sessionId: string, paymentMethod: 'gcash' | 'paymaya')`
Create payment for queue session participation.

**Calculation:**
```typescript
totalAmount = participant.games_played × session.cost_per_game
```

**Returns:**
```typescript
{
  success: boolean
  checkoutUrl?: string
  paymentId?: string
  sourceId?: string
  error?: string
}
```

**Payment Flow:**
1. Call this action to generate PayMongo checkout URL
2. Redirect user to `checkoutUrl`
3. User completes payment
4. PayMongo webhook updates payment status
5. Participant can leave queue

---

### React Hooks

**File:** `/web/src/hooks/use-queue.ts`

#### `useQueue(courtId: string)`
Hook for managing specific queue state with real-time updates.

**Returns:**
```typescript
{
  queue: QueueSession | null
  isLoading: boolean
  error: string | null
  joinQueue: () => Promise<void>
  leaveQueue: () => Promise<void>
  refreshQueue: () => Promise<void>
}
```

**Real-Time:** Auto-refreshes on participant and session changes

#### `useMyQueues()`
Hook for fetching user's active queue participations.

**Returns:**
```typescript
{
  queues: QueueSession[]
  isLoading: boolean
}
```

**Real-Time:** Auto-refreshes when user joins/leaves any queue

#### `useNearbyQueues(latitude?: number, longitude?: number)`
Hook for fetching public queue sessions.

**Returns:**
```typescript
{
  queues: QueueSession[]
  isLoading: boolean
}
```

**Real-Time:** Auto-refreshes when new sessions created

---

## Database Schema Reference

### `queue_sessions`
```sql
id                  uuid PRIMARY KEY
court_id            uuid → courts
organizer_id        uuid → profiles (Queue Master)
start_time          timestamptz
end_time            timestamptz
mode                varchar (casual | competitive)
game_format         varchar (singles | doubles | mixed)
max_players         smallint
current_players     int
cost_per_game       numeric
is_public           boolean
status              varchar (draft | open | active | paused | closed | cancelled)
created_at          timestamptz
updated_at          timestamptz
settings            jsonb
```

### `queue_participants`
```sql
id                  uuid PRIMARY KEY
queue_session_id    uuid → queue_sessions
user_id             uuid → profiles
joined_at           timestamptz
left_at             timestamptz (nullable)
games_played        int
games_won           int
status              varchar (waiting | playing | completed | left)
payment_status      varchar (unpaid | partial | paid)
amount_owed         numeric
```

### `matches`
```sql
id                  uuid PRIMARY KEY
queue_session_id    uuid → queue_sessions
court_id            uuid → courts
match_number        int
game_format         varchar
team_a_players      uuid[] (array of player IDs)
team_b_players      uuid[] (array of player IDs)
score_a             int
score_b             int
winner              varchar (team_a | team_b | draw)
started_at          timestamptz
completed_at        timestamptz
status              varchar (scheduled | in_progress | completed | cancelled)
created_at          timestamptz
metadata            jsonb
```

---

## Error Handling

### Common Errors

**"User not authenticated"**
- User not logged in
- Session expired
- **Solution:** Redirect to login

**"Queue session not found"**
- Invalid session ID
- Session deleted
- **Solution:** Refresh queue list

**"Queue is full"**
- `current_players >= max_players`
- **Solution:** Wait or find another queue

**"Already in queue"**
- User tried to join same queue twice
- **Solution:** Show error message

**"Not in queue"**
- User tried to leave a queue they're not in
- **Solution:** Refresh page

**"Payment required"**
- User played games and owes money
- **Solution:** Initiate payment flow

**"Unauthorized: Only queue master can..."**
- User tried Queue Master action without permission
- **Solution:** Show error, restrict UI

**"Not enough waiting players"**
- Queue Master tried to assign match but not enough players
- **Solution:** Wait for more players to join

---

## Testing Scenarios

### Player Journey
1. ✅ View queue dashboard
2. ✅ Join a queue
3. ✅ See position update as others join
4. ✅ Get assigned to match
5. ✅ Play game (Queue Master records score)
6. ✅ Return to queue after game
7. ✅ Play more games
8. ✅ Try to leave → Payment required
9. ✅ Complete payment
10. ✅ Leave queue successfully

### Queue Master Journey
1. ✅ Create queue session (future - UI pending)
2. ✅ View waiting players
3. ✅ Assign top 4 players to match
4. ✅ Start match
5. ✅ Record final scores
6. ✅ Verify player stats updated
7. ✅ Verify players returned to queue

---

## Next Steps

**Immediate:**
1. Apply RLS policies (migration 005)
2. Create queue session creation UI
3. Add ELO rating calculations
4. Create payment success/failure pages for queues

**Future Enhancements:**
1. Skill-based team balancing (use player.skill_level)
2. Email/SMS notifications for match assignments
3. Queue Master dashboard with analytics
4. Tournament mode
5. Player preferences (preferred partners, play style matching)

---

**Last Updated:** 2025-11-26
**Contributors:** Claude (Payment Systems & Queue Management Architect)
