# WhatsApp automation

Apply the additive schema before deploying this release:

```powershell
railway run --service shopify-dashboard --environment production --no-local -- node --import tsx scripts/migrate-automation.ts
```

Deploy through the existing GitHub master integration. After checking queued campaigns and active journeys, set `INTERNAL_CRON_ENABLED=true` on the Railway service. The scheduler runs every minute and processes campaign sends, segment entry, delayed journey actions and follow-ups. The authenticated journey cron endpoint uses the same runner. Local tick overlap is prevented; persistent claims prevent duplicate enrollment and scheduled execution across processes.

The dashboard's sending-issues response includes `automation` with heartbeat, next scheduled steps, overdue status and recent enrollment outcomes. Disabled/stale scheduling is also a structured blocker. Processing steps left behind after an interruption must be reviewed against provider receipts; do not reset them to pending blindly. A network failure during a template POST has an uncertain outcome and is not automatically retried.

For checkout reminders, enable **Abandoned-checkout reminder** in journey settings, select the abandoned-cart event, add a delay and an approved WhatsApp template with a dynamic URL button. The event recovery URL must match the approved prefix. Purchase verification uses a store-specific Shopify client pinned to 2026-07. With a cart/checkout token it checks the matching order; without a token it conservatively suppresses the reminder after any order with the same checkout email since checkout creation. Missing verification data or Shopify errors stop/defer sending and appear as issues. Signed Shopify order webhooks also cancel pending reminders.

The Sahil verification journey is restricted by `testMode` and `testPhoneNumbers` to the explicitly authorized phone. Keep that restriction until customer-wide activation is requested. Old campaigns and historical checkout events are never automatically replayed. Existing document records remain readable; unscoped scheduled records fail closed rather than being assigned to a guessed store.

Verification: `npm run test:whatsapp`, `npm run test:webhooks`, `npx tsc --noEmit`, `npm run build`. Confirm acceptance and actual delivery separately using Meta receipts.
