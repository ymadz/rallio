# Queue System Guide - Rallio

## Overview

The queue system is a **walk-in court rotation system** for badminton that allows players to show up at a venue, join a session, and play multiple games with automatic rotation and payment tracking.

---

## Core Concept

It's essentially a **"next up" system** (like at a barber shop) where players cycle through: **waiting → playing → waiting → playing**, and everyone pays based on the number of games they actually played.

---

## User Roles

### 1. **Player**
Regular users who join queue sessions to play badminton

### 2. **Queue Master (Organizer)**
User who creates and manages queue sessions - acts as a facilitator to keep games running smoothly

---

## Player Flow

### Step 1: Discover Active Sessions
- Browse available queue sessions at nearby venues
- See session details: time, format (singles/doubles/mixed), cost per game, available spots
- Filter by: venue, mode (casual/competitive), distance

### Step 2: Join Queue
- Click "Join Queue" on an open session
- System adds them to `queue_participants` with status `waiting`
- `current_players` count auto-increments via trigger
- Receive confirmation notification

### Step 3: Wait for Turn
- View live queue status: who's waiting, who's playing
- See their position in rotation
- Get notifications when they're up next

### Step 4: Play Match
- Queue Master creates match and assigns teams
- Player status changes to `playing`
- Match tracked in `matches` table with scores, duration
- `games_played` count increments after match completes

### Step 5: Rotate Back
- After game ends, status returns to `waiting`
- Player goes to back of queue
- Process repeats for next game

### Step 6: Leave & Pay
- Player can leave queue anytime (status = `left`)
- System calculates: `amount_owed = games_played × cost_per_game`
- Payment link generated via PayMongo
- Payment status tracked: `unpaid` → `paid`

---

## Queue Master Flow

### Step 1: Create Session
```sql
INSERT INTO queue_sessions (
  court_id,
  organizer_id,
  start_time,
  end_time,
  mode,              -- 'casual' or 'competitive'
  game_format,       -- 'singles', 'doubles', or 'mixed'
  max_players,       -- usually 8-16
  cost_per_game,     -- e.g., 50 PHP per game
  is_public,
  status             -- starts as 'open'
)
```

### Step 2: Monitor Participants
- View real-time participant list
- See: name, join time, games played, games won, payment status
- Track `current_players` count vs `max_players` limit
- Close session to new joiners when full

### Step 3: Create Matches
```sql
INSERT INTO matches (
  queue_session_id,
  court_id,
  match_number,
  game_format,
  team_a_players,    -- UUID array [player1_id, player2_id]
  team_b_players,    -- UUID array [player3_id, player4_id]
  status             -- 'scheduled' → 'in_progress' → 'completed'
)
```

**Manual Matching:**
- Queue Master selects 4 players (for doubles)
- Creates balanced teams based on skill/rating
- Assigns to available court

**AI-Assisted Matching (Future):**
- System suggests optimal player combinations
- Balances skill levels, play styles, wait times
- Avoids pairing incompatible players

### Step 4: Track Match Progress
- Mark match as `in_progress` when game starts
- Update scores: `score_a`, `score_b`
- Set winner: `team_a`, `team_b`, or `draw`
- Mark `completed_at` timestamp

### Step 5: Update Participant Stats
```sql
-- After match completion
UPDATE queue_participants
SET 
  games_played = games_played + 1,
  games_won = games_won + (CASE WHEN won THEN 1 ELSE 0 END),
  status = 'waiting',
  amount_owed = games_played × cost_per_game
WHERE user_id IN (match_players);
```

### Step 6: Close Session
- Change session status to `closed`
- No new players can join
- Generate payment summary for all participants
- Collect payments via PayMongo QR codes

---

## Database Schema

### Tables Involved

#### `queue_sessions`
Main session container
- `organizer_id` - Who created/manages the session
- `court_id` - Where games are played
- `start_time`, `end_time` - Session duration
- `mode` - casual (fun) vs competitive (ranked)
- `game_format` - singles/doubles/mixed
- `max_players` - Capacity limit
- `current_players` - Real-time count (auto-updated via trigger)
- `cost_per_game` - Price per match
- `status` - draft/open/active/paused/closed/cancelled

#### `queue_participants`
Players in the session
- `queue_session_id` - Which session
- `user_id` - The player
- `joined_at`, `left_at` - Timestamps
- `games_played`, `games_won` - Stats tracking
- `status` - waiting/playing/completed/left
- `payment_status` - unpaid/partial/paid
- `amount_owed` - Calculated: games × cost

#### `matches`
Individual games
- `queue_session_id` - Parent session
- `match_number` - Game sequence (1, 2, 3...)
- `team_a_players`, `team_b_players` - UUID arrays
- `score_a`, `score_b` - Final scores
- `winner` - team_a/team_b/draw
- `started_at`, `completed_at` - Duration tracking
- `status` - scheduled/in_progress/completed/cancelled

---

## Key Features

### 1. **Real-Time Participant Count**
Trigger automatically maintains `current_players`:
```sql
CREATE TRIGGER update_queue_count
AFTER INSERT OR UPDATE OR DELETE ON queue_participants
FOR EACH ROW EXECUTE FUNCTION update_queue_participant_count();
```

### 2. **Fair Rotation Tracking**
- `joined_at` determines initial queue position
- `games_played` ensures balanced playtime
- `status` (waiting/playing) prevents double-booking

### 3. **Flexible Payment**
- Pay-per-game model: only charged for games played
- Supports partial payments during session
- Final settlement at session close
- PayMongo QR code integration

### 4. **Match History**
- All games recorded in `matches` table
- Player stats updated automatically
- Used for ratings, analytics, AI improvements

### 5. **Session Modes**

**Casual:**
- Just for fun
- More relaxed matching
- Social atmosphere

**Competitive:**
- Ranked games
- Affects player ELO rating
- Stricter skill-based matching
- Post-match ratings required

---

## AI Features (Future Enhancement)

### Smart Matchmaking
- **Skill-based pairing** - Uses player `rating` (ELO) and `skill_level` (1-10)
- **Play style compatibility** - Matches complementary styles
- **Historical analysis** - Learns from `player_ratings.would_play_again`
- **Balanced teams** - Equalizes team skill totals

### Queue Optimization
- **Wait time balancing** - Ensures fair rotation
- **Court utilization** - Maximizes games per hour
- **Fatigue tracking** - Suggests breaks after X games
- **Dynamic rotation** - Adjusts based on participant count

### Predictive Analytics
- **Match duration estimates** - Predicts game length by skill level
- **Optimal session sizing** - Suggests `max_players` for time slot
- **Payment forecasting** - Estimates costs before playing
- **Capacity alerts** - Warns when nearing max_players

### Learning Loop
Data flow that improves AI over time:
1. **Match completion** → scores, duration recorded
2. **Player ratings** → sportsmanship, skill accuracy, would_play_again
3. **Session analytics** → wait times, games/hour, satisfaction
4. **Algorithm refinement** → Better matching, rotation, predictions

**Example AI Suggestion:**
```
"Suggested Match #5:
Team A: Player John (rating: 1580) + Player Maria (rating: 1420)
Team B: Player Alex (rating: 1540) + Player Sarah (rating: 1460)

Reasoning:
✓ Balanced team totals (3000 vs 3000)
✓ Both have waited 2 games
✓ Compatible play styles (aggressive + defensive pairs)
✓ No recent matchups (avoid repetition)
✓ Predicted duration: 15-20 minutes"
```

---

## Payment Flow

### During Session
```sql
-- Track games played
amount_owed = games_played × cost_per_game

-- Player can check balance anytime
SELECT games_played, amount_owed, payment_status
FROM queue_participants
WHERE user_id = current_user_id;
```

### At Session Close
1. Queue Master marks session as `closed`
2. System generates payment links for all unpaid participants
3. Each player receives:
   - PayMongo QR code (GCash/Maya)
   - Payment breakdown (X games × ₱Y = ₱Z)
   - Deadline to pay (e.g., 24 hours)

### Payment Processing
```sql
-- Insert payment record
INSERT INTO payments (
  reference,
  user_id,
  amount,
  payment_method,
  qr_code_url,
  status
);

-- Update participant payment status
UPDATE queue_participants
SET 
  payment_status = 'paid',
  amount_owed = 0
WHERE user_id = ? AND payment_id = ?;
```

---

## Example Session Lifecycle

### 1. Setup (6:00 PM)
```
Queue Master creates session:
- Court: Fewddicts Court 1
- Time: 6:00 PM - 9:00 PM
- Format: Doubles
- Cost: ₱50/game
- Max: 12 players
```

### 2. Players Join (6:00-6:30 PM)
```
6:05 PM - John joins (waiting)
6:10 PM - Maria joins (waiting)
6:12 PM - Alex joins (waiting)
6:15 PM - Sarah joins (waiting)
...
6:30 PM - 10 players in queue
```

### 3. Games Start (6:30 PM)
```
Match #1: John + Maria vs Alex + Sarah
Status: John, Maria, Alex, Sarah = playing
Others: waiting

Match completes at 6:50 PM
Winner: Team A (21-18)
John, Maria: games_played = 1, games_won = 1
Alex, Sarah: games_played = 1, games_won = 0
All return to waiting status
```

### 4. Rotation Continues (6:50-9:00 PM)
```
Match #2: Next 4 players who haven't played yet
Match #3: Mix of new + previous players
...
Match #15: Final game at 8:45 PM
```

### 5. Session Closes (9:00 PM)
```
Final Stats:
- John: 5 games played, 3 wins → owes ₱250
- Maria: 4 games played, 2 wins → owes ₱200
- Alex: 5 games played, 2 wins → owes ₱250
...

Payment QR codes sent to all participants
```

---

## Query Examples

### Find Active Queue Sessions Near Me
```sql
SELECT 
  qs.*,
  v.name AS venue_name,
  c.name AS court_name,
  earth_distance(
    ll_to_earth(v.latitude, v.longitude),
    ll_to_earth($user_lat, $user_lng)
  ) / 1000 AS distance_km
FROM queue_sessions qs
JOIN courts c ON qs.court_id = c.id
JOIN venues v ON c.venue_id = v.id
WHERE 
  qs.status IN ('open', 'active')
  AND qs.is_public = true
  AND qs.start_time <= now()
  AND qs.end_time >= now()
  AND qs.current_players < qs.max_players
ORDER BY distance_km ASC
LIMIT 10;
```

### Get Queue Participant List
```sql
SELECT 
  p.display_name,
  pl.skill_level,
  pl.rating,
  qp.joined_at,
  qp.games_played,
  qp.games_won,
  qp.status,
  qp.amount_owed,
  qp.payment_status
FROM queue_participants qp
JOIN profiles p ON qp.user_id = p.id
JOIN players pl ON qp.user_id = pl.user_id
WHERE qp.queue_session_id = $session_id
ORDER BY 
  CASE qp.status
    WHEN 'playing' THEN 1
    WHEN 'waiting' THEN 2
    WHEN 'completed' THEN 3
    ELSE 4
  END,
  qp.joined_at ASC;
```

### Calculate Session Revenue
```sql
SELECT 
  qs.id,
  COUNT(qp.id) AS total_participants,
  SUM(qp.games_played) AS total_games,
  SUM(qp.amount_owed) AS total_revenue,
  SUM(CASE WHEN qp.payment_status = 'paid' THEN qp.amount_owed ELSE 0 END) AS collected,
  SUM(CASE WHEN qp.payment_status = 'unpaid' THEN qp.amount_owed ELSE 0 END) AS outstanding
FROM queue_sessions qs
LEFT JOIN queue_participants qp ON qs.id = qp.queue_session_id
WHERE qs.id = $session_id
GROUP BY qs.id;
```

### Get My Queue History
```sql
SELECT 
  qs.start_time,
  v.name AS venue_name,
  qp.games_played,
  qp.games_won,
  qp.amount_owed,
  qp.payment_status,
  ROUND(qp.games_won::numeric / NULLIF(qp.games_played, 0) * 100, 1) AS win_rate
FROM queue_participants qp
JOIN queue_sessions qs ON qp.queue_session_id = qs.id
JOIN courts c ON qs.court_id = c.id
JOIN venues v ON c.venue_id = v.id
WHERE qp.user_id = auth.uid()
ORDER BY qs.start_time DESC;
```

---

## Security (RLS Policies)

### Queue Sessions
```sql
-- Anyone can view public sessions
CREATE POLICY "Public queue sessions are viewable"
ON queue_sessions FOR SELECT
USING (is_public = true OR auth.uid() = organizer_id);

-- Only organizer can update their session
CREATE POLICY "Organizers can update their sessions"
ON queue_sessions FOR UPDATE
USING (auth.uid() = organizer_id);
```

### Queue Participants
```sql
-- Can view if session is public OR you're a participant OR you're the organizer
CREATE POLICY "Participants can view session participants"
ON queue_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE queue_sessions.id = queue_participants.queue_session_id
    AND (queue_sessions.is_public = true OR queue_sessions.organizer_id = auth.uid())
  )
  OR auth.uid() = user_id
);

-- Users can only join as themselves
CREATE POLICY "Users can join queues"
ON queue_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Matches
```sql
-- Only participants and organizer can view matches
CREATE POLICY "Matches are viewable by participants"
ON matches FOR SELECT
USING (
  auth.uid() = ANY(team_a_players) OR
  auth.uid() = ANY(team_b_players) OR
  EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE queue_sessions.id = matches.queue_session_id
    AND queue_sessions.organizer_id = auth.uid()
  )
);
```

---

## Mobile/Web UI Considerations

### Player View
- **Discover Screen**: Map/list of active queue sessions nearby
- **Session Detail**: Participant count, format, cost, join button
- **Queue Status**: Live list of who's waiting/playing, your position
- **Match Notification**: Alert when you're up next (push notification)
- **Payment Screen**: Games played, amount owed, QR code

### Queue Master View
- **Session Manager**: Create/edit/close sessions
- **Participant Dashboard**: Real-time list with stats
- **Match Creator**: Select 4 players, assign teams, start match
- **Match Tracker**: Update scores, mark complete
- **Payment Collector**: View who paid/unpaid, send reminders

---

## Best Practices

### For Queue Masters
1. **Set realistic `max_players`** - 8-12 for 3-hour session
2. **Balance skill levels** - Mix beginners with advanced
3. **Track wait times** - Ensure everyone gets equal play
4. **Close on time** - Respect end_time commitments
5. **Collect payments promptly** - Send QR codes immediately after close

### For Players
1. **Arrive on time** - Don't make others wait
2. **Stay for commitment** - Leaving early disrupts rotation
3. **Pay promptly** - Complete payment within 24 hours
4. **Rate fairly** - Help improve matching algorithm
5. **Be a good sport** - Queue success depends on community vibe

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Manual queue management
- ✅ Basic rotation tracking
- ✅ Payment calculation
- ✅ Match history

### Phase 2 (Next)
- 🔄 Real-time updates (Supabase Realtime)
- 🔄 Push notifications for matches
- 🔄 In-app payment (PayMongo integration)
- 🔄 Post-match rating prompts

### Phase 3 (Future)
- 🎯 AI-powered matchmaking
- 🎯 Smart rotation optimization
- 🎯 Predictive analytics
- 🎯 Tournament mode
- 🎯 Team formation suggestions
- 🎯 Skill-based lobbies

---

## Technical Notes

### Triggers
The `update_queue_participant_count()` function maintains accurate participant counts:
- Increments on INSERT
- Decrements on DELETE or status='left'
- Prevents negative counts with GREATEST(0, count - 1)

### Performance Indexes
```sql
CREATE INDEX idx_queue_sessions_status ON queue_sessions(status);
CREATE INDEX idx_queue_sessions_time ON queue_sessions(start_time, end_time);
CREATE INDEX idx_queue_participants_session ON queue_participants(queue_session_id);
CREATE INDEX idx_matches_queue_session ON matches(queue_session_id);
```

### Data Integrity
- `UNIQUE (queue_session_id, user_id)` - Prevents duplicate joins
- `CHECK (end_time > start_time)` - Valid time ranges
- `CHECK (status IN (...))` - Enum-like validation
- Foreign keys with appropriate CASCADE/SET NULL

---

## Support & Resources

- **Schema File**: `/backend/supabase/migrations/001_initial_schema_v2.sql`
- **API Docs**: `/docs/api/` (TBD)
- **PayMongo Integration**: `/docs/development/` (TBD)
- **Real-time Setup**: Supabase Realtime subscriptions (TBD)

---

**Last Updated**: November 19, 2025  
**Version**: 2.0  
**Status**: Production Ready ✅
