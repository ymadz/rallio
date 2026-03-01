-- Add metadata column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Update index for performance if we query by metadata (optional but recommended)
-- CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN (metadata);

COMMENT ON COLUMN notifications.metadata IS 'Rich metadata for the notification (e.g., booking_id, venue_name, etc.)';
