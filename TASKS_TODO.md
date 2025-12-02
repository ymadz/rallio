# Rallio Tasks TODO

> Generated: 2024
> Status: Active Development

---

## 🔴 CRITICAL / MUST HAVE

### 1. Refund Flow & Functionality
- **Priority:** P0 - Critical
- **Status:** ❌ Not Implemented
- **Description:** Implement full refund system for cancelled bookings/reservations
- **Files to modify:**
  - `web/src/app/actions/payment-actions.ts` - Add refund action
  - `web/src/app/api/webhooks/paymongo/route.ts` - Handle refund webhooks
  - `web/src/lib/paymongo/client.ts` - Add refund API methods
  - Database: Create `refunds` table with migration
- **Requirements:**
  - PayMongo refund API integration
  - Partial and full refund support
  - Refund status tracking
  - Email notifications for refund completion
  - Admin approval workflow for manual refunds

---

## 🟠 HIGH PRIORITY - User Features

### 2. Phone Number +63 Prefix
- **Priority:** P1 - High
- **Status:** ⚠️ Partial (validation exists, UI needs work)
- **Description:** Auto-format phone input with +63 (Philippines) prefix
- **Files to modify:**
  - `web/src/app/(auth)/signup/page.tsx` - Add formatted phone input
  - `web/src/components/ui/phone-input.tsx` - Create reusable phone component
  - `shared/src/validations/auth.ts` - Already has +63 pattern
- **Notes:** Validation regex `^(\+63|0)?9\d{9}$` exists in shared utils

### 3. Custom Signup Confirmation Email
- **Priority:** P1 - High
- **Status:** ❌ Not Implemented (using Supabase default)
- **Description:** Brand the confirmation email with Rallio styling
- **Files to modify:**
  - `backend/supabase/config.toml` - Configure email templates
  - Create custom email template with Rallio branding
- **Notes:** Requires Supabase email template customization or custom SMTP

### 4. Profile Photo Upload
- **Priority:** P1 - High
- **Status:** ⚠️ Partial (avatar_url field exists, upload UI missing)
- **Description:** Allow users to upload profile photos
- **Files to modify:**
  - `web/src/app/(main)/profile/page.tsx` - Add upload component
  - `web/src/app/actions/profile-actions.ts` - Already handles avatar_url
  - `web/src/components/profile/avatar-upload.tsx` - Create new component
- **Requirements:**
  - Supabase Storage bucket for avatars
  - Image cropping/resizing
  - File size limits (max 5MB)
  - Supported formats: jpg, png, webp

### 5. Notifications System
- **Priority:** P1 - High
- **Status:** ⚠️ Partial (bell icon exists, no backend)
- **Description:** Implement real notifications with database backing
- **Files to modify:**
  - Database: Create `notifications` table
  - `web/src/app/actions/notification-actions.ts` - Create CRUD actions
  - `web/src/components/notifications/notification-bell.tsx` - Connect to real data
  - `web/src/components/notifications/notification-list.tsx` - Create list view
- **Requirements:**
  - Real-time updates via Supabase Realtime
  - Mark as read functionality
  - Notification categories (booking, queue, system)
  - Push notifications (future: web push API)

### 6. "No Courts Yet" Empty State
- **Priority:** P2 - Medium
- **Status:** ❌ Not Implemented
- **Description:** Show friendly message when venue has no courts
- **Files to modify:**
  - `web/src/app/(main)/courts/[venueId]/page.tsx` - Add empty state
  - `web/src/components/courts/empty-courts-state.tsx` - Create component
- **UI:** Show message + illustration when courts array is empty

### 7. Map Not Displaying Properly
- **Priority:** P2 - Medium
- **Status:** ⚠️ Bug - Needs Investigation
- **Description:** Investigate and fix map display issues
- **Files to check:**
  - `web/src/components/map/venue-map.tsx` - Check dynamic import
  - Ensure `ssr: false` is set for Leaflet components
  - Check CSS imports for Leaflet styles
- **Common fixes:**
  - Import Leaflet CSS in layout
  - Force re-render on mount
  - Handle container resize

### 8. Settings - Delete Account
- **Priority:** P2 - Medium
- **Status:** ❌ Not Implemented
- **Description:** Allow users to delete their account
- **Files to modify:**
  - `web/src/app/(main)/settings/page.tsx` - Add delete section
  - `web/src/app/actions/settings-actions.ts` - Add delete action
  - Use `createServiceClient()` for admin deletion
- **Requirements:**
  - Confirmation modal with email re-entry
  - Cancel active subscriptions/bookings
  - Anonymize historical data (GDPR)
  - 30-day grace period option

### 9. Settings - Change Password
- **Priority:** P2 - Medium
- **Status:** ⚠️ Check if exists
- **Description:** Password change functionality in settings
- **Files to modify:**
  - `web/src/app/(main)/settings/page.tsx`
  - Use `supabase.auth.updateUser({ password })`

### 10. Queue Dashboard - Player Count in Waiting Area
- **Priority:** P2 - Medium
- **Status:** ⚠️ Bug - Needs fix
- **Description:** Show correct count of waiting players
- **Files to check:**
  - `web/src/app/(queue-master)/queue-master/sessions/[id]/page.tsx`
  - `web/src/app/actions/queue-actions.ts`
- **Issue:** Count may not update in real-time

### 11. Status Inconsistency Issues
- **Priority:** P2 - Medium
- **Status:** ⚠️ Bug
- **Description:** Status showing inconsistent across different views
- **Files to check:**
  - Check `revalidatePath()` is called after status updates
  - Ensure `router.refresh()` on client after mutations
  - Check Supabase Realtime subscriptions

### 12. Leave Queue - Payment Status Check
- **Priority:** P2 - Medium
- **Status:** ⚠️ Needs verification
- **Description:** Allow leaving queue only if payment not completed
- **Files to check:**
  - `web/src/app/actions/queue-actions.ts` - `leaveQueueSession`
  - Add payment status check before allowing leave

---

## 🟡 MEDIUM PRIORITY - Court Admin Features

### 13. Navbar Can't Navigate When Clicked
- **Priority:** P1 - High
- **Status:** ⚠️ Bug
- **Description:** Court Admin sidebar navigation not working
- **Files to check:**
  - `web/src/components/court-admin/court-admin-sidebar.tsx`
  - Check Link components and href values
  - Test click event propagation

### 14. Button Colors - Improve Contrast
- **Priority:** P3 - Low
- **Status:** UI Enhancement
- **Description:** Review and improve button color contrast
- **Files to modify:**
  - `web/src/app/globals.css` - Update CSS variables
  - `web/src/components/ui/button.tsx` - Check variants

### 15. Google Maps for Address Input
- **Priority:** P2 - Medium
- **Status:** ❌ Not Implemented
- **Description:** Replace manual address entry with Google Maps Places API
- **Files to modify:**
  - `web/src/components/venue/address-input.tsx` - Create new component
  - Add `@googlemaps/js-api-loader` package
  - Store Google Maps API key in env
- **Requirements:**
  - Autocomplete address search
  - Auto-fill lat/lng from selection
  - Show preview on map

### 16. Longitude/Latitude in Venue Form
- **Priority:** P2 - Medium
- **Status:** ⚠️ Check form
- **Description:** Auto-populate or allow manual entry of coordinates
- **Files to modify:**
  - `web/src/components/venue/venue-form.tsx`
  - Add coordinate fields (hidden or read-only if using Google Maps)

### 17. Edit Venue Not Working
- **Priority:** P1 - High
- **Status:** ⚠️ Bug
- **Description:** Fix venue editing functionality
- **Files to check:**
  - `web/src/app/(court-admin)/court-admin/venues/[id]/edit/page.tsx`
  - `web/src/app/actions/venue-actions.ts` - updateVenue action
  - Check RLS policies for UPDATE on venues

### 18. Typo Fix: "Wating" → "Waiting"
- **Priority:** P3 - Low
- **Status:** Quick fix
- **Description:** Fix spelling error
- **Command:** `grep -r "Wating" web/src/` to find occurrences

---

## 🟡 MEDIUM PRIORITY - Global Admin Features

### 19. Global Admin Navbar Not Navigating
- **Priority:** P1 - High
- **Status:** ⚠️ Bug
- **Description:** Global Admin sidebar navigation not working
- **Files to check:**
  - `web/src/components/global-admin/global-admin-sidebar.tsx`
  - Check Link components and href values

### 20. Moderation Page Access Check
- **Priority:** P2 - Medium
- **Status:** ⚠️ Verify
- **Description:** Verify moderation tools are properly secured
- **Files to check:**
  - `web/src/app/(global-admin)/admin/moderation/page.tsx`
  - `web/src/app/actions/global-admin-moderation-actions.ts`
  - Layout already checks for `global_admin` role

---

## 🟡 MEDIUM PRIORITY - Queue Master Features

### 21. Schedule Must Match Court Availability
- **Priority:** P1 - High
- **Status:** ⚠️ Needs implementation
- **Description:** Validate queue session times against court operating hours
- **Files to modify:**
  - `web/src/app/actions/queue-actions.ts` - Add validation in createQueueSession
  - Fetch court availability before allowing session creation
  - Show available time slots to queue master

### 22. Player Count Fix on Dashboard
- **Priority:** P2 - Medium
- **Status:** ⚠️ Bug
- **Description:** Same as #10 - ensure accurate player counts
- **Related to:** Task #10

### 23. Assign Match Not Working
- **Priority:** P1 - High
- **Status:** ⚠️ Bug
- **Description:** Fix match assignment functionality
- **Files to check:**
  - `web/src/app/(queue-master)/queue-master/sessions/[id]/page.tsx`
  - `web/src/app/actions/queue-actions.ts` - assignMatch action
  - Check if players are properly selected

### 24. Session Summary After Closing
- **Priority:** P2 - Medium
- **Status:** ⚠️ Check if exists
- **Description:** Show summary statistics when closing a queue session
- **Files to check:**
  - `web/src/app/actions/queue-actions.ts` - closeQueueSession
  - Create summary modal/page showing:
    - Total players
    - Total matches played
    - Duration
    - Revenue generated

---

## 🟢 LOW PRIORITY - Global Features

### 25. Update Logo Throughout App
- **Priority:** P3 - Low
- **Status:** UI Enhancement
- **Description:** Update Rallio logo/branding
- **Files to modify:**
  - `web/public/` - Add logo files
  - `web/src/components/layout/main-nav.tsx` - Update logo
  - `web/src/components/court-admin/court-admin-sidebar.tsx`
  - `web/src/components/global-admin/global-admin-sidebar.tsx`
  - Update favicon

### 26. Resend Verification Email
- **Priority:** P2 - Medium
- **Status:** ✅ Already Implemented
- **Location:** `web/src/app/(auth)/verify-email/page.tsx`
- **Notes:** Uses `supabase.auth.resend({ type: 'signup', email })`

### 27. Role-Based Redirects After Login
- **Priority:** P2 - Medium
- **Status:** ⚠️ Partial
- **Description:** Redirect users to appropriate dashboard based on role
- **Files to modify:**
  - `web/src/app/auth/callback/route.ts`
  - `middleware.ts`
- **Logic:**
  - global_admin → /admin
  - court_admin → /court-admin
  - queue_master → /queue-master
  - player → /home

### 28. Terms of Service Page
- **Priority:** P3 - Low
- **Status:** ⚠️ Partial (page exists, needs content)
- **Location:** `web/src/app/terms/page.tsx`
- **Todo:** Add actual legal content

### 29. Privacy Policy Page
- **Priority:** P3 - Low
- **Status:** ❌ Check if exists
- **Todo:** Create `web/src/app/privacy/page.tsx` with content

---

## 📋 Task Summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 Critical | 1 | Refund system |
| P1 High | 9 | Core functionality bugs |
| P2 Medium | 12 | Feature improvements |
| P3 Low | 4 | UI/Polish |

---

## 🚀 Suggested Implementation Order

### Phase 1 - Critical Fixes (Week 1)
1. ❌ Refund Flow (#1)
2. ⚠️ Court Admin Navbar (#13)
3. ⚠️ Global Admin Navbar (#19)
4. ⚠️ Edit Venue Fix (#17)
5. ⚠️ Assign Match Fix (#23)

### Phase 2 - User Experience (Week 2)
6. ⚠️ Phone +63 Prefix (#2)
7. ❌ Profile Photo Upload (#4)
8. ⚠️ Notifications System (#5)
9. ⚠️ Role-Based Redirects (#27)
10. ⚠️ Schedule Validation (#21)

### Phase 3 - Polish (Week 3)
11. ❌ Custom Signup Email (#3)
12. ⚠️ Google Maps Integration (#15)
13. ⚠️ Session Summary (#24)
14. ❌ Delete Account (#8)
15. All remaining P3 tasks

---

## Legend

- ❌ Not Implemented
- ⚠️ Partial / Bug / Needs Work
- ✅ Already Done
- 🔄 In Progress

---

*Last Updated: Auto-generated*
