# Environment Variables Setup for Rallio

## Critical: Required for Webhook Functionality

The payment webhook handler requires the `SUPABASE_SERVICE_ROLE_KEY` to function correctly. Without it, the webhook cannot update reservations.

## Complete Environment Configuration

### Web Application (`/web/.env.local`)

```bash
# ============================================================================
# SUPABASE
# ============================================================================
# Get these from: https://supabase.com/dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ⚠️ CRITICAL: service_role key is REQUIRED for payment webhooks
# The webhook handler uses this to bypass RLS policies when confirming reservations
# DO NOT expose this key in client-side code - it's server-only


# ============================================================================
# PAYMONGO (Payment Provider)
# ============================================================================
# Get these from: https://dashboard.paymongo.com/developers/api-keys
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_xxx  # Use pk_live_xxx for production
PAYMONGO_SECRET_KEY=sk_test_xxx              # Use sk_live_xxx for production

# Webhook signing secret - get from PayMongo webhook configuration
# https://dashboard.paymongo.com/developers/webhooks
PAYMONGO_WEBHOOK_SECRET=whsec_xxx

# ⚠️ REQUIRED in production for webhook signature verification
# In development, verification is bypassed (warning logged)


# ============================================================================
# APPLICATION
# ============================================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000    # Production: https://your-domain.com

# Used for:
# - PayMongo redirect URLs (success/failed pages)
# - Email link generation
# - QR code generation


# ============================================================================
# OPTIONAL / DEPRECATED
# ============================================================================
# Mapbox token - DEPRECATED (now using Leaflet with OpenStreetMap)
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
```

## How to Get Your Keys

### Supabase Keys

1. Go to https://supabase.com/dashboard
2. Select your Rallio project
3. Click Settings → API
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ CRITICAL

**Security Note:** The service_role key bypasses Row Level Security. Never expose it in client-side code.

### PayMongo Keys

#### Test Mode (Development)
1. Go to https://dashboard.paymongo.com
2. Click "Developers" → "API Keys"
3. Toggle to "Test mode"
4. Copy:
   - **Public key** → `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` (starts with `pk_test_`)
   - **Secret key** → `PAYMONGO_SECRET_KEY` (starts with `sk_test_`)

#### Webhook Secret
1. In PayMongo Dashboard, click "Developers" → "Webhooks"
2. Create a new webhook (or edit existing):
   - **URL:** `https://your-domain.com/api/webhooks/paymongo` (or ngrok URL for dev)
   - **Events:** Select `source.chargeable`, `payment.paid`, `payment.failed`
3. After creating, click "Show signing secret"
4. Copy the secret → `PAYMONGO_WEBHOOK_SECRET` (starts with `whsec_`)

#### Production Mode
1. Toggle to "Live mode" in PayMongo dashboard
2. Get live keys (starts with `pk_live_` and `sk_live_`)
3. Update webhook URL to production domain
4. Get new webhook secret for production webhook

## Verification Steps

### 1. Check Environment Variables Loaded

```bash
# In your Next.js app, create a test API route:
# /app/api/test-env/route.ts

export async function GET() {
  return Response.json({
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    paymongoPublic: !!process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY,
    paymongoSecret: !!process.env.PAYMONGO_SECRET_KEY,
    webhookSecret: !!process.env.PAYMONGO_WEBHOOK_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  })
}

# Visit http://localhost:3000/api/test-env
# All values should be true (except webhookSecret may be false in dev)
```

### 2. Test Supabase Connection

```bash
# In your app, check Supabase connection:
npm run dev:web

# In browser console:
const { data, error } = await window.supabase.from('venues').select('count')
console.log('Supabase connected:', !error)
```

### 3. Test PayMongo API Access

```bash
# Make a test API call to PayMongo:
curl https://api.paymongo.com/v1/sources \
  -u sk_test_YOUR_SECRET_KEY:
```

Expected response: List of payment sources or empty array (not an authentication error)

## Common Issues

### Issue: "SUPABASE_SERVICE_ROLE_KEY is required in production environment"

**Cause:** Missing service_role key in .env.local

**Fix:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "service_role" key (NOT anon key)
3. Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=eyJ...`
4. Restart Next.js server: `npm run dev:web`

### Issue: "Invalid webhook signature"

**Cause:** Wrong or missing PAYMONGO_WEBHOOK_SECRET

**Fix:**
1. Go to PayMongo Dashboard → Developers → Webhooks
2. Click "Show signing secret" for your webhook
3. Update `PAYMONGO_WEBHOOK_SECRET` in `.env.local`
4. Restart Next.js server

**Development Workaround:** The webhook handler bypasses signature verification in development mode (logs a warning).

### Issue: "Payment provider is temporarily unavailable"

**Cause:** Invalid PayMongo secret key or account not enabled for GCash/Maya

**Fix:**
1. Verify `PAYMONGO_SECRET_KEY` is correct
2. Check if your PayMongo account is approved for GCash/Maya payments
3. Test mode accounts may have payment method restrictions
4. Contact PayMongo support to enable payment methods

### Issue: Webhook not receiving events

**Cause:** Incorrect webhook URL or localhost not accessible

**Fix (Development):**
1. Use ngrok or similar tunnel service:
   ```bash
   ngrok http 3000
   ```
2. Update PayMongo webhook URL to ngrok URL:
   ```
   https://abc123.ngrok.io/api/webhooks/paymongo
   ```
3. Update NEXT_PUBLIC_APP_URL to match:
   ```
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```

**Fix (Production):**
1. Verify your production domain is accessible
2. Check SSL certificate is valid
3. Ensure `/api/webhooks/paymongo` route is deployed
4. Check server logs for incoming webhook requests

## Environment-Specific Configurations

### Development (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_xxx
PAYMONGO_SECRET_KEY=sk_test_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx  # Optional in dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (Vercel Environment Variables)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⚠️ CRITICAL
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_live_xxx
PAYMONGO_SECRET_KEY=sk_live_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx  # ⚠️ REQUIRED
NEXT_PUBLIC_APP_URL=https://rallio.com
```

## Security Best Practices

1. **Never commit .env.local** - Already in .gitignore
2. **Use environment-specific keys** - Test keys for dev, live keys for prod
3. **Rotate keys regularly** - Especially if exposed or suspected compromise
4. **Restrict service_role usage** - Only use in server-side code (API routes, server actions)
5. **Verify webhook signatures** - Always validate in production
6. **Use HTTPS in production** - Required for PayMongo webhooks
7. **Monitor failed webhook deliveries** - Set up alerts in PayMongo dashboard

## Deployment Checklist

Before deploying to production:

- [ ] All environment variables set in hosting platform (Vercel/etc)
- [ ] Using LIVE PayMongo keys (pk_live_, sk_live_)
- [ ] Webhook URL points to production domain
- [ ] PAYMONGO_WEBHOOK_SECRET is set (production webhook secret)
- [ ] SUPABASE_SERVICE_ROLE_KEY is set
- [ ] NEXT_PUBLIC_APP_URL points to production domain
- [ ] SSL certificate is valid
- [ ] Test a payment end-to-end in production
- [ ] Monitor webhook delivery in PayMongo dashboard
- [ ] Check application logs for webhook processing

## Support

If you encounter environment configuration issues:

1. Check Next.js server logs for environment variable errors
2. Verify all keys are copied correctly (no extra spaces/newlines)
3. Restart the development server after changing .env.local
4. Use the verification steps above to test each integration
5. Check Supabase/PayMongo dashboards for API usage errors
