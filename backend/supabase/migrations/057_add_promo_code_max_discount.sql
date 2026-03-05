-- Add max_discount_amount column to promo_codes table

ALTER TABLE promo_codes
ADD COLUMN max_discount_amount numeric(9,2);

COMMENT ON COLUMN promo_codes.max_discount_amount IS 'Maximum amount a percentage discount can deduct (₱)';