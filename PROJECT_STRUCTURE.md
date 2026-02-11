# Shopify Dashboard — Project Structure

Single Next.js 13+ App Router application. No Express backend.

```
shopify-dashboard/
│
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts
│   │   ├── teams/                    # teams/[storeId]/..., teams/invitations/...
│   │   ├── shopify/                  # shopify/orders, shopify/customers, ...
│   │   ├── segments/
│   │   ├── campaigns/
│   │   ├── journeys/
│   │   ├── brands/
│   │   ├── coupons/
│   │   ├── subscriptions/
│   │   ├── stripe/                   # (webhook in webhooks/stripe)
│   │   └── webhooks/
│   │       ├── shopify/route.ts
│   │       └── stripe/route.ts
│   │
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── components/
│   │
│   ├── auth/
│   │   └── signin/page.tsx
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── shopify.ts
│   ├── stripe.ts
│   ├── webhook.ts
│   └── logger.ts
│
├── jobs/
│   ├── campaign.worker.ts
│   ├── journey.worker.ts
│   └── shopify-token.worker.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── middleware.ts
├── next.config.ts    # or next.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.local
├── .gitignore
└── README.md
```

## Notes

- **API routes** live under `app/api/`; teams, shopify, segments, campaigns, journeys, brands, coupons, subscriptions use nested routes (e.g. `teams/[storeId]/route.ts`, `shopify/orders/route.ts`) for full functionality.
- **Cron** routes: `app/api/cron/campaign-runner/`, `journey-runner/`, `shopify-token-check/` call the modules in `jobs/` directly.
- **Auth**: NextAuth in `lib/auth.ts`; session used across protected APIs.
- **DB**: Single Prisma schema + Neon in `lib/prisma.ts`.

## Run

- **Dev:** `npm run dev` (port 3002)
- **Build:** `npm run build`
- **Start:** `npm start`
