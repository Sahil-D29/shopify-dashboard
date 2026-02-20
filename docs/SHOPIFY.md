# Shopify Integration

## Overview
Full Shopify integration for store management: OAuth authentication, product/order/customer sync, abandoned carts, webhook handling, and analytics.

## Key Files
| File | Purpose |
|------|---------|
| `lib/shopify.ts` | OAuth flow (install URL, callback, token exchange), webhook verification |
| `lib/shopify-api.ts` | REST/GraphQL API wrapper with token management |
| `lib/encryption.ts` | Encrypts/decrypts Shopify access tokens |
| `app/api/auth/shopify/route.ts` | Initiates Shopify OAuth |
| `app/api/auth/shopify/callback/route.ts` | Handles OAuth callback + token storage |
| `app/api/shopify/**` | All Shopify data endpoints |
| `app/api/webhooks/shopify/route.ts` | Shopify webhook handler |
| `jobs/shopify-token.worker.ts` | Validates Shopify tokens periodically |

## OAuth Flow
1. User clicks "Connect Shopify" in Settings
2. App redirects to Shopify OAuth: `/api/auth/shopify` → `buildInstallUrl()`
3. Shopify redirects back to `/api/auth/shopify/callback`
4. `verifyOAuthCallback()` validates state + HMAC
5. Exchanges code for access token
6. Token encrypted via `encrypt()` and stored in `Store.shopifyAccessToken`

## API Endpoints
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/shopify/orders` | GET | List orders |
| `/api/shopify/orders/[id]` | GET | Order details |
| `/api/shopify/customers` | GET | List customers |
| `/api/shopify/customers/[id]` | GET | Customer details |
| `/api/shopify/products` | GET | List products |
| `/api/shopify/products/[id]` | GET | Product details |
| `/api/shopify/collections` | GET | Product collections |
| `/api/shopify/checkouts` | GET | Abandoned checkouts |
| `/api/shopify/discount-codes` | GET | Discount codes (mock data - TODO) |
| `/api/shopify/locations` | GET | Store locations |
| `/api/shopify/customer-tags` | GET | Customer tags |
| `/api/shopify/product-types` | GET | Product types |
| `/api/shopify/vendors` | GET | Product vendors |
| `/api/shopify/tags` | GET | Product tags |
| `/api/shopify/catalog` | GET | Full product catalog |
| `/api/shopify/test-connection` | GET | Verify API connectivity |
| `/api/shopify/analytics/*` | GET | Sales/order analytics |

## Webhook Handling
`/api/webhooks/shopify` — verifies HMAC-SHA256 signature then processes:
- `orders/create`, `orders/updated` — order sync
- `checkouts/create`, `checkouts/update` — abandoned cart tracking
- `customers/create`, `customers/update` — customer sync

Verification: `verifyShopifyWebhook()` in `lib/shopify.ts`

## Token Management
- Tokens stored encrypted in `Store.shopifyAccessToken`
- Decrypted on-demand when making API calls
- Periodic validation via cron: `/api/cron/shopify-token-check`
- Token refresh handled by `lib/token-manager.ts`

## Type Definitions
```
lib/types/shopify-customer.ts
lib/types/shopify-order.ts
lib/types/shopify-product.ts
lib/types/shopify-checkout.ts
lib/types/shopify-location.ts
```

## Environment Variables
```
SHOPIFY_API_KEY=           # Partner Dashboard app API key
SHOPIFY_API_SECRET=        # Partner Dashboard app secret
SHOPIFY_API_VERSION=       # API version (default: 2024-10)
SHOPIFY_WEBHOOK_SECRET=    # Webhook HMAC verification secret
SHOPIFY_STORE_URL=         # Default store URL (optional)
SHOPIFY_ACCESS_TOKEN=      # Default access token (optional)
```

## Scopes Requested
Products, orders, customers, locations, checkouts, inventory (read/write as needed).

## Contact Sync
`/api/contacts/sync-shopify` — imports Shopify customers as contacts into the Contact model with phone, email, and custom fields mapping.
