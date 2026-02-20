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
| `lib/whatsapp/embedded-signup.ts` | Meta Embedded Signup flow |
| `lib/whatsapp/flow-handler.ts` | WhatsApp Flows data processing |
| `lib/whatsapp/validate-config.ts` | Config validation |
| `lib/whatsapp/normalize-phone.ts` | Phone number normalization |
| `app/api/whatsapp/**` | WhatsApp API routes |
| `app/api/chat/**` | Live chat API routes |
| `app/api/flows/**` | WhatsApp Flows API routes |
| `app/api/webhooks/whatsapp/route.ts` | Inbound message webhook |

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
