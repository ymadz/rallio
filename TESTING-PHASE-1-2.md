# Testing Guide: Phase 1 & Phase 2

This document provides comprehensive testing procedures for Phase 1 (UI Routing Fixes) and Phase 2 (In-App Notification System).

---

## Prerequisites

Before testing, ensure:

1. **Development server is running:**
   ```bash
   npm run dev:web
   ```

2. **Database migrations are applied:**
   ```bash
   # Check if migration 012 is applied
   npx supabase migration list

   # If not applied, run:
   psql -h [your-db-host] -U postgres -d postgres -f backend/supabase/migrations/012_queue_session_approval_workflow.sql
   ```

3. **Test user accounts exist:**
   - Court Admin user (has `court_admin` role and owns at least one venue)
   - Regular player user (for triggering notifications)

---

## Phase 1: UI Routing & VenueSelector Testing

### Overview
Phase 1 fixed the critical UI bug where Analytics, Pricing, Availability, and Reviews pages couldn't function because they weren't receiving the required `venueId` prop.

### Files Modified
- Created: `/web/src/components/court-admin/venue-selector.tsx`
- Updated: 4 Court Admin pages (analytics, pricing, availability, reviews)

---

### Test 1: VenueSelector - Single Venue Auto-Selection

**Scenario:** Court Admin with only ONE venue should auto-select it

**Steps:**
1. Log in as Court Admin who owns exactly 1 venue
2. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ No venue selector shown (auto-selected)
- ✅ Analytics dashboard displays immediately with venue data
- ✅ URL shows `?venueId=[venue-id]`
- ✅ Charts and statistics populate with real data

**Pass Criteria:** Dashboard shows immediately without requiring manual selection

---

### Test 2: VenueSelector - Multiple Venue Selection

**Scenario:** Court Admin with MULTIPLE venues must select one

**Steps:**
1. Log in as Court Admin who owns 2+ venues
2. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ VenueSelector component displays
- ✅ Shows message: "Select a venue to view analytics"
- ✅ Dropdown lists all owned venues with city names
- ✅ Counter shows "You have X venues"

**Pass Criteria:** Selector displays correctly with all venues listed

---

### Test 3: Venue Selection & URL Persistence

**Scenario:** Selecting a venue should update URL and persist across navigation

**Steps:**
1. From VenueSelector, choose "Venue A" from dropdown
2. Verify URL updates to `?venueId=[id]`
3. Analytics dashboard loads with Venue A's data
4. Navigate to `/court-admin/pricing`
5. Select "Venue B" from dropdown
6. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ Step 2: URL updates immediately on selection
- ✅ Step 3: Correct venue data displayed
- ✅ Step 5: URL updates to Venue B's ID
- ✅ Step 6: Analytics still shows Venue A (last selected for that page)

**Pass Criteria:** URL param persists per page, correct data loads

---

### Test 4: VenueSelector - Empty State

**Scenario:** Court Admin with NO venues should see creation prompt

**Steps:**
1. Create new Court Admin user (or remove all venues from test user)
2. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ Shows empty state with building icon
- ✅ Message: "No Venues Yet"
- ✅ Explanation: "You need to create a venue before you can access this feature"
- ✅ Button: "Create Your First Venue"
- ✅ Clicking button navigates to `/court-admin/venues`

**Pass Criteria:** User guided to create venue before accessing features

---

### Test 5: All Four Pages Use VenueSelector

**Scenario:** Verify pattern works across all updated pages

**Steps:**
For EACH page below, perform Test 2 (multiple venue selection):
- `/court-admin/analytics`
- `/court-admin/pricing`
- `/court-admin/availability`
- `/court-admin/reviews`

**Expected Results for EACH:**
- ✅ VenueSelector appears with appropriate message
- ✅ After selection, component loads with venue data
- ✅ URL contains `?venueId=[id]`

**Pass Criteria:** All 4 pages work identically with VenueSelector

---

### Test 6: Loading States

**Scenario:** Verify loading indicators work correctly

**Steps:**
1. Open DevTools Network tab
2. Throttle to "Slow 3G"
3. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ Shows loading spinner
- ✅ Text: "Loading venues..."
- ✅ No errors in console
- ✅ After load, shows VenueSelector or dashboard

**Pass Criteria:** Graceful loading state, no crashes

---

### Test 7: Mobile Responsiveness

**Scenario:** VenueSelector works on mobile devices

**Steps:**
1. Open DevTools and toggle device toolbar (mobile view)
2. Navigate to `/court-admin/analytics`
3. Select venue from dropdown

**Expected Results:**
- ✅ Dropdown is tappable and scrollable
- ✅ Text is readable (not cut off)
- ✅ Selection works correctly
- ✅ Layout doesn't break

**Pass Criteria:** Fully functional on mobile viewports

---

## Phase 2: In-App Notification System Testing

### Overview
Phase 2 implements a real-time notification system with Supabase subscriptions, notification bell, dropdown list, and server-side notification creation.

### Files Created
- `/web/src/types/notifications.ts`
- `/web/src/app/actions/notification-actions.ts`
- `/web/src/hooks/useNotifications.ts`
- `/web/src/components/notifications/notification-bell.tsx`
- `/web/src/components/notifications/notification-list.tsx`
- `/web/src/components/notifications/notification-item.tsx`

### Files Modified
- `/web/src/app/(court-admin)/layout.tsx` (added NotificationBell to header)

---

### Test 8: Notification Bell Visibility

**Scenario:** Notification bell appears in Court Admin header

**Steps:**
1. Log in as Court Admin
2. Navigate to `/court-admin` (dashboard)

**Expected Results:**
- ✅ Bell icon visible in top-right header
- ✅ Bell is clickable
- ✅ No unread badge initially (or shows correct count)

**Pass Criteria:** Bell icon present and clickable

---

### Test 9: Empty Notification State

**Scenario:** User with no notifications sees empty state

**Steps:**
1. Log in as Court Admin with no notifications in database
2. Click notification bell

**Expected Results:**
- ✅ Dropdown appears below bell
- ✅ Shows checkmark icon
- ✅ Message: "All caught up!"
- ✅ Subtext: "You have no notifications"
- ✅ "Close" button at bottom

**Pass Criteria:** Empty state is clear and informative

---

### Test 10: Notification Creation (Queue Approval Request)

**Scenario:** Creating a queue session triggers notification for Court Admin

**Setup:**
1. Log in as regular player (NOT court admin)
2. Navigate to queue creation page
3. Create new queue session for a court owned by Court Admin user

**Steps:**
1. Fill out queue session form (select court, time, etc.)
2. Submit queue session
3. Log out and log in as the Court Admin who owns that venue
4. Navigate to `/court-admin`

**Expected Results:**
- ✅ Notification bell shows badge with "1"
- ✅ Badge is red with white text
- ✅ Click bell to open dropdown
- ✅ Shows 1 notification with blue background (unread)
- ✅ Icon: Bell icon (blue)
- ✅ Title: "New Queue Session Approval Request"
- ✅ Message: "[Organizer Name] wants to host a queue session at [Venue] - [Court]"
- ✅ Time: "X seconds/minutes ago"
- ✅ Blue dot on right side indicating unread

**Pass Criteria:** Notification created automatically via database trigger

---

### Test 11: Real-Time Notification (Live Update)

**Scenario:** Notification appears in real-time without page refresh

**Setup:**
1. Log in as Court Admin in Browser A
2. Open notification dropdown and leave it open
3. Log in as player in Browser B (or incognito)

**Steps:**
1. In Browser A: Keep `/court-admin` open with notification dropdown visible
2. In Browser B: Create a queue session for Court Admin's venue
3. Watch Browser A without refreshing

**Expected Results:**
- ✅ Within 1-2 seconds, new notification appears in dropdown (Browser A)
- ✅ Badge count increments from 0 to 1 (or X to X+1)
- ✅ Notification appears at TOP of list
- ✅ No page refresh needed
- ✅ No errors in console

**Pass Criteria:** Real-time update via Supabase subscriptions works

---

### Test 12: Mark Single Notification as Read

**Scenario:** Clicking a notification marks it as read

**Steps:**
1. Have at least 1 unread notification
2. Click notification bell (should show badge)
3. Click on the unread notification in dropdown

**Expected Results:**
- ✅ Blue background disappears (now white)
- ✅ Blue dot on right disappears
- ✅ Badge count decreases by 1
- ✅ If notification has `action_url`, navigates to that URL
- ✅ Notification stays in list (not deleted)

**Pass Criteria:** Visual state changes, badge updates, navigation works

---

### Test 13: Mark All as Read

**Scenario:** "Mark all read" button marks all unread notifications

**Steps:**
1. Have 3+ unread notifications
2. Click notification bell (badge shows "3")
3. Verify header shows "3 unread"
4. Click "Mark all read" button in header

**Expected Results:**
- ✅ All blue backgrounds turn white
- ✅ All blue dots disappear
- ✅ Badge disappears from bell
- ✅ Header text changes from "3 unread" to nothing
- ✅ "Mark all read" button disappears

**Pass Criteria:** All notifications marked read, UI updates correctly

---

### Test 14: Notification Types & Icons

**Scenario:** Different notification types show correct icons and colors

**Test Data Needed:**
Create notifications of different types (via database insert or triggering actions):

```sql
-- Example: Insert test notifications
INSERT INTO notifications (user_id, type, title, message, action_url) VALUES
  ('[court-admin-id]', 'reservation_approved', 'Reservation Approved', 'Your reservation has been confirmed', '/reservations'),
  ('[court-admin-id]', 'reservation_rejected', 'Reservation Rejected', 'Sorry, your reservation was declined', '/reservations'),
  ('[court-admin-id]', 'payment_received', 'Payment Received', 'Payment of ₱500 received', '/court-admin'),
  ('[court-admin-id]', 'queue_approval_request', 'Queue Approval Needed', 'New queue session awaits approval', '/court-admin/approvals');
```

**Expected Icon/Color Mapping:**
| Type | Icon | Color |
|------|------|-------|
| reservation_approved | CheckCircle | Green |
| reservation_rejected | XCircle | Red |
| reservation_cancelled | AlertCircle | Orange |
| queue_approval_request | Bell | Blue |
| queue_approval_approved | CheckCircle | Green |
| queue_approval_rejected | XCircle | Red |
| payment_received | DollarSign | Green |
| match_scheduled | Calendar | Blue |
| rating_received | Star | Yellow |
| general | Bell | Gray |

**Pass Criteria:** Each type displays correct icon and color

---

### Test 15: Notification Dropdown Scroll

**Scenario:** Dropdown scrolls when many notifications exist

**Steps:**
1. Insert 20+ notifications for test user
2. Click notification bell

**Expected Results:**
- ✅ Dropdown has max-height of 600px
- ✅ Shows first ~8-10 notifications
- ✅ Scroll bar appears on right
- ✅ Can scroll to see all notifications
- ✅ Header stays fixed at top
- ✅ "Close" button stays fixed at bottom

**Pass Criteria:** Scrolling works smoothly, header/footer fixed

---

### Test 16: Click Outside to Close

**Scenario:** Clicking outside dropdown closes it

**Steps:**
1. Click notification bell to open dropdown
2. Click anywhere on the page outside the dropdown

**Expected Results:**
- ✅ Dropdown closes immediately
- ✅ No errors in console

**Pass Criteria:** Dropdown closes on outside click

---

### Test 17: Notification Loading State

**Scenario:** Loading spinner shows while fetching notifications

**Steps:**
1. Open DevTools Network tab
2. Throttle to "Slow 3G"
3. Clear browser cache
4. Click notification bell

**Expected Results:**
- ✅ Shows loading spinner (rotating circle)
- ✅ No notifications shown during load
- ✅ After load completes, shows notifications or empty state

**Pass Criteria:** Graceful loading state

---

### Test 18: Notification Time Formatting

**Scenario:** Relative time displays correctly

**Test Data:**
Create notifications at different times:
- Just now (0 minutes)
- 5 minutes ago
- 1 hour ago
- 1 day ago
- 7 days ago

**Expected Results:**
- ✅ "less than a minute ago"
- ✅ "5 minutes ago"
- ✅ "about 1 hour ago"
- ✅ "1 day ago"
- ✅ "7 days ago"

**Pass Criteria:** Uses `date-fns` `formatDistanceToNow` correctly

---

### Test 19: Notification Navigation

**Scenario:** Clicking notification navigates to action URL

**Steps:**
1. Create notification with `action_url = '/court-admin/approvals/[id]'`
2. Click notification bell
3. Click the notification

**Expected Results:**
- ✅ Navigates to the specified URL
- ✅ Dropdown closes
- ✅ Notification marked as read

**Pass Criteria:** Navigation works, dropdown closes

---

### Test 20: Real-Time Update (Delete)

**Scenario:** Deleting a notification via SQL reflects in UI

**Steps:**
1. Have notification dropdown open
2. In another tab, run SQL:
   ```sql
   DELETE FROM notifications WHERE id = '[notification-id]';
   ```
3. Watch dropdown (no refresh)

**Expected Results:**
- ✅ Notification disappears from list in real-time
- ✅ Badge count decreases by 1
- ✅ No console errors

**Pass Criteria:** Real-time deletion works via Supabase subscription

---

### Test 21: Queue Approval Triggers Notification

**Scenario:** Approving a queue session sends notification to organizer

**Setup:**
- Player created a queue session (which sent notification to Court Admin)
- Court Admin is now approving it

**Steps:**
1. Log in as Court Admin
2. Navigate to `/court-admin/approvals`
3. Approve the pending queue session
4. Log out, log in as the player who created the session
5. Check notifications

**Expected Results:**
- ✅ Player sees notification with badge
- ✅ Title: "Queue Session approved"
- ✅ Message: "Your queue session has been approved! You can now start accepting players."
- ✅ Type: `queue_approval_approved`
- ✅ Icon: Green checkmark

**Pass Criteria:** Notification created via database trigger (migration 012)

---

### Test 22: Queue Rejection Triggers Notification

**Scenario:** Rejecting a queue session sends notification with reason

**Steps:**
1. Log in as Court Admin
2. Navigate to `/court-admin/approvals`
3. Reject queue session with reason: "Court maintenance scheduled"
4. Log in as organizer (player)
5. Check notifications

**Expected Results:**
- ✅ Notification shows rejection
- ✅ Title: "Queue Session rejected"
- ✅ Message includes rejection reason: "Reason: Court maintenance scheduled"
- ✅ Icon: Red X

**Pass Criteria:** Rejection reason included in notification

---

### Test 23: Mobile Notification Bell

**Scenario:** Notification bell works on mobile layout

**Steps:**
1. Switch to mobile view (DevTools device toolbar)
2. Log in as Court Admin
3. Click notification bell

**Expected Results:**
- ✅ Bell is tappable
- ✅ Dropdown appears (may adjust position for small screen)
- ✅ Dropdown is scrollable
- ✅ Text is readable
- ✅ All functionality works

**Pass Criteria:** Fully functional on mobile

---

### Test 24: Performance - 100+ Notifications

**Scenario:** App performs well with large notification list

**Steps:**
1. Insert 150 notifications for test user
2. Click notification bell
3. Scroll through list
4. Mark all as read

**Expected Results:**
- ✅ Dropdown opens within 1 second
- ✅ Scrolling is smooth (no lag)
- ✅ "Mark all as read" completes within 2 seconds
- ✅ No browser freeze
- ✅ No console errors

**Pass Criteria:** Handles large dataset gracefully

---

## Integration Testing

### Test 25: Full Workflow - Queue Approval with Notifications

**Scenario:** Complete queue approval workflow with notifications at each step

**Steps:**
1. **Player creates queue session:**
   - Log in as Player
   - Navigate to queue creation
   - Create session for Court Admin's venue
   - Verify: "Request submitted" message

2. **Court Admin receives notification:**
   - Log in as Court Admin
   - Verify: Badge shows "1"
   - Open dropdown
   - Verify: "New Queue Session Approval Request" notification
   - Click notification

3. **Court Admin reviews and approves:**
   - Should navigate to `/court-admin/approvals/[id]`
   - Review session details
   - Click "Approve"
   - Verify: Success message

4. **Player receives approval notification:**
   - Log in as Player
   - Verify: Badge shows "1"
   - Open dropdown
   - Verify: "Queue Session approved" notification
   - Click notification

5. **Player views approved session:**
   - Should navigate to queue session page
   - Verify: Session status shows "approved" or "open"

**Pass Criteria:** Complete flow works end-to-end with real-time notifications

---

## Regression Testing

### Test 26: Existing Features Still Work

**Scenario:** Phase 1 & 2 didn't break existing functionality

**Areas to Test:**
- ✅ Court Admin dashboard loads and displays stats
- ✅ Reservations page works
- ✅ Venue management (create/edit/delete) works
- ✅ Court creation/editing works
- ✅ User authentication and logout work
- ✅ Navigation between pages works
- ✅ Mobile bottom nav works

**Pass Criteria:** No regressions, all existing features functional

---

## Error Handling Tests

### Test 27: Network Error Handling

**Scenario:** Graceful handling when network fails

**Steps:**
1. Open DevTools
2. Go to Network tab, enable "Offline"
3. Click notification bell

**Expected Results:**
- ✅ Shows error message (not crash)
- ✅ Error text is user-friendly
- ✅ Can close dropdown and try again

**Pass Criteria:** No crashes, clear error messages

---

### Test 28: Unauthorized Access

**Scenario:** Non-court-admin can't access Court Admin pages

**Steps:**
1. Log in as regular player (no court_admin role)
2. Navigate to `/court-admin/analytics`

**Expected Results:**
- ✅ Redirects to `/` (home)
- ✅ No crash or error page

**Pass Criteria:** Proper access control maintained

---

## Browser Compatibility

### Test 29: Cross-Browser Testing

**Browsers to Test:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest, macOS)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Mobile Chrome (Android)

**Features to Verify:**
- VenueSelector dropdown works
- Notification bell and dropdown work
- Real-time updates work
- Styles render correctly

**Pass Criteria:** All features work in all browsers

---

## Accessibility Tests

### Test 30: Keyboard Navigation

**Scenario:** Full functionality using keyboard only

**Steps:**
1. Use Tab to navigate to notification bell
2. Press Enter to open dropdown
3. Use arrow keys to navigate notifications
4. Press Enter to select notification
5. Use Escape to close dropdown

**Expected Results:**
- ✅ Can reach bell with Tab
- ✅ Enter opens/closes dropdown
- ✅ Focus indicators visible
- ✅ Escape closes dropdown

**Pass Criteria:** Full keyboard accessibility

---

### Test 31: Screen Reader

**Scenario:** Screen reader announces notifications correctly

**Steps:**
1. Enable screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate to notification bell
3. Open dropdown

**Expected Results:**
- ✅ Bell has `aria-label="Notifications"`
- ✅ Badge count announced
- ✅ Notification titles and messages read correctly
- ✅ Unread state announced

**Pass Criteria:** Accessible to screen reader users

---

## Known Limitations & Future Improvements

### Current Limitations:
1. **Notification Pagination:** Currently loads all notifications (max 50). For users with 1000+ notifications, pagination should be added.
2. **Notification Deletion:** No UI to delete individual notifications (only via SQL).
3. **Notification Settings:** No preference panel to control notification types.
4. **Push Notifications:** Only in-app, no browser push or email.

### Future Enhancements:
- Add notification preferences page
- Implement notification grouping (e.g., "5 new reservations")
- Add notification sounds/vibrations
- Email digests for unread notifications
- Delete/archive functionality in UI

---

## Test Summary Checklist

Use this checklist to track testing progress:

### Phase 1 (VenueSelector):
- [ ] Test 1: Single venue auto-selection
- [ ] Test 2: Multiple venue selection
- [ ] Test 3: URL persistence
- [ ] Test 4: Empty state
- [ ] Test 5: All four pages
- [ ] Test 6: Loading states
- [ ] Test 7: Mobile responsiveness

### Phase 2 (Notifications):
- [ ] Test 8: Bell visibility
- [ ] Test 9: Empty state
- [ ] Test 10: Queue approval creation
- [ ] Test 11: Real-time updates (insert)
- [ ] Test 12: Mark single as read
- [ ] Test 13: Mark all as read
- [ ] Test 14: Icon/color types
- [ ] Test 15: Dropdown scroll
- [ ] Test 16: Click outside to close
- [ ] Test 17: Loading state
- [ ] Test 18: Time formatting
- [ ] Test 19: Navigation
- [ ] Test 20: Real-time delete
- [ ] Test 21: Approval notification
- [ ] Test 22: Rejection notification
- [ ] Test 23: Mobile bell
- [ ] Test 24: Performance (100+)
- [ ] Test 25: Full workflow
- [ ] Test 26: No regressions
- [ ] Test 27: Network error handling
- [ ] Test 28: Unauthorized access
- [ ] Test 29: Cross-browser
- [ ] Test 30: Keyboard navigation
- [ ] Test 31: Screen reader

---

## Reporting Issues

When reporting bugs, include:
1. **Test number** (e.g., "Test 11 failed")
2. **Browser & version**
3. **Steps to reproduce**
4. **Expected vs actual result**
5. **Screenshots/console errors**
6. **User role** (Court Admin, Player, etc.)

Example:
```
Test 11 Failed: Real-Time Notification Update

Browser: Chrome 120.0.6099.129
Steps:
1. Opened dropdown in Browser A
2. Created queue in Browser B
3. Waited 30 seconds

Expected: Notification appears in Browser A
Actual: No notification appeared, console shows error:
  "Supabase realtime error: channel already exists"

User: Court Admin (ID: abc123)
Screenshot: attached
```

---

## Quick Start Testing Commands

```bash
# 1. Start development server
npm run dev:web

# 2. Build to check for TypeScript errors
npm run build:web

# 3. Check migration status
npx supabase migration list

# 4. Apply migration 012 (if needed)
psql -h [host] -U postgres -d postgres -f backend/supabase/migrations/012_queue_session_approval_workflow.sql

# 5. Create test notifications (via SQL)
psql -h [host] -U postgres -d postgres
INSERT INTO notifications (user_id, type, title, message, action_url)
VALUES ('[user-id]', 'general', 'Test Notification', 'This is a test', '/court-admin');

# 6. Check real-time subscription setup
# In browser console:
window.localStorage.getItem('supabase.auth.token')
```

---

## Success Criteria Summary

**Phase 1 PASSES if:**
- All 4 pages (Analytics, Pricing, Availability, Reviews) require venue selection
- VenueSelector auto-selects for single venue owners
- URL params persist correctly
- Empty state directs to venue creation

**Phase 2 PASSES if:**
- Notification bell appears in Court Admin header
- Real-time notifications work (no refresh needed)
- Mark as read functionality works
- Queue approval/rejection triggers notifications
- All notification types show correct icons
- Mobile and desktop layouts work

**OVERALL PASS:**
- Zero console errors
- No TypeScript build errors
- All 31 tests pass
- No regressions in existing features
