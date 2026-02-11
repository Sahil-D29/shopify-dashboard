# Deploy shopify-dashboard on Render (Production-Ready)

This guide configures the Next.js **shopify-dashboard** app on [Render](https://render.com) so it is publicly accessible, stable, and fully functional (Auth, Shopify, Stripe, Prisma, Cron).

---

## 1. Push code to GitHub (production branch)

If you haven’t pushed to GitHub yet:

```bash
# From your project root (e.g. c:\Users\asus\Desktop\Shopify)
cd c:\Users\asus\Desktop\Shopify

# Ensure you're on production branch (or main)
git checkout production
# If you use main: git checkout main

# Add and commit all changes
git add .
git commit -m "Prepare Render deployment (scripts, Prisma, base URL)"

# Add GitHub remote if not already added
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
# If remote exists, skip the line above.

# Push production branch
git push -u origin production
# Or: git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub repo. Use the branch name you use for production (`production` or `main`).

---

## 2. Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com).
2. **New** → **Web Service**.
3. Connect your GitHub account and select the repo that contains **shopify-dashboard**.
4. Use these settings:  
   **If your Git repo root is the parent of the app** (e.g. repo is `Shopify` and the app is in `shopify-dashboard/`), set **Root Directory** to `shopify-dashboard`. If the repo root is already `shopify-dashboard`, leave Root Directory empty or `.`.

| Field | Value |
|--------|--------|
| **Name** | `shopify-dashboard` (or any name) |
| **Region** | Choose one (e.g. Oregon) |
| **Branch** | `production` (or `main`) |
| **Root Directory** | `shopify-dashboard` (if app is in a subfolder of the repo) |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free or paid (Free has cold starts) |

5. **Advanced** → **Add Environment Variable** → set **Node Version** (optional):  
   Key: `NODE_VERSION` → Value: `18` (or `20`).

6. Click **Create Web Service**.  
   Render will assign a URL like `https://shopify-dashboard-xxxx.onrender.com`.  
   You need this URL for env vars below.

---

## 3. Environment variables (REQUIRED)

In Render: your service → **Environment** tab → **Add Environment Variable**. Add the following.  
**Do not commit `.env.local` or paste secrets into the repo.**

### Database (Neon)

| Key | Value | Notes |
|-----|--------|--------|
| `DATABASE_URL` | `postgresql://...` | Neon connection string (pooler), from Neon dashboard |
| `DIRECT_URL` | `postgresql://...` | Optional; Neon direct URL for migrations (e.g. run locally) |

### NextAuth

| Key | Value | Notes |
|-----|--------|--------|
| `NEXTAUTH_URL` | `https://<your-render-domain>` | e.g. `https://shopify-dashboard-xxxx.onrender.com` |
| `NEXTAUTH_SECRET` | Long random string | Generate: `openssl rand -base64 32` (or any secure random) |
| `ENCRYPTION_KEY` | 64 hex characters | Required at build/runtime for token encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Google Auth

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

In Google Console, add **Authorized redirect URI**:  
`https://<your-render-domain>/api/auth/callback/google`

### Shopify

| Key | Value | Notes |
|-----|--------|--------|
| `SHOPIFY_API_KEY` | From Shopify Partner Dashboard |
| `SHOPIFY_API_SECRET` | From Shopify Partner Dashboard |
| `SHOPIFY_SCOPES` | e.g. `read_products,write_products,read_orders,...` | As used in app |
| `SHOPIFY_APP_URL` or `NEXT_PUBLIC_BASE_URL` | `https://<your-render-domain>` | App URL for OAuth redirects |
| `SHOPIFY_WEBHOOK_SECRET` | Optional; for webhook signature verification |

In Shopify App settings set **App URL** to `https://<your-render-domain>` and **Allowed redirection URL(s)** to include `/api/auth/shopify/callback`.

### Stripe

| Key | Value |
|-----|--------|
| `STRIPE_SECRET_KEY` | From Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | From Stripe → Webhooks → signing secret for your endpoint |

### Optional (Cron, Admin, WhatsApp)

| Key | Value | Notes |
|-----|--------|--------|
| `CRON_SECRET` | Random string | Used to secure `/api/cron/*` when called by Render Cron or external scheduler |
| `ADMIN_JWT_SECRET` | Random string | For admin panel; can equal `NEXTAUTH_SECRET` |
| `NEXT_PUBLIC_BASE_URL` | `https://<your-render-domain>` | Optional; same as `NEXTAUTH_URL` for consistency |

Add WhatsApp/Meta vars if you use that integration (from your current `.env.local`).

---

## 4. Prisma & Neon

- **No `prisma migrate dev` on Render.**  
  Run migrations locally (or from CI) against the same Neon DB:
  ```bash
  cd shopify-dashboard
  npx prisma migrate deploy
  ```
- On Render, the build runs **`npx prisma generate`** only (no migrate).  
- Prisma client uses the **Neon adapter**; no local Postgres is required on Render.

---

## 5. Webhooks (after first deploy)

Once the app is live, set these URLs in external dashboards.

### Shopify

- Webhook URL: `https://<your-render-domain>/api/webhooks/shopify`
- In Shopify Admin → Settings → Notifications (or App setup), register this URL for the topics your app uses.
- Ensure `SHOPIFY_WEBHOOK_SECRET` is set if your app validates signatures.

### Stripe

- Webhook URL: `https://<your-render-domain>/api/webhooks/stripe`
- In Stripe Dashboard → Developers → Webhooks → Add endpoint → paste URL, select events → copy **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

Signature verification already uses the raw body in both Stripe and Shopify webhook routes; no extra config needed.

---

## 6. Cron & background jobs

Cron routes are under `/api/cron/*` (e.g. campaign-runner, journey-runner, shopify-token-check). They are protected by `CRON_SECRET` (query param `?secret=...`).

**Option A – Render Cron Jobs**

1. Render Dashboard → **Cron Jobs** → **New Cron Job**.
2. Link same repo, branch, and **Root Directory** `shopify-dashboard`.
3. Build: same as web service (e.g. `npm install && npx prisma generate && npm run build`).
4. Command examples (run on schedule):
   - Campaign runner:  
     `curl -s "https://<your-render-domain>/api/cron/campaign-runner?secret=YOUR_CRON_SECRET"`
   - Shopify token check:  
     `curl -s "https://<your-render-domain>/api/cron/shopify-token-check?secret=YOUR_CRON_SECRET"`
5. Set `CRON_SECRET` in the **Web Service** environment (same value you use in the URL).

**Option B – External scheduler**

Use cron.org, GitHub Actions, or another scheduler to call the same URLs with `?secret=YOUR_CRON_SECRET`.  
Keep `CRON_SECRET` strong and only in env (never in repo).

---

## 7. Post-deploy checklist

After the first successful deploy:

- [ ] App loads at `https://<your-render-domain>`.
- [ ] Sign-up / sign-in works (credentials + Google).
- [ ] Dashboard and settings pages load.
- [ ] Shopify connect/OAuth works (install app, callback).
- [ ] Stripe webhook receives events (check Stripe Dashboard → Webhooks → recent deliveries).
- [ ] Prisma/Neon: no DB errors in Render logs.
- [ ] No hardcoded localhost; all URLs use `NEXTAUTH_URL` or `NEXT_PUBLIC_BASE_URL`.

---

## 8. Troubleshooting

- **Build fails on Prisma**  
  Ensure `DATABASE_URL` is set in Render **Environment** (and that Neon DB is reachable). Build runs `npx prisma generate`, which needs `DATABASE_URL`.

- **Auth redirects to wrong URL**  
  Set `NEXTAUTH_URL` exactly to `https://<your-render-domain>` (no trailing slash). Update Google/Shopify redirect URIs to match.

- **Webhooks 400/401**  
  Check Stripe/Shopify webhook secrets and that the endpoint uses the raw body (already implemented). Re-create the webhook secret if the endpoint URL changed.

- **PORT**  
  Render sets `PORT`; the app uses `next start -p ${PORT:-3000}` so it binds to Render’s port. No need to set PORT manually unless you override.

---

## 9. Summary

| Item | Value |
|------|--------|
| **Root Directory** | `shopify-dashboard` |
| **Build** | `npm install && npx prisma generate && npm run build` |
| **Start** | `npm start` |
| **Node** | 18+ |
| **Required env** | `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, Google + Shopify + Stripe as above |

Once the service is created, all configuration is done in the Render Dashboard (Environment). Do not commit `.env.local` or production secrets.
