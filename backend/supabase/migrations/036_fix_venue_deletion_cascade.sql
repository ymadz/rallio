-- Migration: Fix Venue Deletion Cascade
-- Description: Updates the reservations table to cascade deletion when a court is deleted.
-- This allows venues to be deleted along with all their associated courts and reservations.

BEGIN;

-- Drop the existing restriction constraint
ALTER TABLE "public"."reservations" 
DROP CONSTRAINT IF EXISTS "reservations_court_id_fkey";

-- Add the new cascading constraint
ALTER TABLE "public"."reservations"
ADD CONSTRAINT "reservations_court_id_fkey" 
FOREIGN KEY ("court_id") 
REFERENCES "public"."courts"("id") 
ON DELETE CASCADE;

COMMIT;
