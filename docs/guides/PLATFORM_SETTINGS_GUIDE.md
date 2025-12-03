# Platform Settings System - Complete Guide

## Overview

The platform settings system provides global admins with comprehensive control over platform-wide configuration including fees, legal documents, notifications, and payment settings.

---

## Features

### 1. General Settings
- **Platform Information**: Name, tagline, branding
- **Maintenance Mode**: Temporarily disable platform access
- **Contact Information**: Email and phone support contacts

### 2. Platform Fees
- **Configurable Percentage**: Set platform service fee (0-100%)
- **Enable/Disable**: Toggle fee application
- **Description**: Custom fee description
- **Automatic Calculation**: Fee automatically added to all bookings

### 3. Legal Documents
- **Terms and Conditions**: Full markdown editor
- **Refund Policy**: Customizable cancellation policies
- **Public Access**: Legal docs accessible at `/terms` and `/refund-policy`
- **Version Tracking**: Last updated timestamps

### 4. Notifications
- **Email Notifications**: Toggle email alerts
- **SMS Notifications**: Control SMS messaging
- **Push Notifications**: Mobile app push settings
- **Booking Confirmations**: Auto-send booking confirmations
- **Payment Receipts**: Receipt delivery settings
- **Admin Alerts**: Important event notifications

### 5. Payment Settings
- **Currency Configuration**: Set currency (PHP, USD, etc.)
- **Currency Symbol**: Display symbol (₱, $, etc.)
- **Payment Methods**: Enable/disable GCash, PayMaya, Card, Bank Transfer
- **Booking Limits**: Min and max booking amounts

---

## Database Structure

### Migration 024: platform_settings Table

```sql
CREATE TABLE platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key varchar(100) UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}',
  description text,
  is_public boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Default Settings

**platform_fee**
```json
{
  "percentage": 5,
  "enabled": true,
  "description": "Platform service fee applied to all bookings"
}
```

**terms_and_conditions**
```json
{
  "content": "# Terms and Conditions\n\n...",
  "last_updated": "2025-12-01T00:00:00Z"
}
```

**refund_policy**
```json
{
  "content": "# Refund Policy\n\n...",
  "last_updated": "2025-12-01T00:00:00Z"
}
```

**general_settings**
```json
{
  "platform_name": "Rallio",
  "tagline": "Find Your Court, Join The Game",
  "maintenance_mode": false,
  "contact_email": "support@rallio.com",
  "contact_phone": "+63 XXX XXX XXXX"
}
```

**notification_settings**
```json
{
  "email_notifications": true,
  "sms_notifications": false,
  "push_notifications": true,
  "booking_confirmations": true,
  "payment_receipts": true,
  "admin_alerts": true
}
```

**payment_settings**
```json
{
  "currency": "PHP",
  "currency_symbol": "₱",
  "payment_methods": ["gcash", "paymaya", "card"],
  "min_booking_amount": 100,
  "max_booking_amount": 50000
}
```

---

## Server Actions

### Admin Actions (global-admin-settings-actions.ts)

#### 1. `getAllPlatformSettings()`
Get all platform settings (admin only).

**Returns:**
```typescript
{
  success: true,
  settings: {
    platform_fee: { percentage, enabled, description },
    general_settings: { platform_name, tagline, ... },
    terms_and_conditions: { content, last_updated },
    refund_policy: { content, last_updated },
    notification_settings: { ... },
    payment_settings: { ... }
  }
}
```

#### 2. `getPublicSettings(settingKey?)`
Get public settings (no auth required).

**Parameters:**
- `settingKey`: Optional specific setting key

**Returns:** Setting data for terms, refund policy, etc.

#### 3. `updatePlatformFee(percentage, enabled, description?)`
Update platform fee configuration.

**Parameters:**
- `percentage`: Fee percentage (0-100)
- `enabled`: Enable/disable fee
- `description`: Optional description

#### 4. `updateTermsAndConditions(content)`
Update terms and conditions.

**Parameters:**
- `content`: Markdown content

#### 5. `updateRefundPolicy(content)`
Update refund policy.

**Parameters:**
- `content`: Markdown content

#### 6. `updateGeneralSettings(settings)`
Update general platform settings.

**Parameters:**
```typescript
{
  platform_name?: string
  tagline?: string
  maintenance_mode?: boolean
  contact_email?: string
  contact_phone?: string
}
```

#### 7. `updateNotificationSettings(settings)`
Update notification preferences.

#### 8. `updatePaymentSettings(settings)`
Update payment configuration.

#### 9. `calculatePlatformFee(amount)`
Calculate platform fee for a given amount.

**Parameters:**
- `amount`: Booking amount

**Returns:**
```typescript
{
  success: true,
  platformFee: 50,        // Fee amount
  subtotal: 1000,          // Original amount
  total: 1050,             // Amount + fee
  feePercentage: 5         // Fee percentage
}
```

---

## UI Components

### PlatformSettingsDashboard

**Location:** `/web/src/components/global-admin/platform-settings-dashboard.tsx`

**Tabs:**
1. **General**: Platform info, maintenance mode, contact details
2. **Fees**: Platform fee percentage and settings
3. **Legal**: Terms and conditions, refund policy editors
4. **Notifications**: Email, SMS, push notification toggles
5. **Payment**: Currency, payment methods, booking limits

**Features:**
- Real-time form updates
- Success/error message banners
- Loading states
- Markdown editors for legal docs
- Toggle switches for boolean settings
- Number inputs with validation
- Save buttons per section

---

## Public Pages

### Terms and Conditions Page
**Route:** `/terms`
**File:** `/web/src/app/terms/page.tsx`

- Server-side rendered
- Markdown content display
- Last updated timestamp
- No authentication required

### Refund Policy Page
**Route:** `/refund-policy`
**File:** `/web/src/app/refund-policy/page.tsx`

- Server-side rendered
- Markdown content display
- Last updated timestamp
- No authentication required

---

## Platform Fee Integration

### Fee Calculation Flow

1. **User selects court and time**
2. **Base price calculated** (court hourly rate × hours)
3. **Platform fee calculated** using `calculatePlatformFee()`
4. **Total displayed** in booking summary

### Fee Breakdown Display

```
Court Booking Fee:     ₱1,000.00
Platform Service Fee:      ₱50.00  (5%)
───────────────────────────────────
Total Amount:          ₱1,050.00
```

### Integration Points

**Booking Flow:**
- Court selection page
- Booking summary modal
- Payment page
- Confirmation email
- Receipt display

**Admin Features:**
- Venue pricing setup
- Reservation management
- Financial reports
- Revenue analytics

---

## RLS Policies

### View Permissions

**Global Admins:**
```sql
CREATE POLICY "Global admins can view all settings"
  ON platform_settings FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));
```

**Public Settings:**
```sql
CREATE POLICY "Public settings are viewable by everyone"
  ON platform_settings FOR SELECT
  USING (is_public = true);
```

### Update Permissions

**Only Global Admins:**
```sql
CREATE POLICY "Global admins can update settings"
  ON platform_settings FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'))
  WITH CHECK (has_role(auth.uid(), 'global_admin'));
```

---

## Testing Guide

### Apply Migration

```bash
# Via Supabase Dashboard SQL Editor
# Copy contents of: backend/supabase/migrations/024_platform_settings.sql
# Execute in SQL Editor
```

### Test Admin Settings

1. **Navigate** to `/admin/settings`
2. **Test General Tab**:
   - Update platform name
   - Toggle maintenance mode
   - Update contact info
   - Click Save
3. **Test Fees Tab**:
   - Change fee percentage
   - Toggle enable/disable
   - Add description
   - Click Save
4. **Test Legal Tab**:
   - Edit terms and conditions (Markdown)
   - Edit refund policy (Markdown)
   - Click Save for each
5. **Test Notifications Tab**:
   - Toggle various notification types
   - Click Save
6. **Test Payment Tab**:
   - Change currency
   - Toggle payment methods
   - Update min/max amounts
   - Click Save

### Test Public Pages

1. **Visit** `/terms`
   - Verify content displays
   - Check last updated date
   - No auth required
2. **Visit** `/refund-policy`
   - Verify content displays
   - Check last updated date
   - No auth required

### Test Fee Calculation

```typescript
// In booking flow or console
const result = await calculatePlatformFee(1000)
console.log(result)
// {
//   platformFee: 50,
//   subtotal: 1000,
//   total: 1050,
//   feePercentage: 5
// }
```

---

## Workflow Examples

### Example 1: Updating Platform Fee

1. Global admin navigates to `/admin/settings`
2. Clicks "Platform Fees" tab
3. Changes percentage from 5% to 7%
4. Adds description: "Updated to cover payment processing"
5. Clicks "Save Platform Fee"
6. System logs change to `admin_audit_logs`
7. New bookings use 7% fee
8. Confirmation message appears

### Example 2: Updating Terms and Conditions

1. Global admin clicks "Legal" tab
2. Edits terms in Markdown editor
3. Adds new section about data privacy
4. Clicks "Save Terms and Conditions"
5. System updates `last_updated` timestamp
6. Changes reflected at `/terms` immediately
7. Audit log created

### Example 3: User Views Refund Policy

1. User anywhere on platform clicks "Refund Policy" link
2. Navigates to `/refund-policy`
3. Sees full policy with last updated date
4. No login required
5. Can copy/print policy

---

## Future Enhancements

### Additional Settings
- Logo and branding uploads
- Theme customization (colors, fonts)
- Email template editor
- SMS template editor
- Social media links
- SEO settings (meta tags, descriptions)

### Advanced Features
- Multi-language support
- A/B testing for fees
- Dynamic fee rules (time-based, user-based)
- Promotional discount codes
- Seasonal pricing adjustments

### Integration Points
- Webhook configuration
- Third-party API keys
- Analytics integration
- Payment gateway credentials
- SMS provider settings

---

## API Reference

### Server Action Signatures

```typescript
// Get all settings (admin)
getAllPlatformSettings(): Promise<{
  success: boolean
  settings?: Record<string, any>
  error?: string
}>

// Get public settings
getPublicSettings(settingKey?: string): Promise<{
  success: boolean
  data?: any
  error?: string
}>

// Update platform fee
updatePlatformFee(
  percentage: number,
  enabled: boolean,
  description?: string
): Promise<{ success: boolean; message?: string; error?: string }>

// Update terms
updateTermsAndConditions(
  content: string
): Promise<{ success: boolean; message?: string; error?: string }>

// Update refund policy
updateRefundPolicy(
  content: string
): Promise<{ success: boolean; message?: string; error?: string }>

// Calculate platform fee
calculatePlatformFee(amount: number): Promise<{
  success: boolean
  platformFee?: number
  subtotal?: number
  total?: number
  feePercentage?: number
  error?: string
}>
```

---

## Summary

✅ **Migration 024** creates `platform_settings` table
✅ **6 default settings** preloaded (fees, legal, general, notifications, payment)
✅ **Admin dashboard** with 5 tabs for complete configuration
✅ **Public pages** for terms and refund policy at `/terms` and `/refund-policy`
✅ **Fee calculation** function for booking integration
✅ **Audit logging** for all setting changes
✅ **RLS policies** for security (admin-only updates, public reads for legal docs)
✅ **Markdown support** for legal documents

**Key Files:**
- Migration: `backend/supabase/migrations/024_platform_settings.sql`
- Server Actions: `web/src/app/actions/global-admin-settings-actions.ts`
- Component: `web/src/components/global-admin/platform-settings-dashboard.tsx`
- Admin Page: `web/src/app/(global-admin)/admin/settings/page.tsx`
- Public Pages: `web/src/app/terms/page.tsx`, `web/src/app/refund-policy/page.tsx`

**Next Steps:**
1. Apply Migration 024
2. Test admin settings interface
3. Integrate `calculatePlatformFee()` into booking flow
4. Update booking UI to show fee breakdown
5. Link to `/terms` and `/refund-policy` in footer and booking pages
