-- Migration 018: Assign User Roles
-- Created: December 1, 2025
-- Purpose: Sync all auth.users to profiles table and assign specific roles

-- ============================================================================
-- PART 1: Sync all auth.users to profiles and players tables
-- ============================================================================

DO $$
DECLARE
  auth_user_record RECORD;
  display_name_value TEXT;
BEGIN
  -- Loop through all users in auth.users
  FOR auth_user_record IN
    SELECT
      id,
      email,
      raw_user_meta_data->>'full_name' as full_name,
      raw_user_meta_data->>'avatar_url' as avatar_url
    FROM auth.users
  LOOP
    -- Determine display name (use full_name from metadata or extract from email)
    IF auth_user_record.full_name IS NOT NULL AND auth_user_record.full_name != '' THEN
      display_name_value := auth_user_record.full_name;
    ELSE
      -- Extract name from email (before @)
      display_name_value := split_part(auth_user_record.email, '@', 1);
    END IF;

    -- Insert or update profile
    INSERT INTO profiles (
      id,
      email,
      display_name,
      avatar_url,
      profile_completed
    )
    VALUES (
      auth_user_record.id,
      auth_user_record.email,
      display_name_value,
      auth_user_record.avatar_url,
      false  -- Not completed by default
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
      avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);

    -- Create player record if it doesn't exist
    INSERT INTO players (user_id)
    VALUES (auth_user_record.id)
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Synced user: % (email: %)', auth_user_record.id, auth_user_record.email;
  END LOOP;

  RAISE NOTICE 'Successfully synced all auth.users to profiles and players tables';
END $$;

-- ============================================================================
-- PART 2: Assign specific roles to users
-- ============================================================================

DO $$
DECLARE
  player_role_id UUID;
  queue_master_role_id UUID;
  court_admin_role_id UUID;
  global_admin_role_id UUID;
  queue_master_user_id UUID;
  court_admin_user_id UUID;
  global_admin_user_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO player_role_id FROM roles WHERE name = 'player';
  SELECT id INTO queue_master_role_id FROM roles WHERE name = 'queue_master';
  SELECT id INTO court_admin_role_id FROM roles WHERE name = 'court_admin';
  SELECT id INTO global_admin_role_id FROM roles WHERE name = 'global_admin';

  -- Get user IDs by email from profiles (after PART 1 sync)
  SELECT id INTO queue_master_user_id FROM profiles WHERE email = 'ahmadyahiya05@gmail.com';
  SELECT id INTO court_admin_user_id FROM profiles WHERE email = 'hz202305856@wmsu.edu.ph';
  SELECT id INTO global_admin_user_id FROM profiles WHERE email = 'user@example.com';

  -- Verify users exist
  IF queue_master_user_id IS NULL THEN
    RAISE WARNING 'Queue Master user not found: ahmadyahiya05@gmail.com';
  END IF;
  
  IF court_admin_user_id IS NULL THEN
    RAISE WARNING 'Court Admin user not found: hz202305856@wmsu.edu.ph';
  END IF;
  
  IF global_admin_user_id IS NULL THEN
    RAISE WARNING 'Global Admin user not found: user@example.com';
  END IF;

  -- Clear existing role assignments for the target users (only if they exist)
  DELETE FROM user_roles
  WHERE user_id IN (
    queue_master_user_id,
    court_admin_user_id,
    global_admin_user_id
  )
  AND user_id IS NOT NULL;

  -- Assign Queue Master role (ahmadyahiya05@gmail.com)
  IF queue_master_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES
      (queue_master_user_id, player_role_id),
      (queue_master_user_id, queue_master_role_id);
    RAISE NOTICE 'Assigned Queue Master role to: ahmadyahiya05@gmail.com';
  END IF;

  -- Assign Court Admin role (hz202305856@wmsu.edu.ph)
  IF court_admin_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES
      (court_admin_user_id, player_role_id),
      (court_admin_user_id, court_admin_role_id);
    RAISE NOTICE 'Assigned Court Admin role to: hz202305856@wmsu.edu.ph';
  END IF;

  -- Assign Global Admin role (user@example.com)
  IF global_admin_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES
      (global_admin_user_id, player_role_id),
      (global_admin_user_id, global_admin_role_id);
    RAISE NOTICE 'Assigned Global Admin role to: user@example.com';
  END IF;

  -- Assign player role to all other users who don't have roles yet
  INSERT INTO user_roles (user_id, role_id)
  SELECT p.id, player_role_id
  FROM profiles p
  WHERE p.id NOT IN (
    COALESCE(queue_master_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(court_admin_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(global_admin_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
  );

  RAISE NOTICE 'Successfully assigned all user roles';
END $$;

-- ============================================================================
-- PART 3: Verification Query
-- ============================================================================

-- Check role assignments
SELECT
  p.email,
  p.display_name,
  STRING_AGG(r.name, ', ' ORDER BY r.name) as roles
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r ON r.id = ur.role_id
GROUP BY p.id, p.email, p.display_name
ORDER BY p.email;

-- ============================================================================
-- Expected Results:
-- ahmadyahiya05@gmail.com: player, queue_master
-- hz202305856@wmsu.edu.ph: court_admin, player
-- user@example.com: global_admin, player
-- All others: player
-- ============================================================================
