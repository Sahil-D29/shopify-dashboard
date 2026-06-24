# Customer Segments — Architecture & Gotchas

> Living doc for the segment builder + evaluation engine. Read this before touching
> anything under `app/segments`, `app/api/segments`, `lib/segments`, or
> `lib/utils/segment-stats.ts`. Last major rework: unified builder + Contact-centric
> resolution (see "History" at the bottom).

## TL;DR mental model

- A **Segment** = a name + `filters` JSON on the `Segment` Prisma row. `filters.conditionGroups`
  is the real definition: `[{ id, groupOperator: 'AND'|'OR', conditions: [...] }]`.
- A **condition** = `{ field, operator, value, subFilters?, subFilterOperator?, timeWindow?, frequency? }`.
- The **audience** a segment resolves over is **Contacts ⋃ Shopify customers, deduplicated** —
  NOT just the Shopify customer list. This is the most important thing to understand (see below).
- One engine — `calculateSegmentStats()` in `lib/utils/segment-stats.ts` — resolves a segment to
  its matching people. The list, detail, analytics, customers tab, campaign send/reach, and
  journey entry **all** go through it (directly or via `lib/segments/resolve-customers.ts`).

## Audience model (READ THIS)

The store's messageable audience is **Contacts** (`prisma.contact`), which include people from
webhooks / other sources that are **not** Shopify customers (`shopifyCustomerId: null`).
Custom/storefront events are keyed to `Contact.id` for those people.

`buildAudience(storeId, client, { needShopify })` in `segment-stats.ts`:
1. Optionally fetches Shopify customers (only when `needShopify`).
2. Loads all Contacts.
3. **Merges/dedupes** into one person list, identity priority: `shopifyCustomerId` → `email` → `phone`.
   - Each person is `ShopifyCustomer`-shaped (so the evaluator is unchanged) with
     `id = shopifyCustomerId || contactId` and an internal `__eventKeys = [shopifyId, contactId]`.
   - Order fields come from the Shopify side; name/phone/tags fall back to the Contact side.
4. Enrichment maps (custom events, storefront, campaign logs, journeys, flows, conversations)
   are looked up by **all** `__eventKeys`, so events keyed by either id attach to the merged person.

`needsShopifyCustomers(conditionGroups)`: if **every** condition field is contact/custom-event/
engagement based (`custom_event:*`, `contact_*`, `wa_*`, `chat_*`, `campaign_*`, `journey_*`,
`flow_*`, storefront events), the Shopify fetch is **skipped entirely** → instant, no rate-limit.
Mixed/order/attribute segments fetch Shopify gracefully.

## Custom events (webhook / external data) — how they resolve

- Custom event DATA lives in the `storefront_events` table, `eventType` = the **raw** event name
  (e.g. `hiu_tagged`, `product_view`, `addtocart`), `customerId` = `Contact.id` (or Shopify id),
  `metadata` = JSON props (e.g. `cart_value`, `product_categories`, `location`). NOTE: the in-app
  events API (`processCustomEvent`) writes `custom:<name>`; the webhook/external path writes the
  raw name. **Match both.**
- Custom event DEFINITIONS live in `CustomEventDefinition` (per store), surfaced in the field
  picker via `getCustomEventSegmentFields()` → fields with value `custom_event:<name>`.
- `SegmentFieldsProvider` (`components/segments/segment-fields-context.tsx`) fetches
  `/api/settings/custom-events` and merges them into the picker so the **Custom Events tab** shows
  (only when the store has definitions). Their properties become sub-filters.
- `fetchCustomEventEnrichment(storeId, eventNames)` queries
  `storefront_events WHERE eventType IN (<name>, custom:<name>)`, keyed by `customerId`, indexed by
  the bare name. The evaluator handles `custom_event:<name>` (triggered? + property sub-filters +
  time window + frequency).

## Key files

| File | Role |
|------|------|
| `lib/utils/segment-stats.ts` | THE engine: `calculateSegmentStats`, `buildAudience`, all `fetch*Enrichment`, `needs*` gates |
| `lib/segments/evaluator.ts` | `matchesGroups` / `getFieldValue` / `getFieldCollection`; per-field logic + enrichment types |
| `lib/segments/resolve-customers.ts` | `resolveSegmentCustomers` (campaigns) + `customerInSegment` (journeys) — wrap the engine |
| `lib/constants/segment-fields.ts` | All `SEGMENT_FIELD_OPTIONS` (incl. the full Shopify Events list), operators, custom-event field gen |
| `lib/constants/sub-filter-properties.ts` | Sub-filter categories + `FIELD_TO_SUBFILTER_CATEGORY` mapping |
| `components/segments/SegmentBuilder.tsx` | The builder UI (unified "Add Condition", live preview, save) |
| `components/segments/ConditionRow.tsx` / `FieldSelect.tsx` / `SubFilterRow.tsx` | Condition row + field picker + property filters |
| `components/segments/segment-fields-context.tsx` | Provider that injects custom-event fields into the picker |
| `app/api/segments/route.ts` | List (GET, fast/stored by default) + create (POST) |
| `app/api/segments/[id]/route.ts` | Detail GET (fast/stored unless `?refresh=true`) + PUT |
| `app/api/segments/[id]/analytics/route.ts` / `customers/route.ts` | Read audience from the engine; persist count |
| `lib/shopify/client.ts` | Shopify REST client — has the 15s timeout + 429 retry + `fetchAll` cap |

## Critical gotchas (don't regress these)

1. **Never fetch the Shopify customer list synchronously on a page load.** It's slow and
   rate-limited (429). The list + detail GET return **stored** stats by default; fresh stats are
   computed only on `?refresh=true` / Force Sync / preview.
2. **Shopify client has a hard 15s timeout + 429 retry/backoff (3×) + `fetchAll` cap (100 pages /
   60s).** Without these, a stalled/rate-limited shop hangs the request forever (this caused the
   "edit page stuck on Loading" bug).
3. **`calculateSegmentStats` never throws on Shopify failure** — it degrades to Contacts-only and
   sets `stats.error` only when an order/RFM field is actually used.
4. **Save (`POST /api/segments`) computes stats fire-and-forget** — it returns 201 immediately so
   saving never blocks on Shopify.
5. **Event-rule path was removed.** Segments are conditions only. Old `eventRules` in `filters`
   are ignored. Don't reintroduce a parallel input.
6. **Sub-filters render off `FIELD_TO_SUBFILTER_CATEGORY`.** A field only shows the "filters" badge
   + a relevant property panel if it has `supportsSubFilters: true` AND a category mapping.

## Downstream consumers

- **Campaigns:** `resolveSegmentCustomers({ client, storeId, segmentIds })` (intersection of
  segments) → recipients. Reach estimate uses the same, so estimate == preview == actual send.
- **Journeys:** "customer in segment X" entry is gated by `customerInSegment(customer, segmentId)`
  in `lib/journey-engine/trigger-matcher.ts` (single-customer check through the engine).

## Adding a new field / event

1. Add to `SEGMENT_FIELD_OPTIONS` in `segment-fields.ts` (right `group`, `type`, status flags,
   `supportsSubFilters/TimeWindow/Frequency`).
2. Add a `getFieldValue` case in `evaluator.ts` (derive from enrichment; return `false` for
   not-yet-available, never `undefined` silent-mismatch).
3. If it needs data, add/extend a `fetch*Enrichment` + the matching `needs*` gate in
   `segment-stats.ts`, and assemble it in the per-person enrichment block (use `__eventKeys`).
4. For sub-filters, map it in `FIELD_TO_SUBFILTER_CATEGORY` and add properties if a new category.

## Data / environment notes

- Deploy: push `master` → **Railway** auto-deploys (~5–8 min). (CLAUDE.md still says Render — stale.)
- Verify on `app.dorza.io` in the user's browser; pages are auth-gated (can't curl without cookie).
- Webhook-only contacts have **no Shopify orders**, so Total Value / order-based fields are ₹0 for
  them — correct, not a bug. Some contacts have odd stored phones (e.g. `nitro:<uuid>`) from the
  source tool.
- The mymaatram store's Shopify customer fetch is rate-limited (429); the timeout/retry handles it,
  but order-based segments depend on Shopify being reachable.

## History (what changed and why)

- **Part 1 — Unified builder:** removed the dead "Add Event Rule" path (it matched all customers
  because `matchesGroups` ignored `eventRules`); one "Add Condition" flow; fixed preview stat key;
  responsive layout; per-event sub-filters (product tags/type/vendor/collection) with storefront
  capture+enrich.
- **Part 2 — Full Shopify Events tab:** expanded to ~34 events (Browse → Cart → Order →
  Fulfillment → Customer), derived from Admin-API enrichment; sub-filters/badges on all
  order/cart/fulfillment events; added storefront events (active/search/removed) + journey webhook
  topics.
- **Part 3 — Stop hanging:** fast-by-default list + detail GET; Shopify client 15s timeout +
  `fetchAll` cap; graceful stats; non-blocking save; self-heal stuck "Syncing".
- **Part 4 — Contact-centric resolution (the big one):** audience = merged Contacts ⋃ Shopify
  (deduped); custom-event enrichment matches raw names; analytics/customers routes read from the
  engine; skip Shopify for contact/custom-event segments; 429 retry/backoff. This is what made the
  `hiu` (custom event) segment finally show its 69 contacts instead of 0.
