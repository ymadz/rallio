-- Add description column to holiday_pricing table
ALTER TABLE holiday_pricing
ADD COLUMN description text;

COMMENT ON COLUMN holiday_pricing.description IS 'Optional description or reason for the holiday pricing (e.g. Christmas Surcharge)';
