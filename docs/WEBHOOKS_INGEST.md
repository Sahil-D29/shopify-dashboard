# Inbound Webhook Ingestion

Lets third-party systems push **contacts** and **events** into Dorza. Ingested
data flows across the app: Contacts, Segments (re-evaluation), Journeys
(triggers), and Analytics (custom events).

Managed in the app at **Settings → Webhooks**. Each integration has:
- a unique **ingest URL** — `https://app.dorza.io/api/webhooks/ingest/<publicId>`
- a **secret token** (shown once on create/regenerate)
- accepted **data types** (Contacts / Events / Facebook FBP)
- optional **events** allow-list (empty = accept any event name)

## Authentication
Send the secret in whichever form your platform supports — all of these work:
```
Authorization: <secret>            # raw value (e.g. NitroCommerce "Authorization Token")
Authorization: Bearer <secret>     # or "Token <secret>"
X-Authorization / X-Webhook-Token / X-Api-Key / X-Auth-Token: <secret>
?token=<secret>                     # query param
```
Knowing the URL is not enough — the secret is required and compared timing-safe.
Inactive integrations return 403; a bad/missing token returns 401.

## Accepted payload shapes
The processor is lenient about field names so most platforms work without mapping:
- **Event name** is read from any of `event`, `eventType`, `event_name`, `topic`, `name`, or `type`.
- **Contact** is read from `contact`, `customer`, `visitor`, `user`, `profile`, or top-level — using `phone`/`phoneNumber`/`mobile`/`whatsapp` and `email`/`emailAddress`.
- Events not in the integration's selected list are still **recorded** (the selected list is used for journey filtering, not as an ingress gate), so no data is silently dropped. Every delivery appears under Settings → Webhooks → Recent deliveries.

## Payload contract
`POST <ingest URL>` with `Content-Type: application/json`:
```json
{
  "type": "contact" | "event",
  "event": "product_view",
  "contact": {
    "phone": "+15551234567",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "firstName": "Jane",
    "lastName": "Doe",
    "tags": ["vip"],
    "customFields": { "ltv": 5000 }
  },
  "properties": { "productId": "123", "resourceTitle": "Blue Shirt" },
  "occurredAt": "2026-06-15T10:00:00Z",
  "fbp": "fb.1.....",
  "fbc": "fb.1....."
}
```
Rules:
- `type: "contact"` → upserts a Contact (keyed on store + phone; email-only contacts use an `email:<addr>` alias key). Source is recorded as `WEBHOOK`.
- `type: "event"` (or any `event` with `type` != `contact`) → records the event, increments the custom-event analytics counter, fires matching **journeys** (`custom:<event>`), and flags **segments** for re-evaluation. If a `contact` object is included it is upserted first and linked.
- `facebook_fbp` data (`fbp`/`fbc`) is stored on the contact's `customFields`.
- Body cap ~1MB.

## Examples
Contact:
```bash
curl -X POST "https://app.dorza.io/api/webhooks/ingest/<publicId>" \
  -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" \
  -d '{"type":"contact","contact":{"phone":"+15551234567","email":"jane@example.com","tags":["vip"]}}'
```
Event:
```bash
curl -X POST "https://app.dorza.io/api/webhooks/ingest/<publicId>" \
  -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" \
  -d '{"type":"event","event":"product_view","contact":{"phone":"+15551234567"},"properties":{"productId":"123"}}'
```

## Verification challenge
`GET <ingest URL>?challenge=abc` echoes `abc` (for setup checks).

## Responses
- `200 { ok: true, eventType, contactId? }` — accepted & processed
- `401 / 403 / 404` — auth / disabled / unknown webhook
- `413` — payload too large
- `422 { ok:false, error }` — accepted but processing failed (see Settings → Webhooks → deliveries)
