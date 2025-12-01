# Testing Instructions: Enhanced Matches Page

## ✅ Implementation Complete

The matches page has been completely rebuilt with:
- **Player stats dashboard** (Total Games, Wins, Losses, Win Rate, Skill Level)
- **Match history cards** with scores, team rosters, opponent names
- **Filtering** by All/Wins/Losses/Draws
- **Real-time calculation** from matches table data

---

## 🧪 Testing Steps

### **1. Create Test Match Data** (Required First)

Since the matches page displays data from the `matches` table, you'll need some completed matches to test with. You can:

**Option A: Use SQL to create test data**

Run this in Supabase SQL Editor:

\`\`\`sql
-- Get your user ID (replace with your actual user ID)
-- You can find it in the profiles table or auth.users table

-- Create a test match where you won
INSERT INTO matches (
  queue_session_id,
  court_id,
  match_number,
  game_format,
  team_a_players,
  team_b_players,
  score_a,
  score_b,
  winner,
  status,
  started_at,
  completed_at
)
VALUES (
  NULL, -- Or link to a real queue_session_id
  (SELECT id FROM courts LIMIT 1), -- Uses first court
  1,
  'doubles',
  ARRAY['YOUR_USER_ID_HERE']::uuid[], -- Your team
  ARRAY[(SELECT id FROM profiles WHERE id != 'YOUR_USER_ID_HERE' LIMIT 1)]::uuid[], -- Opponent team
  21, -- Your score
  15, -- Opponent score
  'team_a', -- You won
  'completed',
  now() - interval '2 days',
  now() - interval '2 days' + interval '1 hour'
);

-- Create a test match where you lost
INSERT INTO matches (
  queue_session_id,
  court_id,
  match_number,
  game_format,
  team_a_players,
  team_b_players,
  score_a,
  score_b,
  winner,
  status,
  started_at,
  completed_at
)
VALUES (
  NULL,
  (SELECT id FROM courts LIMIT 1),
  2,
  'doubles',
  ARRAY[(SELECT id FROM profiles WHERE id != 'YOUR_USER_ID_HERE' LIMIT 1)]::uuid[], -- Opponent team
  ARRAY['YOUR_USER_ID_HERE']::uuid[], -- Your team
  21, -- Opponent score
  18, -- Your score
  'team_a', -- You lost
  'completed',
  now() - interval '1 day',
  now() - interval '1 day' + interval '1 hour'
);
\`\`\`

**Option B: Wait for real queue matches**

If you have a Queue Master role, you can:
1. Create a queue session
2. Assign matches to players
3. Complete the matches with scores
4. Those will appear in the matches page

---

### **2. Test the Matches Page**

1. **Navigate to Matches Page**
   - Go to `http://localhost:3000/matches`
   - Or click "Matches" in the navigation menu

2. **Verify Stats Card Displays**
   - Should show: Total Games, Wins, Losses, Win Rate
   - Should show your Skill Level (1-10)
   - Should show games played this month

3. **Verify Match Cards Display**
   - Each match should show:
     - ✓ Win/Loss/Draw badge (green/red/gray)
     - Score (e.g., "21 - 15")
     - Your team vs Opponents team
     - Player names (not just IDs)
     - Venue and court name
     - Date and time completed
     - Game format (Doubles/Singles)

4. **Test Filters**
   - Click "All" - shows all completed matches
   - Click "Wins" - shows only matches you won
   - Click "Losses" - shows only matches you lost  
   - Click "Draws" - shows only drawn matches
   - Verify URL updates with `?filter=wins`, etc.

5. **Test Empty States**
   - If you have no matches: Should show "No matches yet" message
   - If filtered view is empty: Should show "No wins yet" with link back to "View all matches"

6. **Test Responsive Design**
   - Desktop: Stats should be in 4 columns
   - Mobile: Stats should stack properly
   - Match cards should be readable on mobile

---

### **3. Expected Behavior**

**Stats Calculation:**
- Total Games = All completed matches where you were a player
- Wins = Matches where `winner` equals your team ('team_a' or 'team_b')
- Losses = Matches where `winner` is the opposite team
- Draws = Matches where `winner = 'draw'`
- Win Rate = (Wins / Total Games) × 100

**Match Display:**
- Shows newest matches first (sorted by `completed_at`)
- Only shows completed matches (`status = 'completed'`)
- Correctly identifies which team you were on
- Shows your teammates and opponents by name

---

### **4. Troubleshooting**

**Problem: "No matches yet" but you have matches in the database**

Check:
1. Are the matches `status = 'completed'`? Only completed matches show
2. Is your user ID in either `team_a_players` or `team_b_players`?
3. Check browser console for errors

**Problem: Player names show as "Unknown Player"**

Check:
1. Do the player IDs in `team_a_players`/`team_b_players` exist in the `profiles` table?
2. Do those profiles have `full_name` set?

**Problem: Filters not working**

Check:
1. Browser console for errors
2. URL updates when clicking filter buttons
3. Refresh the page to ensure server-side rendering works

**Problem: Stats not showing**

Check:
1. Do you have at least 1 completed match?
2. Is your `skill_level` set in the `players` table?

---

### **5. Performance Testing**

With many matches:
1. Create 20+ test matches
2. Verify page loads quickly
3. Verify filtering is responsive
4. Check that player names are fetched efficiently (single batch query)

---

### **6. Integration Testing**

Test end-to-end flow:
1. Join a queue session as a player
2. Queue Master assigns you to a match
3. Queue Master completes the match with a score
4. Navigate to /matches
5. Verify the match appears with correct data

---

## 🎯 Success Criteria

✅ Stats card displays correctly with all metrics  
✅ Match cards show complete data (scores, teams, players)  
✅ Filters work (All/Wins/Losses/Draws)  
✅ Player names display (not UUIDs)  
✅ Win/Loss calculated correctly  
✅ Responsive design works on mobile  
✅ Empty states are user-friendly  
✅ Page loads quickly even with many matches  

---

## 📝 Notes

- The matches system integrates with the queue system
- Matches are created when Queue Masters assign players to games
- Only **completed** matches appear (not scheduled or in-progress)
- The system supports both singles and doubles formats
- Future enhancement: ELO rating calculation based on match results

---

## 🐛 Known Limitations

1. **No ELO system yet** - Shows skill level but doesn't adjust based on match results
2. **No match details page** - Clicking a match doesn't open details (could be added)
3. **No casual vs competitive separation** - All matches affect stats equally
4. **No pagination** - Shows all matches at once (may need pagination for users with 100+ matches)

These can be addressed in future iterations if needed.
