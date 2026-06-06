# WhatsApp / Meta Integration

## Overview
Integration with Meta WhatsApp Business API for sending/receiving messages, managing templates, live chat, flows, and embedded signup.

## Key Files
| File | Purpose |
|------|---------|
| `lib/whatsapp/send-message.ts` | Centralized message sender (text, template, media) |
| `lib/whatsapp-config.ts` | Client-side WhatsApp config manager (window storage) |
| `lib/config/whatsapp-env.ts` | Server-side env validation for WhatsApp config |
| `lib/whatsapp/templates-store.ts` | Template storage and management |
| `lib/whatsapp/template-utils.ts` | Template parsing utilities |
| `lib/whatsapp/embedded-signup.ts` | Server: code→token exchange + save WhatsAppConfig |
| `lib/whatsapp/embedded-signup-client.ts` | Browser: FB JS SDK loader + `FB.login(config_id)` popup |
| `lib/whatsapp/flow-handler.ts` | WhatsApp Flows data processing |
| `lib/whatsapp/validate-config.ts` | Config validation |
| `lib/whatsapp/normalize-phone.ts` | Phone number normalization |
| `app/api/whatsapp/**` | WhatsApp API routes |
| `app/api/chat/**` | Live chat API routes |
| `app/api/flows/**` | WhatsApp Flows API routes |
| `app/api/webhooks/whatsapp/route.ts` | Inbound message webhook |

## Embedded Signup (let any brand connect their own WhatsApp)

Customers click **Connect with Facebook** in Settings → WhatsApp. A Facebook
popup (Facebook JS SDK `FB.login` with a `config_id`) walks them through
selecting their Business, WhatsApp Business Account, and phone number. The popup
returns an auth `code` plus the `waba_id` + `phone_number_id`; the backend
exchanges the code for a token and saves it (encrypted) to `WhatsAppConfig`.

**Flow:** `app/settings/page.tsx` (WA tab) → `lib/whatsapp/embedded-signup-client.ts`
`launchWhatsAppEmbeddedSignup()` → `POST /api/whatsapp/embedded-signup`
→ `exchangeCodeForToken()` + `saveWhatsAppConfig()`.

### Required env vars
- `NEXT_PUBLIC_META_APP_ID` — Meta App ID (browser, for `FB.init`)
- `NEXT_PUBLIC_META_CONFIG_ID` — Embedded Signup Configuration ID
- `META_APP_ID`, `META_APP_SECRET` — server, for the code→token exchange

### One-time Meta Developer Dashboard setup
1. **Facebook Login for Business → Configurations**: create from the
   "WhatsApp Embedded Signup" template. Permissions:
   `whatsapp_business_management`, `whatsapp_business_messaging`. Copy the
   **Configuration ID** → `NEXT_PUBLIC_META_CONFIG_ID`.
2. **Facebook Login for Business → Settings**: enable Client OAuth Login, Web
   OAuth Login, Enforce HTTPS, Embedded Browser OAuth Login, Use Strict Mode,
   and **Login with the JavaScript SDK**.
3. **Allowed Domains for the JS SDK**: `https://app.dorza.io`.
4. **Valid OAuth Redirect URIs**: `https://app.dorza.io/`.
5. **App Review → Permissions and Features**: request **Advanced Access** for
   `whatsapp_business_management`, `whatsapp_business_messaging`,
   `business_management`, `public_profile` (needed so external brands — not just
   users with an app role — can connect).
6. **Business Verification** (Meta Business Settings → Security Center) — required
   before Advanced Access is granted.

> "Feature unavailable — Facebook Login is currently unavailable for this app"
> means one of steps 2–6 is incomplete (most often the JS-SDK OAuth switches,
> Allowed Domains, or Advanced Access). Before approval, testing works for users
> added under **App Roles → Roles / Test Users**.

## Message Sending
```
POST /api/whatsapp/send-text     — Send text message
POST /api/whatsapp/send-template — Send template message
POST /api/chat/send-media        — Send media (image, video, document, audio)
```

Uses Meta Graph API: `https://graph.facebook.com/v18.0/{phoneNumberId}/messages`

### Supported Message Types
- Text messages
- Template messages (with variable substitution)
- Media messages (image, video, document, audio)

## WhatsApp Config Storage
- **Database:** `WhatsAppConfig` model per store
- **Client cache:** Window storage via `lib/whatsapp-config.ts`
- Config includes: phoneNumberId, businessAccountId, accessToken, appId

## Templates
- Synced from Meta via `/api/whatsapp/templates/sync`
- Stored locally for quick access
- Preview rendering: `/api/whatsapp/preview-render`
- Template parser: `lib/whatsapp/templateParser.ts`

## Live Chat (app/chat/)
- Real-time messaging via SSE (`/api/chat/sse`)
- Conversation management (assign, resolve)
- Internal notes on conversations
- Quick replies and auto-reply rules
- Unread count tracking

## WhatsApp Flows (app/flows/)
- Visual flow builder for WhatsApp interactive flows
- Publish flows to Meta: `/api/flows/[id]/publish`
- Track responses: `/api/flows/[id]/responses`
- Response data stored in `WhatsAppFlowResponse` model

## Embedded Signup
- Meta Embedded Signup for WhatsApp Business onboarding
- Implemented in `lib/whatsapp/embedded-signup.ts`
- Configured via Settings page

## Webhook Handler
`/api/webhooks/whatsapp` receives:
- Inbound messages (text, media, interactive)
- Delivery receipts (sent, delivered, read)
- Button/quick reply clicks

## Environment Variables
```
META_APP_ID=                    # Meta app ID
META_APP_SECRET=                # Meta app secret
WHATSAPP_PHONE_NUMBER_ID=       # WhatsApp business phone number ID
WHATSAPP_BUSINESS_ACCOUNT_ID=   # WhatsApp business account ID
WHATSAPP_ACCESS_TOKEN=          # Meta/WhatsApp permanent access token
META_ACCESS_TOKEN=              # Alias for WhatsApp token
```
