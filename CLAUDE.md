# Shopify Dashboard - Project Knowledge Base

## Overview
Multi-tenant SaaS dashboard for Shopify stores with WhatsApp automation, customer journeys, campaigns, live chat, segments, and billing. Single Next.js app (no separate backend).

- **Repo:** github.com/Sahil-D29/shopify-dashboard (branch: master)
- **Deploy:** Render (auto-deploys on push to master) — see `render.yaml`
- **Dev port:** 3002 (`npm run dev` uses Turbopack)

## Tech Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 16.0.10 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Database | Prisma 7.3 + Neon PostgreSQL (serverless) |
| Auth | NextAuth v5 beta (Google OAuth + Credentials, JWT sessions) |
| UI | Tailwind 4 + shadcn/ui (Radix primitives) + Lucide icons |
| Payments | Razorpay (INR, Orders API) + Stripe (USD, Checkout Sessions) |
| Integrations | Shopify REST/GraphQL API, WhatsApp/Meta Business API |
| State | React Query 5 (server) + Zustand 5 (client) |
| Charts | Recharts + Chart.js |
| Flow Builder | @xyflow/react (journey visual editor) |

## Project Structure (key dirs)
```
app/
  api/           — API routes (auth, billing, campaigns, chat, contacts, cron, flows,
                   journeys, segments, settings, shopify, teams, webhooks, whatsapp)
  billing/       — Billing page (plan selection + checkout)
  campaigns/     — Campaign builder
  chat/          — WhatsApp live chat
  contacts/      — Contact management
  dashboard/     — Main dashboard
  flows/         — WhatsApp Flows builder
  journeys/      — Journey automation builder
  segments/      — Audience segmentation
  settings/      — Store settings (Shopify, WhatsApp, team)
  admin/         — Super admin panel (users, stores, coupons)
  auth/          — Sign in/up pages

components/      — UI components by feature (billing/, chat/, campaigns/, ui/, layout/, etc.)
lib/             — Business logic, integrations, helpers (see Critical Files below)
prisma/          — Schema (20+ models) + migrations
jobs/            — Background workers (campaign, journey, shopify-token)
scripts/         — Utility scripts (seed, admin creation, secrets generation)
docs/            — Feature docs (ENV_VARIABLES.md, RENDER_DEPLOY.md, etc.)
```

## Critical Files
| File | Purpose |
|------|---------|
| `lib/auth.ts` | NextAuth config, providers, session callbacks |
| `lib/prisma.ts` | Prisma client singleton (Neon adapter) |
| `lib/tenant/tenant-context.tsx` | Client-side `useTenant()` hook — store selection |
| `lib/tenant/tenant-middleware.ts` | Server-side store resolution (cookie/header/query) |
| `lib/tenant/api-helpers.ts` | `getCurrentStoreId()` for API routes |
| `lib/user-context.ts` | `getUserContext()` — returns userId + storeId |
| `lib/razorpay.ts` | Razorpay Orders API (create order, verify signature) |
| `lib/stripe.ts` | Stripe Checkout Sessions (subscriptions) |
| `lib/shopify.ts` | Shopify OAuth flow + webhook verification |
| `lib/shopify-api.ts` | Shopify API client wrapper |
| `lib/whatsapp/send-message.ts` | WhatsApp message sender (Meta Graph API) |
| `lib/encryption.ts` | AES-256-CBC encrypt/decrypt for tokens |
| `lib/permissions.ts` | Role-based access control |
| `lib/store-registry.ts` | Multi-store CRUD + access control |
| `middleware.ts` | NextAuth route protection |
| `prisma/schema.prisma` | DB schema — User, Store, StoreMember, Campaign, Journey, Segment, Subscription, Payment, Contact, Conversation, Message, WhatsAppConfig, etc. |

## Key Patterns

### API Route Pattern
```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const storeId = await getCurrentStoreId(request); // or getUserContext(request)
  const data = await prisma.model.findMany({ where: { storeId } });
  return NextResponse.json({ success: true, data });
}
```

### Multi-Tenancy — Store ID Resolution
- **Client:** `const { currentStore } = useTenant()` from `lib/tenant/tenant-context.tsx`
- **Server:** `getCurrentStoreId(request)` checks: `x-store-id` header > `current_store_id` cookie > `storeId` query param
- **Always** pass `x-store-id` header from client fetch calls for reliability

### Auth
- `auth()` from `lib/auth.ts` for session check in API routes
- Admin panel uses separate auth: `requireAdmin()` with `admin_session` cookie + jose JWT
- Session has: `user.id`, `user.email`, `user.name`, `user.role` — does NOT have `user.storeId`

### Encryption
```typescript
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
// ENCRYPTION_KEY must be 64 hex chars (32 bytes)
```

## Commands
```bash
npm run dev          # Dev server on port 3002 (Turbopack)
npm run build        # prisma generate + next build
npm start            # Production (PORT env or 3000)

npx prisma migrate dev        # Create + run migration
npx prisma db push            # Push schema without migration
npx prisma studio             # DB web UI

node scripts/generate-secrets.js      # Generate ENCRYPTION_KEY + NEXTAUTH_SECRET
node scripts/create-admin.js          # Create admin user for /admin panel
npx tsx scripts/seed-plans.ts         # Seed billing plans
```

## Environment Variables (required)
```
DATABASE_URL=          # Neon pooled connection string
NEXTAUTH_SECRET=       # Auth session secret
ENCRYPTION_KEY=        # 64 hex chars for AES encryption
NEXTAUTH_URL=          # App URL (http://localhost:3002 locally)
```
See `docs/ENV_VARIABLES.md` for full reference (Shopify, WhatsApp, Razorpay, Stripe, SMTP, etc.)

## Deploy
- Push to master → Render auto-deploys
- Build: `npm install && npx prisma generate && npm run build`
- See `docs/RENDER_DEPLOY.md` for full guide

## Known Issues & TODOs
- Campaign worker (`jobs/campaign.worker.ts`) only marks complete — no actual send logic yet
- `/api/shopify/discount-codes` returns mock data
- Debug `console.log` statements in `app/settings/page.tsx`
- `/api/subscriptions/usage` endpoint not implemented
- `session.user.storeId` does NOT exist — always use `useTenant()` or `getCurrentStoreId()`

## Common Pitfalls
1. **storeId:** Never read from `session.user.storeId` (doesn't exist). Use `useTenant()` client-side, `getCurrentStoreId()` server-side
2. **request.json():** Can only be called once per request in Next.js API routes
3. **Razorpay:** Uses Orders API (not Subscriptions API) — see `lib/razorpay.ts`
4. **Admin auth:** Separate from NextAuth — uses `admin_session` cookie with jose JWT
5. **ENCRYPTION_KEY:** Must be exactly 64 hex characters (32 bytes)
6. **Prisma:** Uses Neon adapter — `DATABASE_URL` must be pooled connection string

## Per-Feature Docs
- `docs/ARCHITECTURE.md` — System design, data flow, patterns
- `docs/AUTH.md` — Authentication & authorization
- `docs/BILLING.md` — Payment flow (Razorpay + Stripe)
- `docs/WHATSAPP.md` — WhatsApp/Meta integration
- `docs/SHOPIFY.md` — Shopify API integration
- `docs/MULTI_TENANCY.md` — Store/tenant system
- `docs/TROUBLESHOOTING.md` — Common issues & fixes
- `docs/ENV_VARIABLES.md` — Full env var reference (existing)
- `docs/RENDER_DEPLOY.md` — Render deployment guide (existing)

## Recent Commit History
```
00b2783 Fix billing checkout button not working after plan selection
f21b0c0 Switch Razorpay from Subscriptions to Orders API for checkout
3d8dda7 Fix billing loading + add Facebook Embedded Signup to settings
a8449e8 Fix auth crash on Render: resilient getBaseUrl + health check
019cbfc Add WhatsApp Flows feature (Phase 4)
07d0ab5 Fix password reset flow: add missing API routes and schema fields
76d91ec Add Billing, Embedded Signup & Admin Coupons (Phase 3)
b88fcde Add Live Chat module (Phase 2)
0c88052 Add Contacts Management module (Phase 1)
```
