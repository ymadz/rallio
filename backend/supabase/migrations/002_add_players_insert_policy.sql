-- Add INSERT policy for players table
-- This allows users to create their own player profile during onboarding
-- if it wasn't created by the signup trigger for some reason

CREATE POLICY "Users can insert own player profile" ON players
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
