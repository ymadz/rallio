-- Migration 019: Global Admin Elevation Policies & Foundation
-- Created: December 1, 2025
-- Purpose: Create global admin infrastructure with RLS policies, audit logging, and ban system

-- ============================================================================
-- PART 1: Helper Functions
-- ============================================================================

-- Create has_role() helper function for RLS policies
CREATE OR REPLACE FUNCTION has_role(p_user_id uuid, p_role_name text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = p_role_name
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 2: Admin Audit Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type varchar(50) NOT NULL,
  target_type varchar(50),
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit log queries
CREATE INDEX idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_type, target_id);

-- RLS for audit logs (only global admins can view)
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins view all audit logs"
  ON admin_audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins insert audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'global_admin'));

-- ============================================================================
-- PART 3: Ban/Suspend System
-- ============================================================================

-- Add ban fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_by uuid REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Add approval status to venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Update existing venues based on is_verified
UPDATE venues 
SET approval_status = CASE 
  WHEN is_verified = true THEN 'approved'
  ELSE 'pending'
END
WHERE approval_status = 'approved'; -- Only update if still default

-- Create function to check if user is banned (now that is_banned column exists)
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND is_banned = true
    AND (banned_until IS NULL OR banned_until > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create trigger to prevent banned users from critical actions
CREATE OR REPLACE FUNCTION check_user_not_banned()
RETURNS TRIGGER AS $$
BEGIN
  IF is_user_banned(auth.uid()) THEN
    RAISE EXCEPTION 'Your account has been banned. Please contact support.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply ban check to critical tables (only if they exist)
DO $$
BEGIN
  -- Reservations trigger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations') THEN
    DROP TRIGGER IF EXISTS prevent_banned_reservations ON reservations;
    CREATE TRIGGER prevent_banned_reservations
      BEFORE INSERT ON reservations
      FOR EACH ROW EXECUTE FUNCTION check_user_not_banned();
    RAISE NOTICE '✅ Ban trigger added to reservations table';
  END IF;

  -- Queue sessions trigger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'queue_sessions') THEN
    DROP TRIGGER IF EXISTS prevent_banned_queue_sessions ON queue_sessions;
    CREATE TRIGGER prevent_banned_queue_sessions
      BEFORE INSERT ON queue_sessions
      FOR EACH ROW EXECUTE FUNCTION check_user_not_banned();
    RAISE NOTICE '✅ Ban trigger added to queue_sessions table';
  END IF;

  -- Reviews trigger (only if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    DROP TRIGGER IF EXISTS prevent_banned_reviews ON reviews;
    CREATE TRIGGER prevent_banned_reviews
      BEFORE INSERT ON reviews
      FOR EACH ROW EXECUTE FUNCTION check_user_not_banned();
    RAISE NOTICE '✅ Ban trigger added to reviews table';
  ELSE
    RAISE NOTICE 'ℹ️  Reviews table does not exist, skipping ban trigger';
  END IF;
END $$;

-- ============================================================================
-- PART 4: Platform Settings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by uuid REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('booking_cancellation_window_hours', '24', 'Hours before booking start that cancellation is allowed'),
  ('payment_timeout_minutes', '15', 'Minutes before pending payment expires'),
  ('advance_booking_limit_days', '30', 'Maximum days in advance a booking can be made'),
  ('platform_fee_percentage', '0', 'Platform fee percentage on bookings'),
  ('minimum_booking_amount', '50', 'Minimum booking amount in pesos'),
  ('queue_session_creation_limit_per_day', '5', 'Max queue sessions per user per day'),
  ('enable_queue_approvals', 'true', 'Require court admin approval for queue sessions'),
  ('enable_split_payments', 'true', 'Allow split payment feature'),
  ('enable_email_notifications', 'false', 'Send email notifications to users'),
  ('enable_push_notifications', 'false', 'Send push notifications to mobile users')
ON CONFLICT (key) DO NOTHING;

-- RLS for platform settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform settings"
  ON platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Global admins update platform settings"
  ON platform_settings FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- ============================================================================
-- PART 5: Global Admin RLS Policies
-- ============================================================================

-- Profiles Table Policies
CREATE POLICY "Global admins view all users"
  ON profiles FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update user profiles"
  ON profiles FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- User Roles Table Policies
CREATE POLICY "Global admins view all user roles"
  ON user_roles FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins manage user roles"
  ON user_roles FOR ALL
  USING (has_role(auth.uid(), 'global_admin'));

-- Venues Table Policies
CREATE POLICY "Global admins view all venues"
  ON venues FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update venues"
  ON venues FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- Courts Table Policies
CREATE POLICY "Global admins view all courts"
  ON courts FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update courts"
  ON courts FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- Reservations Table Policies
CREATE POLICY "Global admins view all reservations"
  ON reservations FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update reservations"
  ON reservations FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- Payments Table Policies
CREATE POLICY "Global admins view all payments"
  ON payments FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update payments"
  ON payments FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- Queue Sessions Table Policies
CREATE POLICY "Global admins view all queue sessions"
  ON queue_sessions FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update queue sessions"
  ON queue_sessions FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- Queue Participants Table Policies
CREATE POLICY "Global admins view all queue participants"
  ON queue_participants FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

-- Reviews Table Policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    EXECUTE 'CREATE POLICY "Global admins view all reviews" ON reviews FOR SELECT USING (has_role(auth.uid(), ''global_admin''))';
    EXECUTE 'CREATE POLICY "Global admins delete reviews" ON reviews FOR DELETE USING (has_role(auth.uid(), ''global_admin''))';
    EXECUTE 'CREATE POLICY "Global admins update reviews" ON reviews FOR UPDATE USING (has_role(auth.uid(), ''global_admin''))';
    RAISE NOTICE '✅ RLS policies added to reviews table';
  ELSE
    RAISE NOTICE 'ℹ️  Reviews table does not exist, skipping RLS policies';
  END IF;
END $$;

-- Players Table Policies
CREATE POLICY "Global admins view all players"
  ON players FOR SELECT
  USING (has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins update players"
  ON players FOR UPDATE
  USING (has_role(auth.uid(), 'global_admin'));

-- ============================================================================
-- PART 6: Verification Queries
-- ============================================================================

-- Verify has_role() function works
DO $$
DECLARE
  test_user_id uuid;
  has_admin_role boolean;
BEGIN
  -- Get a global admin user
  SELECT ur.user_id INTO test_user_id
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name = 'global_admin'
  LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    SELECT has_role(test_user_id, 'global_admin') INTO has_admin_role;
    IF has_admin_role THEN
      RAISE NOTICE '✅ has_role() function working correctly for user: %', test_user_id;
    ELSE
      RAISE WARNING '❌ has_role() function not working correctly';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  No global admin users found to test has_role() function';
  END IF;
END $$;

-- Check tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_logs') THEN
    RAISE NOTICE '✅ admin_audit_logs table created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
    RAISE NOTICE '✅ platform_settings table created with % settings', 
      (SELECT COUNT(*) FROM platform_settings);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'is_banned') THEN
    RAISE NOTICE '✅ Ban system columns added to profiles table';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'venues' AND column_name = 'approval_status') THEN
    RAISE NOTICE '✅ Approval status columns added to venues table';
  END IF;
END $$;

-- List all RLS policies created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE policyname LIKE '%Global admins%'
ORDER BY tablename, policyname;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '🎉 Migration 019 completed successfully!';
END $$;
