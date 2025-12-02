-- Migration 027: Fix courts RLS policy to allow queue masters to view courts
-- 
-- Problem: Queue masters cannot see courts inside venues, while other users can
-- Root cause: The "Verified courts are viewable by everyone" policy doesn't include
-- queue_master role, and new courts might not be verified yet.
--
-- Solution: Update the policy to:
-- 1. Allow anyone to see active AND verified courts
-- 2. Allow queue_masters to see active courts (needed for queue session management)
-- 3. Keep existing permissions for venue owners and global admins

-- Drop the existing policy
DROP POLICY IF EXISTS "Verified courts are viewable by everyone" ON courts;

-- Create an improved policy that handles all cases
CREATE POLICY "Courts viewable policy" ON courts
  FOR SELECT
  USING (
    -- Active AND verified courts are visible to everyone (public view)
    (is_active = true AND is_verified = true)
    OR
    -- Queue masters can see all active courts (needed for queue management)
    (is_active = true AND has_role(auth.uid(), 'queue_master'))
    OR
    -- Court admins can see all active courts
    (is_active = true AND has_role(auth.uid(), 'court_admin'))
    OR
    -- Venue owners can see ALL their courts (including inactive/unverified)
    venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid())
    OR
    -- Global admins can see all courts
    has_role(auth.uid(), 'global_admin')
  );

-- Also ensure any courts that are active get verified (fix data issue)
-- This grandfathers in any active courts that somehow aren't verified
UPDATE courts
SET is_verified = true
WHERE is_active = true AND (is_verified = false OR is_verified IS NULL);

-- Add index to support the policy efficiently
CREATE INDEX IF NOT EXISTS idx_courts_active_verified ON courts(is_active, is_verified);
