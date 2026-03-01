-- Add updated_at triggers to tables missing them

-- 1. discount_rules
DROP TRIGGER IF EXISTS update_discount_rules_updated_at ON discount_rules;
CREATE TRIGGER update_discount_rules_updated_at BEFORE UPDATE ON discount_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. holiday_pricing
DROP TRIGGER IF EXISTS update_holiday_pricing_updated_at ON holiday_pricing;
CREATE TRIGGER update_holiday_pricing_updated_at BEFORE UPDATE ON holiday_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
