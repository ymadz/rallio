# PayMongo Webhook Debugging Guide

## Problem Description
Payments are going through successfully on PayMongo's test page, but bookings remain in "Pending Payment" status instead of being confirmed. The webhook handler may not be receiving events from PayMongo.

## Root Cause Analysis

### Most Likely Issues (in order of probability):

1. **Webhook Not Registered in PayMongo Dashboard** (90% likely)
   - PayMongo webhooks must be manually registered in the dashboard
   - Local development servers (localhost:3000) cannot receive webhooks directly
   - Solution: Use ngrok or similar tool to expose local server

2. **Migration 006 Not Applied** (70% likely)
   - The database may not have the 'paid' and 'pending_payment' status values
   - Current schema only allows: 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
   - Webhook tries to set 'paid' status → CHECK constraint violation → fails silently

3. **RLS Policies Blocking Updates** (50% likely)
   - Service role client should bypass RLS, but there may be policy issues
   - Migration 005 (RLS policies) may not be applied

4. **Environment Variables Missing** (30% likely)
   - PAYMONGO_WEBHOOK_SECRET may be missing (though code handles this)
   - SUPABASE_SERVICE_ROLE_KEY may be incorrect

## Step-by-Step Debugging

### Step 1: Verify Migration 006 Status

Run this SQL query in Supabase SQL Editor:

```sql
\i backend/supabase/migrations/VERIFY_MIGRATION_006.sql
```

Or manually run:

```sql
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.check_constraints
      WHERE constraint_name = 'reservations_status_check'
        AND check_clause LIKE '%pending_payment%'
        AND check_clause LIKE '%paid%'
    ) THEN '✅ Migration 006 is APPLIED'
    ELSE '❌ Migration 006 NOT applied'
  END AS migration_status;
```

**If NOT applied:**
```bash
cd backend/supabase/migrations
psql $DATABASE_URL < 006_enhance_booking_status_and_constraints.sql
```

### Step 2: Check Current Reservation and Payment Status

```sql
-- Check the most recent reservation
SELECT
  r.id,
  r.status AS reservation_status,
  r.amount_paid,
  r.total_amount,
  p.id AS payment_id,
  p.status AS payment_status,
  p.external_id,
  p.created_at,
  p.updated_at
FROM reservations r
LEFT JOIN payments p ON p.reservation_id = r.id
ORDER BY r.created_at DESC
LIMIT 5;
```

### Step 3: Set Up ngrok for Local Webhook Testing

PayMongo cannot send webhooks to `localhost:3000`. You need to expose your local server:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start your Next.js dev server
npm run dev:web

# In another terminal, expose it
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

### Step 4: Register Webhook in PayMongo Dashboard

1. Go to https://dashboard.paymongo.com/developers/webhooks
2. Click "Add Webhook"
3. Enter webhook URL: `https://abc123.ngrok.io/api/webhooks/paymongo`
4. Select events:
   - ✅ `source.chargeable`
   - ✅ `payment.paid`
   - ✅ `payment.failed`
5. Save the webhook
6. Copy the webhook secret and add to `.env.local`:
   ```
   PAYMONGO_WEBHOOK_SECRET=whsk_...
   ```

### Step 5: Test Payment Flow with Logging

1. Start the dev server with logging visible:
   ```bash
   npm run dev:web
   ```

2. Create a new booking and initiate payment

3. Complete test payment on PayMongo page

4. Watch the console logs for:
   - `[PayMongo Webhook]` messages
   - `[handleSourceChargeable]` messages
   - `[markReservationPaidAndConfirmed]` messages

### Step 6: Manually Trigger Webhook (if needed)

If webhook is not being called, you can test the endpoint manually:

```bash
# Test with curl (replace with actual source_id from your payment)
curl -X POST http://localhost:3000/api/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "id": "evt_test123",
      "attributes": {
        "type": "source.chargeable",
        "data": {
          "id": "src_YOUR_SOURCE_ID_HERE",
          "type": "source",
          "attributes": {
            "status": "chargeable",
            "amount": 10000
          }
        }
      }
    }
  }'
```

## Expected Log Output (Successful Flow)

```
[PayMongo Webhook] 2025-11-24T... - Incoming webhook request
[PayMongo Webhook] Request details: { bodyLength: 1234, hasSignature: true }
[PayMongo Webhook] Signature verification: { valid: true }
[PayMongo Webhook] 📦 Event parsed: { eventType: 'source.chargeable', eventId: 'evt_...' }
[PayMongo Webhook] 🔄 Handling source.chargeable event
[handleSourceChargeable] 🔄 Starting handler
[handleSourceChargeable] Source ID: src_...
[handleSourceChargeable] ✅ Supabase service client created
[handleSourceChargeable] 🔍 Querying payments table for external_id: src_...
[handleSourceChargeable] Database query result: { found: true, paymentId: '...', reservationId: '...' }
[markReservationPaidAndConfirmed] 🎯 Starting reservation confirmation
[markReservationPaidAndConfirmed] 📝 Step 1: Marking reservation as PAID
[markReservationPaidAndConfirmed] ✅ Reservation marked as PAID
[markReservationPaidAndConfirmed] 📝 Step 2: Marking reservation as CONFIRMED
[markReservationPaidAndConfirmed] ✅✅✅ Reservation confirmed successfully
[PayMongo Webhook] ✅ Webhook processed successfully
```

## Common Error Patterns

### Error: CHECK constraint violation (code: 23514)
```
[markReservationPaidAndConfirmed] ❌ Failed to mark reservation as paid
error: { code: '23514' }
```
**Solution:** Migration 006 not applied. Run the migration file.

### Error: Payment not found
```
[handleSourceChargeable] ❌ Payment not found for source: src_...
```
**Solution:**
- Check if payment was created in database
- Verify `external_id` matches the source ID from PayMongo
- May be timing issue - payment created after webhook fired

### Error: Permission denied for table reservations
```
error: { message: 'permission denied for table reservations' }
```
**Solution:** RLS policy blocking service role. Apply migration 005 or check service role key.

### Warning: No webhook logs at all
**Solution:** Webhook not registered or not reaching server. Use ngrok.

## Quick Fix: Bypass Webhook (Temporary)

If you need to test the full flow without webhooks:

1. Complete payment on PayMongo
2. Get the source_id from the URL (PayMongo redirects with `?source_id=src_...`)
3. Manually run in Supabase SQL Editor:

```sql
-- Update payment status
UPDATE payments
SET status = 'completed',
    paid_at = NOW()
WHERE external_id = 'src_YOUR_SOURCE_ID_HERE';

-- Update reservation status
UPDATE reservations
SET status = 'confirmed',
    amount_paid = total_amount
WHERE id = (
  SELECT reservation_id
  FROM payments
  WHERE external_id = 'src_YOUR_SOURCE_ID_HERE'
);
```

## Verification Checklist

After fixing, verify:

- [ ] Migration 006 applied (run VERIFY_MIGRATION_006.sql)
- [ ] Webhook registered in PayMongo dashboard with ngrok URL
- [ ] PAYMONGO_WEBHOOK_SECRET in .env.local
- [ ] Dev server running and accessible via ngrok
- [ ] Test payment shows webhook logs in console
- [ ] Reservation status changes from "Pending Payment" to "Confirmed"
- [ ] Payment status changes from "pending" to "completed"
- [ ] Booking appears in "Confirmed/Paid" section on /bookings page

## Production Deployment Notes

For production:

1. Replace ngrok URL with actual production URL in PayMongo dashboard
2. Ensure PAYMONGO_WEBHOOK_SECRET is set in production environment
3. Ensure SUPABASE_SERVICE_ROLE_KEY is set in production
4. Monitor webhook delivery in PayMongo dashboard
5. Set up error alerting for failed webhook deliveries
6. Consider implementing webhook retry logic for failed updates

## Contact for Help

If issues persist after following this guide:

1. Check the comprehensive logs added to:
   - `/web/src/app/api/webhooks/paymongo/route.ts`
   - `/web/src/app/actions/payments.ts`

2. Share the console output when creating a booking and completing payment

3. Run the verification SQL and share results
