-- Migration: Remove 'paid' from reservation status constraint and migrate existing rows
-- Also remove approval_status column from queue_sessions (dead code after approval workflow removal)

-- 1. Migrate any existing 'paid' reservations to 'confirmed'
UPDATE reservations SET status = 'confirmed' WHERE status = 'paid';

-- 2. Drop old constraint
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

-- 3. Re-create without 'paid'
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
CHECK (
  status IN (
    'pending_payment',
    'confirmed',
    'ongoing',
    'cancelled',
    'completed',
    'no_show',
    'pending_refund',
    'refunded'
  )
);

-- 4. Drop approval_status column from queue_sessions (all values are 'approved', column is dead)
ALTER TABLE queue_sessions DROP COLUMN IF EXISTS approval_status;
