-- =====================================================
-- DEV TOOLS SCHEMA
-- Purpose: Support for Time Travel and other dev-only features
-- =====================================================

CREATE TABLE IF NOT EXISTS dev_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default time offset (0ms)
INSERT INTO dev_settings (key, value)
VALUES ('time_offset_ms', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE dev_settings ENABLE ROW LEVEL SECURITY;

-- Allow all access during development
-- In production, this table should ideally not exist or be locked down
-- ensuring strict env checks in application code is primary defense
CREATE POLICY "Allow all access to dev_settings" ON dev_settings
    FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE dev_settings IS 'Stores development configuration like time offsets';
