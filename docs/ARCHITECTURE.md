# Architecture & System Design

## High-Level Architecture
Single Next.js 16 application (App Router) — no separate Express backend. All API routes, pages, and server logic live in the same codebase.

```
Browser → Next.js App Router
           ├── Pages (app/**/page.tsx) — Server + Client components
           ├── API Routes (app/api/**/route.ts) — REST endpoints
           ├── Middleware (middleware.ts) — Auth + tenant resolution
           └── Background Jobs (jobs/) — Triggered via /api/cron/* routes
```

## Request Flow

### Client-side
```
User action → React Component → useTenant() for storeId
  → fetch('/api/...', { headers: { 'x-store-id': storeId } })
  → React Query caches response
```

### Server-side API Route
```
Request → middleware.ts (NextAuth token check)
  → API route handler
    → auth() — get session
    → getCurrentStoreId(request) — resolve tenant
    → Prisma query (filtered by storeId)
    → NextResponse.json(...)
```

## Database Layer
- **ORM:** Prisma 7.3 with `@prisma/adapter-neon` for Neon serverless PostgreSQL
- **Client:** Singleton in `lib/prisma.ts` (global in dev to avoid hot-reload leaks)
- **Schema:** `prisma/schema.prisma` — 20+ models
- **Connections:** Pooled (`DATABASE_URL`) for app, direct (`DIRECT_URL`) for migrations

### Core Data Models
```
User ──owns──> Store ──has──> StoreMember (team)
  │                │
  │                ├── Campaign ──> CampaignLog, CampaignQueueItem
  │                ├── Journey ──> JourneyEnrollment, JourneyLog
  │                ├── Segment
  │                ├── Contact ──> ContactGroup
  │                ├── Conversation ──> Message, InternalNote
  │                ├── WhatsAppConfig
  │                ├── WhatsAppFlow ──> WhatsAppFlowResponse
  │                ├── Subscription ──> Payment
  │                └── Brand
  │
  └── Invitation (pending team invites)
```

### Billing Models
```
PlanFeature (starter, pro, enterprise) — defines limits
  └── Subscription (per store) — tracks active plan
       └── Payment — individual payment records
Coupon — discount codes
UsageMetric — per-store usage tracking
```

## API Response Patterns

### Success
```json
{ "success": true, "data": {...} }
// or for lists:
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }
```

### Error
```json
{ "error": "Error message", "success": false }
```

Status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error), 503 (service unavailable)

## Background Jobs
Triggered via GET to `/api/cron/*` routes, protected by `CRON_SECRET` query param.

| Route | Worker | Purpose |
|-------|--------|---------|
| `/api/cron/campaign-runner` | `jobs/campaign.worker.ts` | Process campaign queue |
| `/api/cron/journey-runner` | `jobs/journey.worker.ts` | Execute journey steps |
| `/api/cron/shopify-token-check` | `jobs/shopify-token.worker.ts` | Validate Shopify tokens |

## State Management
- **Server state:** React Query (`@tanstack/react-query`) — caching, refetching, invalidation
- **Client state:** Zustand stores for local UI state
- **Tenant state:** React Context via `TenantProvider` in root layout
- **Forms:** React Hook Form + Zod validation

## Component Organization
```
components/
  ui/          — shadcn/ui primitives (Button, Card, Dialog, Input, etc.)
  layout/      — Sidebar, header, ConditionalLayout
  providers/   — SessionProvider, ReactQueryProvider
  billing/     — PlanCard, RazorpayCheckout, CouponInput, UsageDashboard
  chat/        — ChatWindow, MessageBubble, ConversationList
  campaigns/   — CampaignBuilder, CampaignList
  journeys/    — FlowCanvas, NodeEditor (uses @xyflow/react)
  segments/    — SegmentBuilder, ConditionEditor
  contacts/    — ContactTable, ImportModal
  flows/       — WhatsApp flow builder
  templates/   — Template editor
  dashboard/   — StatCards, Charts
  admin/       — AdminUserTable, AdminStoreList
```

## Security
- **Auth:** NextAuth v5 JWT sessions (30-day expiry)
- **Encryption:** AES-256-CBC for Shopify tokens and sensitive data (`lib/encryption.ts`)
- **Webhooks:** HMAC-SHA256 verification for Shopify, Stripe, Razorpay
- **Admin:** Separate JWT auth with `admin_session` cookie
- **RBAC:** Role-based access via `lib/permissions.ts` (SUPER_ADMIN, STORE_OWNER, MANAGER, TEAM_MEMBER, VIEWER)
- **Rate limiting:** Available via `lib/rate-limit.ts`

## Monitoring
- `ErrorLog` model — application errors
- `ActivityLog` model — user audit trail
- `SystemHealth` model — cron job health
- `/api/health` — system health check endpoint
