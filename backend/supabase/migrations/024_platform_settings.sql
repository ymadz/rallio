-- Migration 024: Platform Settings
-- This migration creates a platform_settings table for configurable platform-wide settings

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS platform_settings CASCADE;

-- Create platform_settings table
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

-- Insert default platform settings
INSERT INTO platform_settings (setting_key, setting_value, description, is_public) VALUES
(
  'platform_fee',
  jsonb_build_object(
    'percentage', 5,
    'enabled', true,
    'description', 'Platform service fee applied to all bookings'
  ),
  'Platform fee percentage applied to all reservations and bookings',
  false
),
(
  'terms_and_conditions',
  jsonb_build_object(
    'content', E'# Terms and Conditions

## 1. Acceptance of Terms
By accessing and using Rallio, you accept and agree to be bound by these terms.

## 2. Court Bookings
- All bookings must be made through the platform
- Payment is required at time of booking
- Cancellations are subject to the refund policy

## 3. User Conduct
- Users must treat facilities and other players with respect
- Inappropriate behavior may result in account suspension
- False or misleading information is prohibited

## 4. Liability
- Rallio is not liable for injuries or accidents during gameplay
- Users participate in activities at their own risk

## 5. Changes to Terms
We reserve the right to modify these terms at any time.',
    'last_updated', '2025-12-01T00:00:00Z'
  ),
  'Platform terms and conditions that users must agree to',
  true
),
(
  'refund_policy',
  jsonb_build_object(
    'content', E'# Refund Policy

## Cancellation Timeframes

### Full Refund (100%)
- Cancellations made 24 hours or more before booking time
- Platform fee is refunded

### Partial Refund (50%)
- Cancellations made 12-24 hours before booking time
- Platform fee is NOT refunded

### No Refund (0%)
- Cancellations made less than 12 hours before booking time
- Late cancellations or no-shows

## Processing Time
- Refunds are processed within 5-7 business days
- Original payment method will be credited

## Exceptions
- Venue closures due to weather or emergencies: Full refund
- Court maintenance issues: Full refund
- Medical emergencies: Case-by-case basis (proof required)

## Contact
For refund inquiries, contact support.',
    'last_updated', '2025-12-01T00:00:00Z'
  ),
  'Platform refund and cancellation policy',
  true
),
(
  'general_settings',
  jsonb_build_object(
    'platform_name', 'Rallio',
    'tagline', 'Find Your Court, Join The Game',
    'maintenance_mode', false,
    'contact_email', 'support@rallio.com',
    'contact_phone', '+63 XXX XXX XXXX'
  ),
  'General platform configuration and contact information',
  false
),
(
  'notification_settings',
  jsonb_build_object(
    'email_notifications', true,
    'sms_notifications', false,
    'push_notifications', true,
    'booking_confirmations', true,
    'payment_receipts', true,
    'admin_alerts', true
  ),
  'Platform-wide notification preferences',
  false
),
(
  'payment_settings',
  jsonb_build_object(
    'currency', 'PHP',
    'currency_symbol', '₱',
    'payment_methods', jsonb_build_array('gcash', 'paymaya', 'card'),
    'min_booking_amount', 100,
    'max_booking_amount', 50000
  ),
  'Payment gateway and currency settings',
  false
);

-- Create index on setting_key for fast lookups
CREATE INDEX idx_platform_settings_key ON platform_settings(setting_key);

-- Create index for public settings
CREATE INDEX idx_platform_settings_public ON platform_settings(is_public) WHERE is_public = true;

-- Add comments
COMMENT ON TABLE platform_settings IS 'Stores platform-wide configurable settings including fees, legal docs, and general config';
COMMENT ON COLUMN platform_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN platform_settings.setting_value IS 'JSONB value allowing flexible schema per setting type';
COMMENT ON COLUMN platform_settings.is_public IS 'Whether this setting can be accessed by non-admin users (e.g., terms, refund policy)';

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Global admins can view all settings
CREATE POLICY "Global admins can view all settings"
  ON platform_settings FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

-- Anyone can view public settings (terms, refund policy)
CREATE POLICY "Public settings are viewable by everyone"
  ON platform_settings FOR SELECT
  USING (is_public = true);

-- Only global admins can update settings
CREATE POLICY "Global admins can update settings"
  ON platform_settings FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'))
  WITH CHECK (has_role(auth.uid(), 'global_admin'));

-- Only global admins can insert settings
CREATE POLICY "Global admins can insert settings"
  ON platform_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'global_admin'));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_timestamp();
