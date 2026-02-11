# Shopify Dashboard

Single Next.js 13+ App Router application. No Express backend.

## Run

```bash
npm install
npm run dev
```

Runs at **http://localhost:3002**.

## Build & deploy

```bash
npm run build
npm start
```

## Structure

See **PROJECT_STRUCTURE.md** for the full layout. Key folders: `app/`, `lib/`, `jobs/`, `prisma/`.

## Env

Copy `.env.local.example` to `.env.local` (or create `.env.local`) and set:

- `DATABASE_URL` (Neon)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Shopify / Stripe / Google OAuth as needed
- `CRON_SECRET` for cron routes
