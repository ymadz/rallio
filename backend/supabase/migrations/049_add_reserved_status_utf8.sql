BEGIN;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (
    status IN (
      'pending_payment',
      'pending',
      'paid',
      'confirmed',
      'cancelled',
      'completed',
      'no_show',
      'pending_refund',
      'ongoing',
      'partially_paid',
      'reserved'
    )
  );

COMMIT;
