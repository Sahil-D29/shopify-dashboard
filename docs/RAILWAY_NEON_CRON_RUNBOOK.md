# Railway, Neon, and External Cron Runbook

Last updated: 2026-08-19

## Production Context

- App domain: `https://app.dorza.io`
- GitHub repo: `Sahil-D29/shopify-dashboard`
- Railway project: `app.dorza.io`
- Railway project ID: `87211ce5-105a-415b-b789-daabff0ad00d`
- Railway service: `shopify-dashboard`
- Railway service ID: `a95da684-7542-4a80-a86b-1957f12b5213`
- Railway environment: `production`
- Neon org ID: `org-calm-rice-74053966`
- Neon project: `shopify-dashboard`
- Neon project ID: `summer-cell-13779045`
- Neon branch: `production`
- Neon branch ID: `br-sweet-tree-afc1vzhg`
- Production Neon endpoint: `ep-snowy-butterfly-afdn0irh`

## What Happened

Railway redeploys started failing after a config change because the production build ran:

```bash
npx prisma generate && npx prisma db push && next build
```

The failure happened at `npx prisma db push` because Neon could not be reached while the Neon free quota was exhausted:

```text
Prisma P1001: Can't reach database server
```

The app was still online because the previous Railway deployment was healthy, but new deployments could not complete.

## Fixes Applied

### Railway build no longer pushes schema

`package.json` now uses:

```json
"build": "npx prisma generate && next build",
"db:push": "npx prisma db push"
```

This keeps Prisma Client generation in the build, but schema pushes are now manual and intentional.

### Internal app cron disabled on Railway

Railway production has:

```text
INTERNAL_CRON_ENABLED=false
```

`instrumentation.ts` now exits unless:

```text
INTERNAL_CRON_ENABLED=true
```

Healthy Railway log:

```text
[campaign-cron] internal scheduler disabled
```

There should not be repeated:

```text
[campaign-cron] scheduler started
```

### External cron moved to GitHub Actions

Workflow file:

```text
.github/workflows/cron.yml
```

Schedules:

- Every 5 minutes: `campaign-runner`, `journey-runner`, `email-campaign-runner`
- Every 10 minutes: `campaign-followups`
- Every 15 minutes: `email-cross-sell-runner`
- Every 6 hours: `shopify-token-check`
- Daily: `payment-reminders`

GitHub Actions secrets required:

```text
APP_BASE_URL=https://app.dorza.io
CRON_SECRET=<same value as Railway CRON_SECRET>
```

Railway production also requires:

```text
CRON_SECRET=<same value as GitHub Actions CRON_SECRET>
```

Do not commit or paste the actual secret into docs.

### Cron endpoints hardened

Shared helper:

```text
lib/cron-auth.ts
```

All `/api/cron/*` endpoints require `CRON_SECRET`.

Expected behavior:

- Missing secret: `401` when `CRON_SECRET` is configured
- Wrong secret: `401`
- Missing `CRON_SECRET` in production: `500`
- Correct secret: endpoint executes the job

## Neon Changes

Neon org was upgraded from Free to Launch.

Current guardrails:

- Plan: `launch`
- Spending limit: `$10/month`
- Existing endpoints autosuspend after 5 minutes: `suspend_timeout_seconds=300`
- Future default endpoint autosuspend: `suspend_timeout_seconds=300`
- Compute autoscaling capped at `0.25-2 CU`

The main reason quota burned quickly was that Neon endpoint autosuspend was set to:

```text
suspend_timeout_seconds=0
```

That setting can keep compute from suspending and burn quota/cost even with low user activity.

## Useful Commands

### Check Railway variables safely

Do not print raw secrets.

```powershell
$vars = railway variable list --json --project 87211ce5-105a-415b-b789-daabff0ad00d --environment production --service a95da684-7542-4a80-a86b-1957f12b5213 | ConvertFrom-Json
"INTERNAL_CRON_ENABLED=$($vars.INTERNAL_CRON_ENABLED)"
"CRON_SECRET_PRESENT=$([bool]$vars.CRON_SECRET)"
```

Expected:

```text
INTERNAL_CRON_ENABLED=false
CRON_SECRET_PRESENT=True
```

### Check Railway deployment status

```powershell
railway deployment list --json --limit 3 --project 87211ce5-105a-415b-b789-daabff0ad00d --environment production --service a95da684-7542-4a80-a86b-1957f12b5213
```

### Check app health

```powershell
curl.exe --silent --location --output NUL --write-out "%{http_code}" --max-time 30 https://app.dorza.io
```

Expected:

```text
200
```

### Check cron auth

```powershell
curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 30 https://app.dorza.io/api/cron/campaign-runner
curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 30 "https://app.dorza.io/api/cron/campaign-runner?secret=wrong-secret"
```

Expected:

```text
401
401
```

### Check all cron endpoints with real secret

```powershell
$base = 'https://app.dorza.io'
$vars = railway variable list --json --project 87211ce5-105a-415b-b789-daabff0ad00d --environment production --service a95da684-7542-4a80-a86b-1957f12b5213 | ConvertFrom-Json
$secret = $vars.CRON_SECRET
$routes = @(
  '/api/cron/campaign-runner',
  '/api/cron/journey-runner',
  '/api/cron/email-campaign-runner',
  '/api/cron/campaign-followups',
  '/api/cron/email-cross-sell-runner',
  '/api/cron/shopify-token-check',
  '/api/cron/payment-reminders'
)
foreach ($route in $routes) {
  $code = curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 90 --header "Authorization: Bearer $secret" "$base$route"
  "$route $code"
}
```

Expected:

```text
/api/cron/campaign-runner 200
/api/cron/journey-runner 200
/api/cron/email-campaign-runner 200
/api/cron/campaign-followups 200
/api/cron/email-cross-sell-runner 200
/api/cron/shopify-token-check 200
/api/cron/payment-reminders 200
```

### Run GitHub cron workflow manually

```powershell
gh workflow run "Production Cron" --repo Sahil-D29/shopify-dashboard
gh run list --repo Sahil-D29/shopify-dashboard --workflow "Production Cron" --limit 1
```

Expected conclusion:

```text
success
```

### Check Neon org and project

```powershell
npx neonctl@3.6.0 api /organizations/org-calm-rice-74053966 -o json
npx neonctl@3.6.0 api /projects/summer-cell-13779045 -o json
npx neonctl@3.6.0 api /projects/summer-cell-13779045/endpoints -o json
```

Expected:

- Org plan: `launch`
- Spending limit: `1000` cents
- Endpoint suspend timeout: `300`
- Endpoint min CU: `0.25`
- Endpoint max CU: `2`

### Check Neon spending limit

```powershell
npx neonctl@3.6.0 api /organizations/org-calm-rice-74053966/billing/spending_limit -o json
```

Expected:

```json
{
  "spending_limit_cents": 1000
}
```

### Update Neon spending limit

Example for `$10/month`:

```powershell
npx neonctl@3.6.0 api /organizations/org-calm-rice-74053966/billing/spending_limit -X PUT -F spending_limit_cents=1000 -o json
```

Example for `$20/month`:

```powershell
npx neonctl@3.6.0 api /organizations/org-calm-rice-74053966/billing/spending_limit -X PUT -F spending_limit_cents=2000 -o json
```

### Set Neon autosuspend and compute caps

```powershell
$project = 'summer-cell-13779045'
$endpointIds = @('ep-snowy-butterfly-afdn0irh','ep-falling-voice-af5zqotz')
foreach ($endpoint in $endpointIds) {
  npx neonctl@3.6.0 api "/projects/$project/endpoints/$endpoint" -X PATCH -F endpoint.autoscaling_limit_min_cu=0.25 -F endpoint.autoscaling_limit_max_cu=2 -F endpoint.suspend_timeout_seconds=300 -o json
}
```

Set future endpoint defaults:

```powershell
npx neonctl@3.6.0 api /projects/summer-cell-13779045 -X PATCH -F project.default_endpoint_settings.suspend_timeout_seconds=300 -F project.default_endpoint_settings.autoscaling_limit_min_cu=0.25 -F project.default_endpoint_settings.autoscaling_limit_max_cu=2 -o json
```

### Test DB through Prisma adapter

```powershell
$vars = railway variable list --json --project 87211ce5-105a-415b-b789-daabff0ad00d --environment production --service a95da684-7542-4a80-a86b-1957f12b5213 | ConvertFrom-Json
$env:DATABASE_URL = $vars.DATABASE_URL
@'
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
prisma.$queryRawUnsafe('SELECT 1 AS ok')
  .then((result) => console.log(`PRISMA_DB_OK=${result[0].ok}`))
  .catch((error) => {
    console.error(`PRISMA_DB_ERROR=${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
'@ | node -
```

Expected:

```text
PRISMA_DB_OK=1
```

## Deployment Commits

- `e145286` - `Fix Railway build and gate internal cron`
- `024345b` - `Add external cron workflow`

## Important Rules

- Do not add `prisma db push` back into `npm run build`.
- Run schema pushes or migrations only when intentionally needed.
- Keep `INTERNAL_CRON_ENABLED=false` on Railway while GitHub Actions cron is active.
- Keep `CRON_SECRET` set in both Railway and GitHub Actions.
- Keep Neon autosuspend enabled unless there is a deliberate reason to disable it.
- Do not paste actual secrets into commits, docs, logs, or chat.
