-- Migration: Add multi_day discount type
-- Purpose: Add multi_day to discount_type check constraint and min_days column
-- Date: 2026-03-07

-- 1. Drop old CHECK constraint FIRST (so we can update to new values)
ALTER TABLE discount_rules DROP CONSTRAINT IF EXISTS discount_rules_discount_type_check;

-- 2. Add new CHECK constraint with multi_day
ALTER TABLE discount_rules ADD CONSTRAINT discount_rules_discount_type_check
  CHECK (discount_type IN ('recurring', 'early_bird', 'multi_day'));

-- 3. Add min_days column
ALTER TABLE discount_rules ADD COLUMN IF NOT EXISTS min_days integer;

-- 4. Update comments
COMMENT ON COLUMN discount_rules.min_days IS 'Minimum number of distinct dates required to qualify for a multi-day discount';
