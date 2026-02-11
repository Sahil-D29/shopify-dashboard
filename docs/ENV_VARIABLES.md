# Environment Variables Reference

What every variable is for, whether it’s required, and what to put.  
Use **.env.local** locally; on **Render** set the same keys in **Environment**.

---

## Quick: what you must add

Your `.env.local` is missing one **required** variable the app needs to build and run:

| Variable | What to put |
|----------|-------------|
| **ENCRYPTION_KEY** | 64 hex characters. Run: `node scripts/generate-secrets.js` and copy the `ENCRYPTION_KEY=` line into `.env.local`. |

---

## By category

### Database (Neon) — required

| Variable | Required | What to put |
|----------|----------|-------------|
| **DATABASE_URL** | Yes | Neon **pooled** connection string, e.g. `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require` |
| **DIRECT_URL** | No | Neon **direct** (non-pooler) URL; only needed if you run `prisma migrate` against this DB. Prisma 7 uses `prisma.config.js` for URL. |

You already have these; keep them.

---

### Auth (NextAuth) — required

| Variable | Required | What to put |
|----------|----------|-------------|
| **NEXTAUTH_URL** | Yes | **Local:** `http://localhost:3002` — **Render:** `https://your-app.onrender.com` (no trailing slash) |
| **NEXTAUTH_SECRET** | Yes | Long random string. Generate: `node scripts/generate-secrets.js` or `openssl rand -base64 32` |
| **AUTH_SECRET** | No | Same as NEXTAUTH_SECRET; Auth.js can use either. |
| **ENCRYPTION_KEY** | Yes | **64 hex characters only.** Generate: `node scripts/generate-secrets.js` → copy `ENCRYPTION_KEY=...` |
| **ADMIN_JWT_SECRET** | No | For `/admin` login. Can be same as NEXTAUTH_SECRET or generate separately. |

---

### Google OAuth — optional (needed for “Continue with Google”)

| Variable | Required | What to put |
|----------|----------|-------------|
| **GOOGLE_CLIENT_ID** | If using Google | From Google Cloud Console → APIs & Services → Credentials |
| **GOOGLE_CLIENT_SECRET** | If using Google | From same place |

**Redirect URI in Google Console:**  
- Local: `http://localhost:3002/api/auth/callback/google`  
- Render: `https://your-app.onrender.com/api/auth/callback/google`

You already have these; keep them.

---

### Shopify — required for Shopify features

| Variable | Required | What to put |
|----------|----------|-------------|
| **SHOPIFY_API_KEY** | Yes (for OAuth) | From Shopify Partner Dashboard → App → Client credentials |
| **SHOPIFY_API_SECRET** | Yes (for OAuth) | From same place |
| **SHOPIFY_SCOPES** | No | Comma-separated scopes, e.g. `read_products,write_products,read_orders,read_customers,write_customers,read_checkouts,write_script_tags`. App has defaults if unset. |
| **SHOPIFY_WEBHOOK_SECRET** | For webhooks | From Shopify when you register the webhook URL; used to verify `/api/webhooks/shopify` |
| **SHOPIFY_API_VERSION** | No | e.g. `2024-10`. Optional; app has default. |
| **SHOPIFY_STORE_URL** / **SHOPIFY_STORE_DOMAIN** | Dev/single-store | Your dev store, e.g. `your-store.myshopify.com` |
| **SHOPIFY_ACCESS_TOKEN** / **SHOPIFY_ADMIN_TOKEN** | Dev/single-store | Store’s Admin API token (for dev or single-store use). In production, tokens usually come from DB after OAuth. |

You already have API key/secret and store/token; add **SHOPIFY_WEBHOOK_SECRET** when you register webhooks.

---

### Stripe — optional (for subscriptions)

| Variable | Required | What to put |
|----------|----------|-------------|
| **STRIPE_SECRET_KEY** | If using Stripe | From Stripe Dashboard → Developers → API keys |
| **STRIPE_WEBHOOK_SECRET** | If using webhooks | From Stripe → Webhooks → your endpoint → Signing secret |

Add these when you enable subscriptions.

---

### App URL (for redirects, webhooks, links)

| Variable | Required | What to put |
|----------|----------|-------------|
| **NEXTAUTH_URL** | Yes | Same as above (used as base URL when others unset) |
| **NEXT_PUBLIC_BASE_URL** | No | Same as NEXTAUTH_URL; used for Shopify OAuth redirect and client. **Render:** set to `https://your-app.onrender.com` |
| **APP_URL** / **APP_BASE_URL** / **NEXT_PUBLIC_APP_URL** | No | Same value; used by refresh, install, forgot-password. If unset, app falls back to NEXTAUTH_URL. |

**Local:** `NEXTAUTH_URL=http://localhost:3002` is enough.  
**Render:** set **NEXTAUTH_URL** and optionally **NEXT_PUBLIC_BASE_URL** to your Render URL.

---

### Meta / WhatsApp — optional

| Variable | Required | What to put |
|----------|----------|-------------|
| **META_APP_ID** | If using WhatsApp | Meta App ID |
| **META_APP_SECRET** | If using WhatsApp | Meta App Secret |
| **META_ACCESS_TOKEN** | If using WhatsApp | Page/App access token |
| **WHATSAPP_PHONE_NUMBER_ID** | If using WhatsApp | From Meta Business → WhatsApp → Phone numbers |
| **WHATSAPP_BUSINESS_ACCOUNT_ID** | If using WhatsApp | WABA ID |
| **WHATSAPP_ACCESS_TOKEN** | If using WhatsApp | Same as or separate from META_ACCESS_TOKEN |
| **WHATSAPP_VERIFY_TOKEN** | For webhook | Token you choose; same value in Meta webhook config |
| **WHATSAPP_WEBHOOK_SECRET** | No | If Meta provides one for signature verification |

You already have the main Meta/WhatsApp vars; add verify/webhook vars when you set up the webhook.

---

### Cron (scheduled jobs)

| Variable | Required | What to put |
|----------|----------|-------------|
| **CRON_SECRET** | If using /api/cron/* | Random string; call routes with `?secret=YOUR_CRON_SECRET` |

Optional; add when you use Render Cron or an external scheduler.

---

### Email (e.g. forgot password, invites)

| Variable | Required | What to put |
|----------|----------|-------------|
| **SMTP_HOST** | If sending email | e.g. `smtp.gmail.com` |
| **SMTP_PORT** | If sending email | e.g. `587` or `465` |
| **SMTP_USER** | If sending email | SMTP login |
| **SMTP_PASS** | If sending email | SMTP password |
| **SMTP_FROM** | No | From address; defaults to SMTP_USER or noreply@yourdomain.com |

Optional; add when you need email sending.

---

### Other

| Variable | Required | What to put |
|----------|----------|-------------|
| **NODE_ENV** | No | `development` or `production`; Next often sets this. |
| **PORT** | No | Local: e.g. `3002`. Render sets this automatically. |
| **CAMPAIGN_RETRY_LIMIT** | No | Number, e.g. `3`. Default 3. |
| **NEXT_PUBLIC_USE_UNIFIED_TRIGGER** / **USE_UNIFIED_TRIGGER** | No | Feature flag |
| **NEXT_PUBLIC_JOURNEY_TRIGGER_V2** / **JOURNEY_TRIGGER_V2** | No | Feature flag |

---

## Summary: what to put in .env.local (you)

- Keep everything you already have.
- **Add:** **ENCRYPTION_KEY** (run `node scripts/generate-secrets.js` and copy the line).
- For **Render:** set the same variables in the Render **Environment**; set **NEXTAUTH_URL** (and optionally **NEXT_PUBLIC_BASE_URL**) to `https://your-app.onrender.com`.
- Never commit `.env.local` or paste real secrets into the repo.
