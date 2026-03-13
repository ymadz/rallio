-- Enable Supabase Realtime for payment_splits
-- REPLICA IDENTITY FULL is required for filtered real-time subscriptions
ALTER TABLE payment_splits REPLICA IDENTITY FULL;

-- Add table to the supabase_realtime publication
-- Use DO block to avoid error if already in publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'payment_splits'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE payment_splits;
    END IF;
END $$;
