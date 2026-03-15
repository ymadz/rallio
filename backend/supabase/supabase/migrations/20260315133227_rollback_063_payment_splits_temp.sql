BEGIN;

DROP TRIGGER IF EXISTS payment_splits_updated_at_trigger ON payment_splits;
DROP FUNCTION IF EXISTS update_payment_splits_updated_at();
DROP TABLE IF EXISTS payment_splits CASCADE;

COMMIT;