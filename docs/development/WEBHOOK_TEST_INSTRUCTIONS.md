# PayMongo Webhook Testing & Debugging Guide

**Last Updated:** 2025-11-24
**Purpose:** Diagnose why PayMongo webhooks are not reaching the server

---

## Problem Statement

Payment initiation works perfectly, but PayMongo webhooks are NOT reaching the server when "Authorize Test Payment" is clicked in test mode.

**Evidence:**
- ✅ Payment source created successfully
- ✅ Database records created
- ✅ User redirected to PayMongo test payment page
- ❌ **ZERO webhook logs** when payment is authorized

---

## Step 1: Verify Webhook Endpoint is Reachable

### 1.1 Test Health Check Endpoint

The webhook route now includes a GET handler for health checks.

**Test with curl:**
```bash
curl https://YOUR-NGROK-URL/api/webhooks/paymongo
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "PayMongo webhook endpoint is reachable",
  "timestamp": "2025-11-24T...",
  "endpoint": "/api/webhooks/paymongo",
  "methods": ["GET", "POST", "OPTIONS"],
  "environment": "development"
}
```

**Test with browser:**
1. Open `https://YOUR-NGROK-URL/api/webhooks/paymongo` in browser
2. You should see JSON response
3. Check dev server terminal for health check logs: `🏥 [Webhook Health Check] GET request received`

**If health check fails:**
- ❌ Webhook endpoint is NOT accessible from internet
- Check ngrok is running: `npx ngrok http 3000`
- Verify ngrok URL matches what you registered in PayMongo dashboard
- Check firewall/network settings

---

## Step 2: Verify ngrok is Forwarding Requests

### 2.1 Check ngrok Web Interface

1. Open `http://localhost:4040` in browser (ngrok web interface)
2. Click "Requests/HTTP" tab
3. Look for incoming POST requests to `/api/webhooks/paymongo`

**What to look for:**
- Are there any POST requests to `/api/webhooks/paymongo`?
- What is the status code? (200, 401, 404, 500?)
- Click on a request to see full details (headers, body, response)

**If you see 404 errors:**
- ❌ Webhook endpoint not found
- Verify Next.js route exists at `/web/src/app/api/webhooks/paymongo/route.ts`
- Restart dev server: `npm run dev:web`

**If you see 401/403 errors:**
- ❌ Signature verification failing
- This is progress! Webhook is reaching server but being rejected
- Check server logs for signature verification details

**If you see NO requests at all:**
- ❌ PayMongo is not sending webhooks to your ngrok URL
- Verify webhook URL in PayMongo dashboard
- Check PayMongo dashboard for webhook delivery failures

---

## Step 3: Verify PayMongo Webhook Configuration

### 3.1 Check PayMongo Dashboard

1. Log into PayMongo Dashboard: https://dashboard.paymongo.com/
2. Go to **Developers** → **Webhooks**
3. Find your webhook endpoint
4. Verify webhook URL **exactly** matches your ngrok URL:
   - ❌ Bad: `http://localhost:3000/api/webhooks/paymongo`
   - ✅ Good: `https://abc123.ngrok.io/api/webhooks/paymongo`
5. Check "Events" configuration:
   - ✅ Must include: `source.chargeable`, `payment.paid`, `payment.failed`

### 3.2 Check Webhook Delivery Logs

In PayMongo dashboard:
1. Click on your webhook
2. Look for "Recent Deliveries" or "Logs" section
3. Check for failed delivery attempts

**What failed deliveries tell you:**
- **Connection Timeout:** ngrok URL is unreachable
- **SSL Error:** Certificate problem (shouldn't happen with ngrok)
- **4xx/5xx Errors:** Webhook reaching server but failing

---

## Step 4: Manual Webhook Test

### 4.1 Test with curl (Simulate PayMongo Webhook)

Create a test webhook payload in `test-webhook.json`:
```json
{
  "data": {
    "id": "evt_test123",
    "type": "event",
    "attributes": {
      "type": "source.chargeable",
      "livemode": false,
      "data": {
        "id": "src_test123",
        "type": "source",
        "attributes": {
          "status": "chargeable",
          "amount": 50000,
          "currency": "PHP",
          "type": "gcash"
        }
      }
    }
  }
}
```

**Send test webhook:**
```bash
curl -X POST https://YOUR-NGROK-URL/api/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
```

**Check dev server terminal:**
- You should see: `🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨`
- Followed by the debug checklist

**If you see webhook logs:**
- ✅ Endpoint is reachable and processing requests
- The problem is PayMongo is not sending webhooks (check PayMongo dashboard)

**If you don't see logs:**
- ❌ Network routing issue
- Check ngrok is running and URL is correct

---

## Step 5: End-to-End Payment Test

### 5.1 Create a Test Booking

1. Start dev server: `npm run dev:web --workspace=web`
2. Start ngrok: `npx ngrok http 3000`
3. Note your ngrok URL (e.g., `https://abc123.ngrok.io`)
4. Update PayMongo webhook URL in dashboard to match ngrok URL

### 5.2 Make a Test Payment

1. Find a court and create a booking
2. On checkout page, select "GCash" or "Maya"
3. Click "Proceed to Payment"
4. **Watch dev server terminal** for these logs:
   ```
   [initiatePaymentAction] ✅ Starting payment initiation
   [initiatePaymentAction] 💳 PayMongo source created
   [initiatePaymentAction] 📝 Reservation created
   [initiatePaymentAction] 💰 Payment record created
   ```
5. On PayMongo test page, click **"Authorize Test Payment"**
6. **IMMEDIATELY watch terminal** for:
   ```
   🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨
   ```

### 5.3 What to Look For

**Scenario A: No webhook logs appear**
- ❌ PayMongo is not sending webhooks
- Check ngrok web interface at `http://localhost:4040`
- Check PayMongo dashboard webhook logs
- Verify webhook URL is correct

**Scenario B: Webhook logs appear but fail**
- ✅ Webhook reached server (progress!)
- Look for error in logs (signature verification, database error, etc.)
- Check full error details in terminal

**Scenario C: Webhook succeeds but reservation not confirmed**
- ✅ Webhook processing complete
- ❌ Business logic issue
- Check reservation status in database
- Look for `[markReservationPaidAndConfirmed]` logs

---

## Step 6: Check Environment Variables

### 6.1 Verify .env.local

Your `/web/.env.local` should have:
```bash
# Required for webhook signature verification (production)
PAYMONGO_WEBHOOK_SECRET=whsk_xxxxxxxxxxxxx

# Required for creating payments/sources
PAYMONGO_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Public key for client-side (not used in webhook)
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
```

**Note:** In development mode, webhook signature verification is automatically bypassed if `PAYMONGO_WEBHOOK_SECRET` is not set. This is intentional for easier testing.

### 6.2 Verify Webhook Secret

Get your webhook secret from PayMongo dashboard:
1. Go to **Developers** → **Webhooks**
2. Click on your webhook
3. Find "Signing Secret" or "Webhook Secret"
4. Copy and set as `PAYMONGO_WEBHOOK_SECRET` in `.env.local`

**Important:** Restart dev server after changing `.env.local`

---

## Troubleshooting Flowchart

```
START: Click "Authorize Test Payment"
  |
  ├─> Do you see "🚨🚨🚨 POST REQUEST RECEIVED" in terminal?
  |   |
  |   ├─> YES: Webhook reached server ✅
  |   |   └─> Check logs for processing errors
  |   |
  |   └─> NO: Webhook NOT reaching server ❌
  |       |
  |       ├─> Check ngrok web interface (localhost:4040)
  |       |   ├─> Requests shown? → Check status codes
  |       |   └─> No requests? → PayMongo not sending
  |       |
  |       ├─> Check PayMongo dashboard webhook logs
  |       |   ├─> Delivery failures? → Check error message
  |       |   └─> No attempts? → Webhook not triggered
  |       |
  |       └─> Test health check endpoint
  |           ├─> Works? → PayMongo config issue
  |           └─> Fails? → Network/ngrok issue
```

---

## Expected Terminal Output

### Successful Webhook Processing

```
🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨
🚨 [PayMongo Webhook] Timestamp: 2025-11-24T12:34:56.789Z
🚨 [PayMongo Webhook] Request URL: https://abc123.ngrok.io/api/webhooks/paymongo
🚨 [PayMongo Webhook] Request method: POST

================================================================================
[PayMongo Webhook] 2025-11-24T12:34:56.789Z - Processing webhook
================================================================================

🔍 [Webhook Debug Checklist]
  ✓ Endpoint reachable? YES - this log confirms it
  ✓ POST method? POST
  ✓ Content-Type: application/json
  ✓ Has paymongo-signature? true
  ✓ Content-Length: 1234
  ✓ User-Agent: PayMongo-Webhook/1.0
  ✓ Origin: null
  ✓ All headers: { ... }

[PayMongo Webhook] Request body received: {
  bodyLength: 1234,
  bodyPreview: '{"data":{"id":"evt_..."...',
  hasSignature: true
}

🔐 [verifyWebhookSignature] Starting signature verification
🔐 [verifyWebhookSignature] Has signature header? true
🔐 [verifyWebhookSignature] Is development mode? true
⚠️ [verifyWebhookSignature] DEVELOPMENT MODE: No webhook secret configured
⚠️ [verifyWebhookSignature] Bypassing signature verification (UNSAFE for production)

[PayMongo Webhook] Signature verification: {
  valid: true,
  hasWebhookSecret: false,
  isDevelopment: true,
  bypassedInDev: true
}

[PayMongo Webhook] 📦 Event parsed: {
  eventType: 'source.chargeable',
  eventId: 'evt_123...',
  ...
}

[PayMongo Webhook] 🔄 Handling source.chargeable event
[handleSourceChargeable] 🔄 Starting handler
...
[markReservationPaidAndConfirmed] ✅✅✅ Reservation confirmed successfully
[PayMongo Webhook] ✅ Webhook processed successfully
```

---

## Quick Reference Commands

```bash
# Start dev server
npm run dev:web --workspace=web

# Start ngrok
npx ngrok http 3000

# Check ngrok web interface
open http://localhost:4040

# Test health check
curl https://YOUR-NGROK-URL/api/webhooks/paymongo

# Send test webhook
curl -X POST https://YOUR-NGROK-URL/api/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":"test","type":"event","attributes":{"type":"source.chargeable","data":{"id":"src_test","type":"source"}}}}'

# Check running processes
lsof -i :3000  # Dev server
lsof -i :4040  # ngrok web interface
```

---

## Next Steps After Diagnosis

### If Webhooks Are NOT Reaching Server
1. **Network Issue:** Fix ngrok URL configuration
2. **PayMongo Issue:** Contact PayMongo support with:
   - Webhook URL
   - Expected events
   - Webhook ID from dashboard
   - Evidence that endpoint is reachable (health check test)

### If Webhooks Reach Server But Fail
1. **Signature Verification Failure:**
   - Verify `PAYMONGO_WEBHOOK_SECRET` is correct
   - Check signature verification logs for details
   - Test with development bypass first

2. **Database Errors:**
   - Check Supabase connection
   - Verify RLS policies allow service role access
   - Check migration 006 status (reservations.status constraint)

3. **Business Logic Errors:**
   - Check payment status in database
   - Verify reservation exists
   - Check for race conditions (payment already processed)

---

## Contact Points

- **PayMongo Support:** https://developers.paymongo.com/docs/support
- **ngrok Documentation:** https://ngrok.com/docs
- **Supabase Issues:** Check database logs in Supabase dashboard

---

## Diagnostic Log Collection

If you need to report an issue, collect these logs:

1. **Dev server terminal output** (complete logs from payment initiation to webhook)
2. **ngrok web interface screenshot** (showing requests or lack thereof)
3. **PayMongo webhook delivery logs** (from dashboard)
4. **Health check test result** (curl output)
5. **Environment variables** (redact secrets):
   ```bash
   echo "PAYMONGO_WEBHOOK_SECRET set: $([ -n "$PAYMONGO_WEBHOOK_SECRET" ] && echo YES || echo NO)"
   echo "NODE_ENV: $NODE_ENV"
   ```

---

## Success Criteria

You'll know webhooks are working when:

1. ✅ Terminal shows `🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨`
2. ✅ Event type is logged (e.g., `🔄 Handling source.chargeable event`)
3. ✅ Signature verification passes (or bypassed in dev)
4. ✅ Payment record updated to `status: 'completed'`
5. ✅ Reservation status changes to `'paid'` then `'confirmed'`
6. ✅ User sees success page with confirmed booking
7. ✅ No errors in terminal logs

If all of the above occur, webhooks are working correctly! 🎉
