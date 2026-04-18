-- ============================================================================
-- Migration 064: Create bookings table and normalize reservations
-- Date: 2026-03-17
-- Description:
--   - Creates the 'bookings' table to act as the parent transaction for one
--     or more 'reservations' (which now act as booking items).
--   - Adds 'booking_id' to 'reservations'.
--   - Adds 'booking_id' to 'payments'.
--   - Ensures 'bookings' tracks total_amount, amount_paid, remaining_balance,
--     and payment_status.
-- ============================================================================

BEGIN;

-- 1. Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(12,2) NOT NULL DEFAULT 0,
  payment_status varchar(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

COMMENT ON TABLE bookings IS 'Parent transaction entity grouping one or more reservations';

-- 2. Add booking_id to reservations
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reservations_booking ON reservations(booking_id);

-- 3. Add booking_id to payments
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- 4. Enable RLS on bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Venue admins and queue masters need to see bookings related to their courts
-- We will handle complex policies via separate migration or function if needed,
-- but for now, global admins can see all.
CREATE POLICY "Global admins can view all bookings"
  ON bookings FOR ALL
  USING (
    has_role(auth.uid(), 'global_admin')
  );

-- 6. Trigger to update updated_at on bookings
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at_trigger
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_bookings_updated_at();

COMMIT;
