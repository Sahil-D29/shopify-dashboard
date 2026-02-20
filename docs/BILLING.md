# Billing & Payment System

## Overview
Dual payment gateway: **Razorpay** (INR) and **Stripe** (USD). Users select currency on the billing page, which determines the gateway.

## Architecture
```
Billing Page (app/billing/page.tsx)
  → Select plan (PlanCard component)
  → Apply coupon (CouponInput component)
  → Proceed to Checkout
      ├── INR → Razorpay Orders API → inline checkout modal
      └── USD → Stripe Checkout → redirect to Stripe hosted page
  → Payment verification
  → Subscription activated
```

## Key Files
| File | Purpose |
|------|---------|
| `app/billing/page.tsx` | Billing page with plan selection, coupon, checkout |
| `app/api/billing/checkout/route.ts` | Creates checkout session (Razorpay order or Stripe session) |
| `app/api/billing/plans/route.ts` | Returns available plans from PlanFeature table |
| `app/api/billing/subscription/route.ts` | Get/update store subscription |
| `app/api/billing/verify-payment/route.ts` | Verify Razorpay payment signature |
| `app/api/billing/coupons/validate/route.ts` | Validate coupon codes |
| `app/api/billing/invoices/route.ts` | Payment/invoice history |
| `app/api/billing/usage/route.ts` | Usage metrics |
| `lib/razorpay.ts` | Razorpay client, order creation, signature verification |
| `lib/stripe.ts` | Stripe client, checkout sessions, webhook handling |
| `lib/billing/message-cost.ts` | Message cost calculation |
| `components/billing/PlanCard.tsx` | Plan display card |
| `components/billing/RazorpayCheckout.tsx` | Razorpay inline checkout component |
| `components/billing/CouponInput.tsx` | Coupon code input |
| `components/billing/UsageDashboard.tsx` | Usage analytics |
| `components/billing/PaymentHistory.tsx` | Payment records |

## Razorpay Flow (INR)
1. Client selects plan → clicks "Proceed to Checkout"
2. Client sends POST to `/api/billing/checkout` with `currency: 'INR'`
3. Server creates Razorpay order via `createRazorpayOrder()` (Orders API, not Subscriptions)
4. Server returns `{ gateway: 'razorpay', razorpayOrderId, razorpayKeyId, amount }`
5. Client renders `RazorpayCheckout` component → loads Razorpay script → opens checkout modal
6. On payment success, client sends signature to `/api/billing/verify-payment`
7. Server verifies HMAC-SHA256 signature via `verifyRazorpayPaymentSignature()`
8. Server creates/updates Subscription + Payment records

**Important:** Razorpay uses **Orders API** (one-time payments), NOT Subscriptions API.

## Stripe Flow (USD)
1. Client selects plan → clicks "Proceed to Checkout"
2. Client sends POST to `/api/billing/checkout` with `currency: 'USD'`
3. Server creates Stripe Checkout Session via `createCheckoutSession()`
4. Server returns `{ gateway: 'stripe', sessionUrl }`
5. Client redirects to Stripe hosted checkout page
6. Stripe sends webhook to `/api/webhooks/stripe` on payment events
7. Webhook handler creates/updates Subscription + Payment records

## Free Plan
If selected plan price is 0, checkout API immediately creates subscription with status ACTIVE (no payment gateway involved).

## Database Models
- **PlanFeature** — plan definitions (planId, name, price, priceINR, messagesPerMonth, etc.)
- **Subscription** — one per store (storeId unique), tracks planId, status, period dates
- **Payment** — individual payment records linked to subscription
- **Coupon** — discount codes with type (PERCENTAGE/FIXED), value, expiry
- **UsageMetric** — per-store usage tracking by period

## Webhook Handlers
- **Razorpay:** `/api/webhooks/razorpay` — handles payment.captured, subscription events
- **Stripe:** `/api/webhooks/stripe` — handles checkout.session.completed, subscription.updated/deleted, invoice events

## Environment Variables
```
RAZORPAY_KEY_ID=          # Razorpay merchant key ID
RAZORPAY_KEY_SECRET=      # Razorpay merchant secret
RAZORPAY_WEBHOOK_SECRET=  # Razorpay webhook signature secret
STRIPE_SECRET_KEY=        # Stripe secret key (optional if INR-only)
STRIPE_WEBHOOK_SECRET=    # Stripe webhook signing secret
```

## Seeding Plans
```bash
npx tsx scripts/seed-plans.ts
```
Creates PlanFeature records (free, starter, pro, enterprise) with pricing and feature limits.

## Common Gotchas
- Billing page uses `useTenant()` to get storeId — not from session
- Checkout API resolves storeId from `x-store-id` header, `current_store_id` cookie, query param, OR request body (fallback)
- Razorpay amounts are in **paise** (multiply by 100)
- Stripe amounts are in **cents** (multiply by 100)
