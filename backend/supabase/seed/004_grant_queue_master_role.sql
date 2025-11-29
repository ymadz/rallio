-- Grant Queue Master Role to Test User
-- Run this script to assign the queue_master role to your user

-- First, let's see all users (uncomment to view)
-- SELECT id, email, display_name FROM profiles;

-- Grant queue_master role to a specific user
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  user_uuid UUID;
  role_uuid UUID;
BEGIN
  -- Get the user ID by email (CHANGE THIS EMAIL)
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = 'your-email@example.com'  -- ⚠️ CHANGE THIS
  LIMIT 1;

  -- Get the queue_master role ID
  SELECT id INTO role_uuid 
  FROM roles 
  WHERE name = 'queue_master';

  -- Insert the role assignment (ignore if already exists)
  IF user_uuid IS NOT NULL AND role_uuid IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES (user_uuid, role_uuid, user_uuid)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Queue Master role granted to user: %', user_uuid;
  ELSE
    RAISE NOTICE 'User or role not found. User ID: %, Role ID: %', user_uuid, role_uuid;
  END IF;
END $$;

-- Verify the role was granted
SELECT 
  p.email,
  p.display_name,
  r.name as role_name,
  ur.assigned_at
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'queue_master'
ORDER BY ur.assigned_at DESC;
