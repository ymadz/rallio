# Quick Start: Webhook Testing (2 Minutes)

## Step 1: Start Dev Server
```bash
cd /Users/madz/Documents/GitHub/rallio
npm run dev:web --workspace=web
```

Wait for: `✓ Ready on http://localhost:3000`

---

## Step 2: Run Quick Test
Open a new terminal:
```bash
cd /Users/madz/Documents/GitHub/rallio
./test-webhook.sh
```

---

## Step 3: Interpret Results

### ✅ All Tests Pass
```
✅ Health check passed (HTTP 200)
✅ Webhook POST succeeded (HTTP 200)
✅ CORS preflight succeeded (HTTP 204)
✅ All tests passed!
```

**What this means:** Your webhook endpoint is working correctly locally.

**Next:** Test with ngrok (see below)

---

### ❌ Tests Fail
```
❌ Health check failed (HTTP 404)
❌ Webhook POST failed (HTTP 404)
```

**What this means:** Webhook route is not accessible.

**Fix:**
1. Verify dev server is running
2. Check for errors in dev server terminal
3. Restart dev server
4. Retry test

---

## Step 4: Test with ngrok

### Start ngrok
```bash
npx ngrok http 3000
```

Copy the "Forwarding" URL (example: `https://abc123.ngrok.io`)

### Run test with ngrok URL
```bash
./test-webhook.sh https://YOUR-NGROK-URL
```

Replace `YOUR-NGROK-URL` with your actual ngrok URL.

---

## Step 5: Update PayMongo Dashboard

1. Go to: https://dashboard.paymongo.com/
2. Navigate: **Developers** → **Webhooks**
3. Find your webhook (or create new one)
4. Update URL: `https://YOUR-NGROK-URL/api/webhooks/paymongo`
5. Verify events selected:
   - ✅ `source.chargeable`
   - ✅ `payment.paid`
   - ✅ `payment.failed`
6. Save changes

---

## Step 6: Make Test Payment

1. Open http://localhost:3000 in browser
2. Find a court and create a booking
3. Select payment method (GCash or Maya)
4. Click "Proceed to Payment"
5. On PayMongo test page: Click **"Authorize Test Payment"**
6. **IMMEDIATELY look at dev server terminal**

---

## What to Look For

### ✅ SUCCESS: Webhook Arrived
You'll see this in terminal:
```
🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED! 🚨🚨🚨
🚨 [PayMongo Webhook] Timestamp: 2025-11-24T...
🔍 [Webhook Debug Checklist]
  ✓ Endpoint reachable? YES - this log confirms it
```

**Result:** Webhook is working! Payment should complete.

---

### ❌ FAILURE: No Webhook Logs
You see nothing after clicking "Authorize Test Payment".

**What to check:**
1. **ngrok web interface:** http://localhost:4040
   - Look for POST to `/api/webhooks/paymongo`
   - If you see requests: check status code
   - If no requests: PayMongo isn't sending

2. **PayMongo dashboard:**
   - Go to Developers → Webhooks
   - Click your webhook
   - Check "Recent Deliveries" for failures

3. **Webhook URL:**
   - Verify it matches ngrok URL EXACTLY
   - Must be: `https://abc123.ngrok.io/api/webhooks/paymongo`
   - NOT: `http://localhost:3000/...`

---

## Quick Troubleshooting

### Problem: Health check fails
**Fix:** Restart dev server

### Problem: Tests pass locally but fail with ngrok
**Fix:** Restart ngrok, update PayMongo webhook URL

### Problem: Tests pass but no webhooks during payment
**Fix:**
1. Check ngrok interface (http://localhost:4040)
2. Verify PayMongo webhook URL is correct
3. Check PayMongo dashboard for delivery failures

### Problem: Webhooks arrive but payment fails
**Fix:** Check error logs in terminal for specific issue

---

## Files to Reference

- **Complete Guide:** `WEBHOOK_TEST_INSTRUCTIONS.md`
- **Implementation Details:** `WEBHOOK_DIAGNOSIS_SUMMARY.md`
- **Test Payload:** `test-webhook.json`
- **Test Script:** `test-webhook.sh`

---

## One-Liner Commands

```bash
# Quick test
./test-webhook.sh

# Test with ngrok
./test-webhook.sh https://YOUR-NGROK-URL

# Manual health check
curl http://localhost:3000/api/webhooks/paymongo

# Manual webhook POST
curl -X POST http://localhost:3000/api/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -d @test-webhook.json

# Check ngrok interface
open http://localhost:4040
```

---

## Expected Timeline

- **Step 1-2:** 30 seconds (start server, run test)
- **Step 3:** 10 seconds (check results)
- **Step 4:** 1 minute (start ngrok, run test)
- **Step 5:** 1 minute (update PayMongo)
- **Step 6:** 2 minutes (test payment flow)

**Total:** ~5 minutes to complete diagnosis

---

## Success Criteria

You'll know it's working when:
1. ✅ Test script shows "All tests passed"
2. ✅ Terminal shows `🚨🚨🚨 [PayMongo Webhook] POST REQUEST RECEIVED!`
3. ✅ Reservation status becomes 'confirmed'
4. ✅ Success page displays booking confirmation

If you see the 🚨🚨🚨 log, webhooks are reaching your server! 🎉
