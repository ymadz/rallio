-- =====================================================
-- Migration 063: Add Payment Splits Table for Split Payments
-- Date: 2026-03-15
-- Description:
--   Add payment_splits table to support split payment functionality
--   where multiple players can share the cost of a court booking
-- =====================================================

BEGIN;

-- =====================================================
-- Payment Splits Table
-- =====================================================
-- Tracks individual payments when a reservation cost is split among multiple players
-- Each split represents one player's share of the total payment

CREATE TABLE payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  paid_at timestamptz,
  qr_code_url varchar(500),
  payment_reference varchar(100),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_payment_splits_payment ON payment_splits(payment_id);
CREATE INDEX idx_payment_splits_user ON payment_splits(user_id);
CREATE INDEX idx_payment_splits_status ON payment_splits(status);
CREATE INDEX idx_payment_splits_reference ON payment_splits(payment_reference) WHERE payment_reference IS NOT NULL;

-- Unique constraint: one split per user per payment
CREATE UNIQUE INDEX idx_payment_splits_unique_user_payment ON payment_splits(payment_id, user_id);

-- Comments
COMMENT ON TABLE payment_splits IS 'Tracks individual player payments when court booking costs are split among multiple players';
COMMENT ON COLUMN payment_splits.payment_id IS 'Reference to the main payment record';
COMMENT ON COLUMN payment_splits.user_id IS 'The player responsible for this payment split';
COMMENT ON COLUMN payment_splits.amount IS 'Amount this player needs to pay';
COMMENT ON COLUMN payment_splits.status IS 'Payment status: pending, paid, failed, cancelled';
COMMENT ON COLUMN payment_splits.paid_at IS 'Timestamp when this split was paid';
COMMENT ON COLUMN payment_splits.qr_code_url IS 'PayMongo QR code URL for this specific payment split';
COMMENT ON COLUMN payment_splits.payment_reference IS 'Unique reference for this payment split';

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment splits
CREATE POLICY "Users can view own payment splits" ON payment_splits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own payment splits (for status updates)
CREATE POLICY "Users can update own payment splits" ON payment_splits
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for webhook processing)
CREATE POLICY "Service role can manage all payment splits" ON payment_splits
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_splits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER payment_splits_updated_at_trigger
  BEFORE UPDATE ON payment_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_splits_updated_at();

COMMIT;</content>
<parameter name="filePath">c:\Users\Asus\Documents\CCS 2ND YEAR\CCS 3RD\rallio\rallio\backend\supabase\migrations\063_add_payment_splits_table.sql