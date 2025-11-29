-- =====================================================
-- Grant Court Admin Role to User
-- =====================================================
-- This script grants the court_admin role to a specific user

-- STEP 1: Find your user ID
-- Run this query first to get your user ID:
SELECT
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- STEP 2: Replace [YOUR_USER_ID] below with your actual user ID from Step 1
-- Then run this query to grant court_admin role:

DO $$
DECLARE
  v_user_id UUID := '[YOUR_USER_ID]'; -- Replace this with your user ID
  v_role_id UUID;
BEGIN
  -- Get the court_admin role ID
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'court_admin';

  -- Check if role exists
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'court_admin role not found in roles table';
  END IF;

  -- Grant the role (with duplicate check)
  INSERT INTO user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- Verify
  RAISE NOTICE 'Successfully granted court_admin role to user %', v_user_id;
END $$;

-- STEP 3: Verify the role was granted
SELECT
  u.id,
  u.email,
  r.name as role_name,
  ur.created_at as role_granted_at
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.id = '[YOUR_USER_ID]' -- Replace with your user ID
ORDER BY ur.created_at DESC;

-- =====================================================
-- QUICK VERSION (One-step)
-- =====================================================
-- If you already know your email, use this simpler version:

-- Replace 'your-email@example.com' with your actual email
INSERT INTO user_roles (user_id, role_id)
SELECT
  u.id,
  r.id
FROM auth.users u
CROSS JOIN roles r
WHERE u.email = 'your-email@example.com' -- ← Change this
  AND r.name = 'court_admin'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.id
    AND ur.role_id = r.id
  );

-- Verify it worked
SELECT
  u.email,
  r.name as role
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'your-email@example.com'; -- ← Change this
