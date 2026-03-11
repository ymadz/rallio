-- Drop the existing global unique constraint on the promo code column
ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_code_key;

-- Add a new unique index that enforces uniqueness per (code, venue_id) combination.
-- We use COALESCE so that platform-wide promo codes (where venue_id IS NULL) are also 
-- forced to be unique against each other, distinct from venue-specific codes.
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_venue_id_idx ON promo_codes(code, COALESCE(venue_id, '00000000-0000-0000-0000-000000000000'::uuid));
