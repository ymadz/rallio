-- Quick Grant Queue Master Role
-- This script grants queue_master role to the most recent user

DO $$
DECLARE
  user_uuid UUID;
  role_uuid UUID;
BEGIN
  -- Get the most recent user
  SELECT id INTO user_uuid 
  FROM auth.users 
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get the queue_master role ID
  SELECT id INTO role_uuid 
  FROM roles 
  WHERE name = 'queue_master';

  -- Insert the role assignment
  IF user_uuid IS NOT NULL AND role_uuid IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES (user_uuid, role_uuid, user_uuid)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Queue Master role granted successfully!';
  ELSE
    RAISE NOTICE 'User or role not found.';
  END IF;
END $$;

-- Show result
SELECT 
  au.email,
  p.display_name,
  r.name as role_name,
  ur.assigned_at
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
JOIN profiles p ON p.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'queue_master'
ORDER BY ur.assigned_at DESC
LIMIT 5;
