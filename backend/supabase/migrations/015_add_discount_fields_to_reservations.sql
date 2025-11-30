-- Migration: Add discount tracking fields to reservations table
-- Purpose: Track which discounts were applied to each reservation
-- Date: 2025-11-30

-- Add discount fields to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS discount_applied numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type varchar(50),
ADD COLUMN IF NOT EXISTS discount_reason text;

-- Add comment for clarity on discount fields
COMMENT ON COLUMN reservations.discount_applied IS 'Total discount amount applied to this reservation in PHP';
COMMENT ON COLUMN reservations.discount_type IS 'Type of discount applied: multi_day, group, early_bird, holiday_surcharge, seasonal, etc.';
COMMENT ON COLUMN reservations.discount_reason IS 'Human-readable description of why this discount was applied';

-- Add index for discount queries
CREATE INDEX IF NOT EXISTS idx_reservations_discount_type ON reservations(discount_type) WHERE discount_type IS NOT NULL;

-- Note: promo_codes and promo_code_usage tables exist but are not being used
-- They are kept in schema for potential future use but excluded from current discount system
COMMENT ON TABLE promo_codes IS 'DEPRECATED: Not currently used in discount system. Kept for potential future use.';
COMMENT ON TABLE promo_code_usage IS 'DEPRECATED: Not currently used in discount system. Kept for potential future use.';
