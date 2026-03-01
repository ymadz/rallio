-- Migration: Cleanup discount types
-- Purpose: Rename multi_day→recurring, remove group/loyalty/custom, drop promo tables
-- Date: 2026-02-28

-- 1. Drop old CHECK constraint FIRST (so we can update to new values)
ALTER TABLE discount_rules DROP CONSTRAINT IF EXISTS discount_rules_discount_type_check;

-- 2. Migrate existing discount_rules data
UPDATE discount_rules SET discount_type = 'recurring' WHERE discount_type = 'multi_day';
DELETE FROM discount_rules WHERE discount_type IN ('group', 'loyalty', 'custom');

-- 3. Add new CHECK constraint
ALTER TABLE discount_rules ADD CONSTRAINT discount_rules_discount_type_check
  CHECK (discount_type IN ('recurring', 'early_bird'));

-- 4. Rename min_days → min_weeks for clarity
ALTER TABLE discount_rules RENAME COLUMN min_days TO min_weeks;

-- 5. Remove min_players column (group discounts removed)
ALTER TABLE discount_rules DROP COLUMN IF EXISTS min_players;

-- 6. Remove min_bookings column (loyalty discounts removed)
ALTER TABLE discount_rules DROP COLUMN IF EXISTS min_bookings;

-- 7. Drop promo code tables (unused, user confirmed removal)
DROP TABLE IF EXISTS promo_code_usage;
DROP TABLE IF EXISTS promo_codes;

-- 8. Update comments
COMMENT ON TABLE discount_rules IS 'Configurable discount rules: recurring booking and early bird discounts';
COMMENT ON COLUMN discount_rules.min_weeks IS 'Minimum number of recurring weeks required to qualify for this discount';
