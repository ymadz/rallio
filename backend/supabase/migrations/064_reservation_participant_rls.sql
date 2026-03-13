
-- Allow participants in a split payment to view the reservation
-- This ensures that invited players see the booking in their "My Bookings" page
CREATE POLICY "Participants can view their split reservations" ON reservations
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM payment_splits
      WHERE payment_splits.reservation_id = reservations.id
      AND payment_splits.user_id = auth.uid()
    )
  );

-- Also ensure payment_splits are viewable by participants (already exists but worth verifying/adding)
-- The original policy in 001_initial_schema_v2.sql: 
-- CREATE POLICY "Users can view own payment_splits" ON payment_splits FOR SELECT USING (auth.uid() = user_id);
-- We might want THE CREATOR to also view all splits for their reservation.
CREATE POLICY "Creators can view all splits for their reservation" ON payment_splits
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM reservations WHERE id = reservation_id)
  );
