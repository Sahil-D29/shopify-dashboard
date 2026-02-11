# Feature & API Parity Audit (Post-Cleanup)

**Date:** 2025-01-29  
**Scope:** shopify-dashboard Next.js application vs. former Express backend  
**Rule:** Analysis only — no code was modified.

---

## 1. API Route Coverage

| Feature | Status | Notes |
|--------|--------|--------|
| **Authentication (NextAuth)** | ✅ Fully implemented | `app/api/auth/[...nextauth]`, signin, signout, signup, callback, install, shopify/callback, forgot-password, logout. Session via `auth()` from `lib/auth`. |
| **Teams** | ✅ Fully implemented | `app/api/teams/[storeId]` (route, invite, add-user, remove-user, activity-logs, members/[userId], members/[userId]/role, members/[userId]/permissions), `teams/invitations/pending`, `teams/invitations/[id]`, resend, `teams/invitations/accept/[token]`. Uses `getUserContext` / store filter. |
| **Shopify API integration** | ✅ Fully implemented | `app/api/shopify/[resource]`, shopify/customers, orders, products, checkouts, analytics, catalog, discount-codes, test-connection, etc. |
| **Campaigns** | ✅ Routes implemented | `app/api/campaigns` (GET/POST), `campaigns/[id]` (GET/PUT/DELETE), send, resume, duplicate, message-stats. |
| **Journeys** | ✅ Fully implemented | Full set under `app/api/journeys` (CRUD, activate, pause, process, enroll, enrollments, nodes, versions, templates, test, etc.). |
| **Segments** | ✅ Fully implemented | `app/api/segments`, segments/[id], preview, compare, estimate, sync, customers, analytics. |
| **Brands** | ✅ Fully implemented | `app/api/brands` (GET/POST), `app/api/brands/stores/[storeId]/brand` (GET/PUT). Uses session + store filter. |
| **Coupons** | ⚠️ Partially implemented | **Shopify discount codes:** ✅ `app/api/shopify/discount-codes`. **App-level promo coupons:** Prisma `Coupon` model exists; `lib/stripe.ts` passes `couponCode` in checkout metadata. **No** dedicated `app/api/coupons` CRUD (create/list/validate app coupons). |
| **Subscriptions** | ⚠️ Partially implemented | ✅ `app/api/subscriptions` (GET), `app/api/subscriptions/plan-features` (GET). ❌ **Missing:** `app/api/subscriptions/usage` — `UsageTracker` component calls `GET /api/subscriptions/usage?storeId=...` but this route does not exist. |
| **Stripe APIs** | ✅ Fully implemented | `lib/stripe.ts`: getStripe(), getPlanFeatures(), createCheckoutSession(), handleWebhookEvent(). Used by subscription flow and webhooks. |
| **Shopify webhooks** | ✅ Fully implemented | `app/api/webhooks/shopify/route.ts`: raw body, HMAC verification, supported topics (orders, checkouts, customers), `matchAndExecuteJourneys()`, segment re-evaluation queue. |
| **Stripe webhooks** | ✅ Fully implemented | `app/api/webhooks/stripe/route.ts`: raw body, `stripe.webhooks.constructEvent()`, `handleWebhookEvent()`. |

---

## 2. Authentication

| Item | Status | Notes |
|------|--------|--------|
| NextAuth as only app auth | ✅ | `lib/auth.ts`: NextAuth with Google + Credentials, Prisma User, `findUserByEmail` / `findUserById` (fileAuth). |
| Legacy JWT middleware | ✅ None | No Express JWT or passport. Middleware uses `getToken` from `next-auth/jwt` for app routes. |
| Admin auth | ✅ Separate, not legacy | Admin uses `admin_session` cookie + `jose` `jwtVerify` in middleware (admin panel only). Not the old Express backend JWT. |
| Protected routes | ✅ | Middleware: auth pages allowed when unauthenticated; other pages require NextAuth token; `/api/cron`, `/api/webhooks`, `/api/auth`, `/api/health` allowed. API routes use `auth()` or `getUserContext()` / getStoreFilter and return 401 when unauthorized. |

---

## 3. Database & Prisma

| Item | Status | Notes |
|------|--------|--------|
| Single Prisma client | ✅ | `lib/prisma.ts` only; global singleton in dev. |
| Neon adapter only | ✅ | `PrismaNeon` with `process.env.DATABASE_URL`. |
| Required models in schema | ✅ | `prisma/schema.prisma` includes: User, Store, StoreMember, Segment, Campaign, CampaignLog, Journey, JourneyEnrollment, JourneyLog, Subscription, Payment, ActivityLog, ErrorLog, SystemHealth, PlanFeature, UsageMetric, Coupon, Brand, WhatsAppConfig, CampaignQueueItem, Invitation, SegmentSyncStatus. |
| Backend-only models missing | ✅ None | All listed models have corresponding usage in app or workers. |

---

## 4. Background Jobs & Cron

| Item | Status | Notes |
|------|--------|--------|
| Campaign processing | ⚠️ Partially implemented | **Queue + cron:** ✅ `app/api/cron/campaign-runner` calls `runCampaignWorkerStep()` from `jobs/campaign.worker.ts`. Worker: picks pending `CampaignQueueItem`, marks PROCESSING, then **marks campaign COMPLETED and deletes queue item** — no segment fetch, no customer list, no email/SMS/WhatsApp send. TODO in code: "Port full campaign execution from backend/workers/campaignExecutor.js". |
| Journey execution | ✅ Implemented | `app/api/cron/journey-runner` → `processScheduledJourneySteps()` in `lib/journey-engine/scheduler.ts` → `processScheduledExecutions()` in `lib/journey-engine/executor.ts`. Full executor (conditions, delays, WhatsApp, Shopify helpers). |
| Shopify token refresh/check | ✅ Implemented | `app/api/cron/shopify-token-check` → `runShopifyTokenCheck()` in `jobs/shopify-token.worker.ts`. Validates one store token via GraphQL, updates `SystemHealth`. |
| Cron/scheduled execution | ✅ Configured | GET `/api/cron/*` protected by `CRON_SECRET` query param. Middleware allows `/api/cron` without session. No cron definition in `vercel.json` — scheduling is external (e.g. Vercel Cron or other scheduler). |

---

## 5. Frontend Integration

| Item | Status | Notes |
|------|--------|--------|
| No localhost:5000 / API_BASE | ✅ | Grep: no `localhost:5000`, `API_BASE`, or `NEXT_PUBLIC_API` in shopify-dashboard. |
| UI points to Next.js APIs | ✅ | Fetch calls use relative `/api/...` (e.g. `/api/teams/${storeId}`, `/api/segments`, `/api/user`, `/api/auth/logout`). |
| Broken / missing API usage | ⚠️ One | `UsageTracker` calls `GET /api/subscriptions/usage?storeId=...` — route does not exist; usage metrics will fail for that component. |

---

## Summary

### ✅ Completed items

- NextAuth-only app auth; protected routes and API auth checks.
- Single Prisma client with Neon; full schema present.
- Teams, Brands, Subscriptions (list/plan-features), Stripe (checkout + webhook), Shopify (API + webhooks), Campaigns (API routes), Journeys (full API + executor), Segments (full API).
- Cron routes for campaign-runner, journey-runner, shopify-token-check; journey and token workers implemented.
- No backend proxy or legacy Express references in frontend.

### ⚠️ Gaps or partial migrations

1. **Campaign worker:** Queue and cron exist; **actual send logic** (segment → customers → email/SMS/WhatsApp) is not ported — worker only marks campaign completed and removes queue item.
2. **Subscriptions usage API:** **Missing** `GET /api/subscriptions/usage` — required by `UsageTracker`; that component will get 404.
3. **App-level coupons:** Prisma `Coupon` model and Stripe metadata for coupon code exist; **no** CRUD API for app coupons (create/list/validate). Shopify discount codes are covered by `/api/shopify/discount-codes`.

### ❌ Missing functionality

- **`/api/subscriptions/usage`** — implement so UsageTracker can load usage/limits (e.g. from `UsageMetric` / plan features).
- **Full campaign execution** in `jobs/campaign.worker.ts` — port segment fetch, customer resolution, and channel send (email/SMS/WhatsApp) from legacy campaign executor.

---

## Recommended next migration steps (priority order)

1. **Add `GET /api/subscriptions/usage`**  
   Implement route (e.g. by storeId/userId + plan/subscription) and return usage + limits so `UsageTracker` works without changing its contract.

2. **Port full campaign send logic**  
   In `jobs/campaign.worker.ts`, replace the “mark completed only” logic with: resolve segment → fetch customers → send via email/SMS/WhatsApp (and update campaign stats/logs) so behavior matches the former backend.

3. **(Optional) App coupons API**  
   If app-level promo coupons (Prisma `Coupon`) are required: add `app/api/coupons` (e.g. list, validate, apply at checkout) and wire Stripe/checkout if needed.

4. **(Optional) Cron schedule**  
   If using Vercel: add `crons` in `vercel.json` for `/api/cron/campaign-runner`, `/api/cron/journey-runner`, `/api/cron/shopify-token-check` with appropriate intervals; otherwise keep using external scheduler.

---

*Audit performed without modifying any code, logic, schemas, or configs.*
