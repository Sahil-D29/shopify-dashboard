# Multi-Tenancy / Store System

## Overview
The app supports multiple Shopify stores per user account. Each store is an isolated tenant with its own data (campaigns, contacts, journeys, subscriptions, etc.).

## Data Model
```
User (account)
  ├── owns Store(s) — via Store.ownerId
  └── member of Store(s) — via StoreMember (role: OWNER, MANAGER, TEAM_MEMBER, VIEWER)

Store
  ├── StoreMember[] — team members with roles
  ├── Campaign[], Journey[], Segment[] — marketing data
  ├── Contact[], Conversation[], Message[] — customer data
  ├── Subscription, Payment[] — billing data
  ├── WhatsAppConfig — WhatsApp setup
  └── Brand — branding config
```

All data is scoped by `storeId`. Every query in API routes must filter by storeId.

## Store ID Resolution

### Client-side: `useTenant()` hook
```typescript
import { useTenant } from '@/lib/tenant/tenant-context';

function MyComponent() {
  const { currentStore, stores, isLoading, switchStore } = useTenant();
  const storeId = currentStore?.id;  // Use this!
}
```
- Provided by `TenantProvider` in root layout (`app/layout.tsx`)
- Loads stores from `/api/stores` on mount
- Auto-selects first active store if none set
- Sets `current_store_id` cookie for server-side resolution
- Caches in localStorage for fast reload

### Server-side: `getCurrentStoreId(request)`
```typescript
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

const storeId = await getCurrentStoreId(request);
```
Resolution order:
1. `x-store-id` request header (explicit, most reliable)
2. `current_store_id` cookie (set by TenantProvider)
3. `storeId` query parameter (for initial setup)

### Server-side: `getUserContext(request)`
```typescript
import { getUserContext } from '@/lib/user-context';

const { userId, storeId, role } = await getUserContext(request);
```
Combines auth session + tenant resolution in one call.

## Client Fetch Pattern
Always pass `x-store-id` header for reliable server-side resolution:
```typescript
const { currentStore } = useTenant();

const response = await fetch('/api/campaigns', {
  headers: {
    'Content-Type': 'application/json',
    'x-store-id': currentStore?.id || '',
  },
});
```

## Middleware: `lib/tenant/tenant-middleware.ts`
- Runs on API routes (not auth/public routes)
- Extracts storeId from header/cookie/query
- Propagates via `x-store-id` response header

## Store Registry: `lib/store-registry.ts`
- `getStoresForUser(userId)` — returns stores user owns or is a member of
- `createStore(data)` — creates new store
- `updateStore(id, data)` — updates store config
- Stores have status: `active`, `inactive`, `suspended`

## Store Switching
```typescript
const { switchStore } = useTenant();
await switchStore(newStoreId);
// Updates cookie, clears caches, refreshes page
```

## Access Control
- `validateTenantAccess(userId, storeId)` in `lib/tenant/tenant-middleware.ts`
- Checks store exists, is active, and user has access
- Roles defined in `StoreMember.role`: OWNER, MANAGER, TEAM_MEMBER, VIEWER

## API Routes
| Route | Purpose |
|-------|---------|
| `/api/stores` | List user's stores |
| `/api/store/current` | Get current store context |
| `/api/teams/[storeId]` | Store team details |
| `/api/teams/[storeId]/members` | Team member CRUD |
| `/api/teams/[storeId]/invite` | Send invitation |
| `/api/teams/[storeId]/add-user` | Add existing user |
| `/api/teams/[storeId]/remove-user` | Remove member |
| `/api/teams/[storeId]/activity-logs` | Audit trail |

## Common Mistake
**Never** use `session.user.storeId` — it doesn't exist in the NextAuth session. Always use:
- Client: `useTenant().currentStore?.id`
- Server: `getCurrentStoreId(request)` or `getUserContext(request)`
