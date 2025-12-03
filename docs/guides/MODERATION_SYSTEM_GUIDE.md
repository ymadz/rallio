# Moderation System - Complete Guide

## Overview

The Rallio moderation system allows global admins to review flagged content, manage banned users, and maintain platform quality. This system provides comprehensive tools for content moderation, user management, and activity tracking.

---

## Features Implemented

### 1. Content Moderation Dashboard

**Location:** `/admin/moderation`

**Tabs:**
- **Flagged Reviews**: View and manage court reviews flagged by court admins
- **Banned Users**: View all banned users with unban capabilities
- **Recent Activity**: Audit log of all moderation actions (last 30 days)

**Statistics Cards:**
- Pending Flags (reviews awaiting moderation)
- Resolved Flags (reviews that have been moderated)
- Total Flagged (all flagged reviews)
- Banned Users (current banned user count)
- Recent Actions (moderation actions in last 30 days)

### 2. Flagged Review Management

**Features:**
- View all flagged reviews with full context
- See flag reason provided by court admin
- View user information (name, email, avatar)
- See venue and court details
- Filter by status (Pending, Resolved, Dismissed, All)
- Batch selection and bulk delete
- Individual review actions:
  - **Dismiss Flag**: Remove flag without deleting (no violation found)
  - **Delete Review**: Permanently remove the review
  - **Ban User**: Ban the user who created the review

**Review Details:**
- Star rating (1-5)
- Full review text
- Flag reason and timestamp
- User information
- Venue and court name

### 3. User Ban Management

**Ban Actions:**
- Ban users from flagged review context
- Manual ban from user management
- Stores ban reason and timestamp
- Sets `is_banned = true` and `is_active = false`

**Unban Functionality:**
- View all banned users
- See ban reason and date
- Unban with optional notes
- Restores `is_active = true`

### 4. Activity Logging

All moderation actions are logged to `admin_audit_logs`:
- Content moderation decisions
- Review deletions
- User bans/unbans
- Includes admin who performed action
- Timestamp and metadata (reason, notes)

---

## Database Changes (Migration 023)

### New Columns

**court_ratings.metadata** (JSONB)
```json
{
  "flags": [
    {
      "flaggedBy": "user_id",
      "reason": "Inappropriate language",
      "flaggedAt": "2025-12-01T10:30:00Z"
    }
  ],
  "flagged": true,
  "moderationResolved": false,
  "moderationDismissed": false,
  "moderationResolvedBy": "admin_id",
  "moderationResolvedAt": "2025-12-01T11:00:00Z",
  "moderationNotes": "Dismissed - no violation found"
}
```

**player_ratings.metadata** (JSONB)
- Same structure as court_ratings
- For future player rating moderation

**profiles.is_banned** (BOOLEAN)
- Default: `false`
- Set to `true` when user is banned
- Indexed for performance

### Indexes Created

```sql
-- Flagged content query optimization
CREATE INDEX idx_court_ratings_metadata_flagged 
ON court_ratings ((metadata->>'flagged')) 
WHERE metadata->>'flagged' = 'true';

-- Banned users query optimization
CREATE INDEX idx_profiles_banned 
ON profiles(is_banned) 
WHERE is_banned = true;

-- GIN indexes for metadata queries
CREATE INDEX idx_court_ratings_metadata ON court_ratings USING gin(metadata);
CREATE INDEX idx_player_ratings_metadata ON player_ratings USING gin(metadata);
```

---

## Server Actions

**File:** `/web/src/app/actions/global-admin-moderation-actions.ts`

### Functions

#### 1. `getFlaggedReviews(filters?)`
Get all flagged court reviews for moderation.

**Parameters:**
- `filters.status`: 'pending' | 'resolved' | 'dismissed'
- `filters.orderBy`: 'newest' | 'oldest' | 'rating'

**Returns:**
```typescript
{
  success: true,
  reviews: [
    {
      id: string
      overall_rating: number
      review: string
      metadata: { flags: [...], flagged: true }
      user: { id, display_name, email, avatar_url }
      court: { id, name, venue: { id, name, owner_id } }
    }
  ]
}
```

#### 2. `getModerationStats()`
Get comprehensive moderation statistics.

**Returns:**
```typescript
{
  success: true,
  stats: {
    pendingFlags: number
    totalFlagged: number
    resolvedFlags: number
    bannedUsers: number
    recentActions: number // Last 30 days
  }
}
```

#### 3. `resolveFlaggedReview(reviewId, action, notes?)`
Take action on a flagged review.

**Parameters:**
- `reviewId`: UUID of the review
- `action`: 'dismiss' | 'delete' | 'ban_user'
- `notes`: Optional notes explaining the decision

**Actions:**
- **dismiss**: Remove flag, keep review, mark as no violation
- **delete**: Permanently delete the review
- **ban_user**: Ban the user who created the review

**Audit Logging:**
- CONTENT_MODERATION (for dismiss)
- REVIEW_DELETE (for delete)
- USER_BAN (for ban_user)

#### 4. `getBannedUsers()`
Get all banned users with metadata.

**Returns:**
```typescript
{
  success: true,
  users: [
    {
      id: string
      email: string
      display_name: string
      avatar_url?: string
      metadata: {
        banned_at: string
        banned_by: string
        ban_reason: string
      }
    }
  ]
}
```

#### 5. `unbanUser(userId, notes?)`
Unban a previously banned user.

**Parameters:**
- `userId`: UUID of the user to unban
- `notes`: Optional notes explaining the unban

**Actions:**
- Sets `is_banned = false`, `is_active = true`
- Stores unban metadata (unbanned_at, unbanned_by, notes)
- Logs USER_UNBAN action

#### 6. `getRecentModerationActivity(limit?)`
Get recent moderation actions from audit log.

**Parameters:**
- `limit`: Number of activities to return (default: 20)

**Returns:** Array of audit log entries with admin details

#### 7. `batchDeleteReviews(reviewIds, reason)`
Delete multiple flagged reviews at once.

**Parameters:**
- `reviewIds`: Array of review UUIDs
- `reason`: Reason for batch deletion

---

## UI Components

### ModerationDashboard Component

**Location:** `/web/src/components/global-admin/moderation-dashboard.tsx`

**Features:**
- Tab-based interface (Flagged Reviews, Banned Users, Activity)
- Real-time statistics cards
- Status filtering (Pending, Resolved, Dismissed, All)
- Batch selection with checkboxes
- Modal for reviewing individual flagged content
- Action buttons (Dismiss, Delete, Ban)
- Recent activity timeline

**State Management:**
- `activeTab`: Current tab view
- `flaggedReviews`: List of flagged reviews
- `bannedUsers`: List of banned users
- `selectedReviews`: Set of selected review IDs for batch operations
- `selectedReview`: Currently open review in modal
- `actionNotes`: Notes for moderation action

**UI Elements:**
- Purple theme matching global admin interface
- Lucide React icons
- Responsive grid layout
- Toast notifications (via alert for now)
- Loading states with spinner

---

## How Court Admins Flag Reviews

**Location:** Court Admin Reviews Management

Court admins can flag reviews using the existing `flagReview()` function:

```typescript
// From court-admin-reviews-actions.ts
await flagReview(reviewId, reason)
```

**Process:**
1. Court admin views review in their reviews management page
2. Clicks "Flag" button and provides reason
3. System adds flag to `metadata.flags` array
4. Sets `metadata.flagged = true`
5. Review appears in Global Admin moderation queue
6. TODO: Create notification for Global Admin

---

## Workflow Examples

### Example 1: Dismissing a Flag (No Violation)

1. Global admin navigates to `/admin/moderation`
2. Sees flagged review in Pending tab
3. Clicks "Review" button
4. Modal opens with review details and flag reason
5. Admin determines no violation occurred
6. Clicks "Dismiss Flag"
7. System sets `metadata.moderationDismissed = true`
8. Logs CONTENT_MODERATION action
9. Review remains visible but no longer flagged
10. Moves to "Dismissed" filter

### Example 2: Deleting a Review (Violation Found)

1. Global admin reviews flagged content
2. Determines review violates content policy
3. Adds notes: "Contains inappropriate language"
4. Clicks "Delete Review"
5. System permanently deletes review from database
6. Logs REVIEW_DELETE action with reason
7. Review removed from all views
8. Stats updated (Resolved count increases)

### Example 3: Banning a User (Severe Violation)

1. Global admin reviews flagged review
2. Determines user has violated terms of service
3. Adds notes: "Repeated harassment and inappropriate content"
4. Clicks "Ban User"
5. System:
   - Sets `profiles.is_banned = true`
   - Sets `profiles.is_active = false`
   - Stores ban metadata (reason, timestamp, admin)
   - Logs USER_BAN action
   - Marks review as resolved
6. User cannot log in or perform actions
7. User appears in "Banned Users" tab
8. Can be unbanned later if needed

### Example 4: Batch Deleting Reviews

1. Global admin selects multiple flagged reviews using checkboxes
2. Clicks "Select All" or individually checks reviews
3. Clicks "Delete Selected" button
4. Prompt asks for deletion reason
5. Enters: "Spam campaign - coordinated fake reviews"
6. System deletes all selected reviews
7. Logs individual REVIEW_DELETE actions for each
8. Stats updated

---

## Testing Checklist

### Pre-Testing Setup

1. **Apply Migration 023**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: backend/supabase/migrations/023_add_metadata_for_moderation.sql
   ```

2. **Create Test Flagged Review**
   ```typescript
   // As Court Admin, flag a review
   await flagReview(reviewId, 'Test flag: Inappropriate language')
   ```

3. **Verify Global Admin Access**
   - Ensure test user has 'global_admin' role in user_roles table

### Test Cases

#### Flagged Reviews Tab
- [ ] View flagged reviews list
- [ ] See all review details (rating, text, user, venue)
- [ ] View flag reason and timestamp
- [ ] Filter by status (Pending, Resolved, Dismissed, All)
- [ ] Select individual reviews with checkbox
- [ ] Select all reviews with "Select All" button
- [ ] See selected count in toolbar
- [ ] Open review modal by clicking "Review"

#### Review Actions
- [ ] Dismiss flag without notes (should work)
- [ ] Dismiss flag with notes (optional)
- [ ] Delete review without notes (should prompt)
- [ ] Delete review with notes
- [ ] Ban user without notes (should prompt)
- [ ] Ban user with notes
- [ ] Cancel action and close modal
- [ ] Verify review disappears after action
- [ ] Verify stats update after action

#### Batch Operations
- [ ] Select multiple reviews
- [ ] Deselect individual reviews
- [ ] Select all, then deselect all
- [ ] Delete selected reviews (provides reason)
- [ ] Verify all selected reviews deleted
- [ ] Verify audit logs created for each

#### Banned Users Tab
- [ ] View list of banned users
- [ ] See ban reason and date
- [ ] Unban user without notes
- [ ] Unban user with notes
- [ ] Verify user removed from banned list
- [ ] Verify user can log in again (test externally)

#### Recent Activity Tab
- [ ] View moderation actions
- [ ] See admin who performed action
- [ ] See action type and target
- [ ] See timestamp
- [ ] See metadata (reason, notes)
- [ ] Verify actions appear in real-time

#### Statistics Cards
- [ ] Pending Flags count accurate
- [ ] Resolved Flags count accurate
- [ ] Total Flagged count accurate
- [ ] Banned Users count accurate
- [ ] Recent Actions (30d) count accurate

#### Error Handling
- [ ] Handle unauthorized access (non-global-admin)
- [ ] Handle missing review ID
- [ ] Handle database errors gracefully
- [ ] Show loading states during actions
- [ ] Disable buttons during processing
- [ ] Show error messages (via alert for now)

---

## Integration Points

### With Court Admin System
- Court admins flag reviews via `flagReview()` action
- Flags appear in Global Admin moderation queue
- Court admins can see if their flag was resolved

### With User Management
- Banned users appear in user management with ban badge
- Can unban from either moderation page or user management
- Ban status affects user login and permissions

### With Audit System
- All moderation actions logged to `admin_audit_logs`
- Includes action type, target, admin, timestamp, metadata
- Visible in both moderation activity and main audit log

### With Analytics
- Moderation stats included in analytics dashboard
- Track moderation volume over time
- Monitor flagged content trends

---

## Future Enhancements

### Notification System (TODO)
- Email notifications to global admins when content is flagged
- In-app notifications for new flags
- Notify court admin when their flag is resolved

### Advanced Filtering
- Filter by flag reason
- Filter by venue/court
- Filter by user
- Date range filtering
- Sort by multiple criteria

### Bulk Actions
- Bulk dismiss flags
- Bulk ban users
- Export moderation reports

### Content Policy Management
- Define content policy rules
- Auto-flag based on keywords
- Sentiment analysis integration

### Appeal System
- Allow banned users to appeal
- Review appeal requests
- Track appeal history

### Reporting Dashboard
- Moderation metrics over time
- Most common flag reasons
- Response time tracking
- Admin performance metrics

---

## API Reference

### Server Action Signatures

```typescript
// Get flagged reviews
getFlaggedReviews(filters?: {
  status?: 'pending' | 'resolved' | 'dismissed'
  orderBy?: 'newest' | 'oldest' | 'rating'
}): Promise<{ success: boolean; reviews?: Review[]; error?: string }>

// Get moderation statistics
getModerationStats(): Promise<{
  success: boolean
  stats?: {
    pendingFlags: number
    totalFlagged: number
    resolvedFlags: number
    bannedUsers: number
    recentActions: number
  }
  error?: string
}>

// Resolve flagged review
resolveFlaggedReview(
  reviewId: string,
  action: 'dismiss' | 'delete' | 'ban_user',
  notes?: string
): Promise<{ success: boolean; message?: string; error?: string }>

// Get banned users
getBannedUsers(): Promise<{
  success: boolean
  users?: BannedUser[]
  error?: string
}>

// Unban user
unbanUser(
  userId: string,
  notes?: string
): Promise<{ success: boolean; message?: string; error?: string }>

// Get recent moderation activity
getRecentModerationActivity(
  limit?: number
): Promise<{
  success: boolean
  activities?: AuditLog[]
  error?: string
}>

// Batch delete reviews
batchDeleteReviews(
  reviewIds: string[],
  reason: string
): Promise<{ success: boolean; message?: string; error?: string }>
```

---

## Troubleshooting

### Reviews Not Appearing in Moderation Queue

**Cause:** Migration 023 not applied, metadata column doesn't exist

**Solution:**
```sql
-- Apply migration 023
-- File: backend/supabase/migrations/023_add_metadata_for_moderation.sql
```

### "Column metadata does not exist" Error

**Cause:** Migration not applied to database

**Solution:**
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `023_add_metadata_for_moderation.sql`
3. Execute the SQL
4. Verify: `SELECT * FROM court_ratings LIMIT 1;` should show metadata column

### Banned Users Can Still Log In

**Cause:** RLS policies may not check `is_banned` status

**Solution:** Add RLS policy check:
```sql
-- Example RLS policy update
CREATE POLICY "Banned users cannot access data" ON table_name
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_banned = false
  )
);
```

### Stats Not Updating

**Cause:** Cache or stale data

**Solution:**
- Refresh page
- Check `revalidatePath('/admin/moderation')` is called
- Verify database counts manually

---

## Summary

The moderation system provides comprehensive tools for global admins to maintain platform quality:

✅ **Flagged review management** with context and actions
✅ **User ban/unban** functionality with reason tracking
✅ **Batch operations** for efficient moderation
✅ **Activity logging** for accountability
✅ **Statistics dashboard** for monitoring
✅ **Migration 023** adds necessary database columns
✅ **Server actions** handle all moderation operations
✅ **UI component** provides intuitive interface

**Key Files:**
- Migration: `backend/supabase/migrations/023_add_metadata_for_moderation.sql`
- Server Actions: `web/src/app/actions/global-admin-moderation-actions.ts`
- Component: `web/src/components/global-admin/moderation-dashboard.tsx`
- Page: `web/src/app/(global-admin)/admin/moderation/page.tsx`

**Next Steps:**
1. Apply Migration 023 to database
2. Test flagging a review as court admin
3. Test all moderation actions as global admin
4. Implement notification system (TODO)
5. Add analytics integration
