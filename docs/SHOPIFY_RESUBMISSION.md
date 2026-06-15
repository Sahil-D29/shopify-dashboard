# Shopify App Resubmission Notes

Use this as the reviewer-facing notes when resubmitting (suspension lifts
**2026-06-26**). It maps each flagged item to its resolution. Steps marked
**(manual)** must be done by the app owner in the Shopify Partner Dashboard —
they cannot be done in code.

---

## 1.2.2 — Shopify billing / coupons

**What the reviewer hit:** an error subscribing to a plan, and no way to obtain a
coupon.

**Fixed in code:**
- The app uses **Shopify Managed Pricing** (Shopify App Pricing). The subscribe
  button redirects to Shopify's hosted plan page; on approval Shopify redirects
  to `/api/billing/shopify-confirm`, which verifies the charge against the Admin
  API before activating.
- **Shopify is now the source of truth.** `reconcileShopifySubscription()`
  (`lib/billing-sync.ts`) runs on every billing-page load and from the
  `app_subscriptions/update` webhook. It syncs the real plan + next-billing date
  and **never marks a subscription ACTIVE without a real Shopify charge** (this
  fixed a stale "ACTIVE" record). `billingProvider` is set consistently.
- On reinstall, the reconcile re-reads Shopify state so charges can be
  accepted/declined again.

**Manual steps before resubmitting:**
1. **(manual)** Partner Dashboard → this app → **Pricing**: ensure the Managed
   Pricing plan **names/handles match** the app's plans (`free`, `starter`,
   `growth`). A mismatch is the most likely cause of the reviewer's subscribe
   error.
2. **(manual)** Confirm each plan's **return URL** is
   `https://app.dorza.io/api/billing/shopify-confirm`.
3. **(manual)** Run the plan seed so the DB matches: `npx tsx scripts/seed-plans.ts`.

**Coupon example for the reviewer (what they asked for):**
- Under Managed Pricing, **Shopify owns discounts** — the app cannot apply its
  own coupon codes to Shopify charges. To give the reviewer a discount:
  **(manual)** Partner Dashboard → this app → **Pricing** → add a discount
  (e.g. a 100%-off promo on the Starter plan) and share it with the reviewer.
  They apply it on Shopify's hosted plan page when subscribing.
- The app's internal coupon system applies only to non-Shopify (Razorpay/Stripe)
  checkouts; its field is hidden for Shopify-billed stores to avoid confusion.

---

## 2.1.1 — 409 Conflict connecting to the test store

**What the reviewer hit:** a 409 error connecting the app to the test store; the
"Add Store" form also showed both a success and a failure message.

**Fixed in code:**
- `createStoreForUser()` (`lib/store-registry.ts`) is now **idempotent and
  race-safe**: concurrent/duplicate requests (double-submit, OAuth callback
  racing the manual form) resolve to the **same** store instead of one
  succeeding and the other throwing.
- The API (`app/api/stores/route.ts`) returns **200** for an idempotent
  re-create, **201** for a new store, and a clean **409** only when the domain
  genuinely belongs to a different account. The UI guards against double-submit
  and shows a single message.

This removes the 409/duplicate-toast the reviewer saw.

---

## 1.1.1 — Session tokens / third-party cookies / incognito (advisory)

**This item does not apply to this app.** It targets **embedded** apps (loaded
in an iframe inside `admin.shopify.com`), whose cookies become third-party.

This app is **standalone / non-embedded**:
- `shopify.app.toml` → `embedded = false`.
- No `@shopify/app-bridge` dependency.
- It opens at `https://app.dorza.io` as a top-level site and authenticates with
  **first-party** cookies (NextAuth JWT session, `SameSite=Lax`, `Secure` in
  production). No `localStorage` is used for authentication.

First-party cookies are not subject to third-party cookie blocking, so the app
functions normally in Chrome incognito. No App Bridge / session-token change is
required.

---

## Summary for the resubmission message
- Billing: corrected Managed Pricing flow; Shopify is the source of truth; no
  false ACTIVE; reinstall re-requests charges. Discount example available on
  request (configured in Managed Pricing).
- 409: store connection is now idempotent and race-safe.
- Session tokens: app is standalone (non-embedded); uses first-party cookies;
  works in incognito.
