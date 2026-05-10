# Setup Flow Usage Guide

## Quick Start

The setup flow is now implemented and works automatically. Here's how to use it:

### Automatic Behavior

1. **First-time users** are automatically redirected to `/settings?setup=true`
2. **Setup completion** is tracked in localStorage
3. **Once completed**, users go directly to dashboard on future visits

### Using the Hook Directly

```typescript
'use client';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export function MyComponent() {
  const { 
    setupCompleted,      // boolean - Is setup complete?
    shopifyConfigured,   // boolean - Is Shopify configured?
    whatsappConfigured,  // boolean - Is WhatsApp configured?
    loading,             // boolean - Is status check in progress?
    refetch              // function - Manually refetch status
  } = useSetupStatus();

  if (loading) return <div>Checking setup status...</div>;
  
  if (!setupCompleted) {
    return <div>Please complete setup first</div>;
  }

  return <div>Setup complete! Welcome!</div>;
}
```

### Enhanced ConfigurationGuard

The `ConfigurationGuard` component now supports an enhanced setup flow check:

```typescript
import { ConfigurationGuard } from '@/components/ConfigurationGuard';

// Original behavior (checks only Shopify config)
<ConfigurationGuard>
  <YourContent />
</ConfigurationGuard>

// Enhanced behavior (checks both Shopify AND WhatsApp + setup completion)
<ConfigurationGuard useSetupFlow={true}>
  <YourContent />
</ConfigurationGuard>
```

### Manual Setup Status Management

```typescript
import { StoreConfigManager } from '@/lib/store-config';

// Mark setup as completed
StoreConfigManager.markSetupCompleted();

// Check if setup is completed
const isComplete = StoreConfigManager.isSetupCompleted();

// Clear setup completion (useful for testing or reset)
StoreConfigManager.clearSetupCompleted();
```

## API Endpoints

### GET `/api/settings/setup-status`
Returns current setup status:

```json
{
  "setupCompleted": true,
  "shopifyConfigured": true,
  "whatsappConfigured": true
}
```

### POST `/api/settings/setup-status`
Acknowledges setup completion (flag stored client-side in localStorage).

## Integration Examples

### Example 1: Layout-level Setup Check

```typescript
'use client';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { usePathname } from 'next/navigation';

export function AppLayout({ children }) {
  const pathname = usePathname();
  const { setupCompleted, loading } = useSetupStatus();
  
  // Allow settings page and auth pages
  const isPublicPath = pathname?.startsWith('/settings') || 
                       pathname?.startsWith('/auth');
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  // Hook handles redirects automatically
  return <>{children}</>;
}
```

### Example 2: Dashboard with Setup Banner

```typescript
'use client';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export function Dashboard() {
  const { setupCompleted, shopifyConfigured, whatsappConfigured } = useSetupStatus();
  
  if (!setupCompleted) {
    return (
      <div className="banner">
        <p>Please complete setup in Settings</p>
        <Link href="/settings?setup=true">Go to Settings</Link>
      </div>
    );
  }
  
  return <div>Dashboard content...</div>;
}
```

### Example 3: Conditional Feature Access

```typescript
'use client';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export function CampaignsPage() {
  const { shopifyConfigured } = useSetupStatus();
  
  if (!shopifyConfigured) {
    return (
      <div>
        <p>Shopify must be configured to create campaigns</p>
        <Link href="/settings">Configure Shopify</Link>
      </div>
    );
  }
  
  return <CampaignList />;
}
```

## Testing

### Reset Setup Status for Testing

```typescript
// In browser console or test code
localStorage.removeItem('setup_completed');
localStorage.removeItem('setup_completed_at');

// Or use the utility
import { StoreConfigManager } from '@/lib/store-config';
StoreConfigManager.clearSetupCompleted();
```

### Check Setup Status

```typescript
// Check localStorage
localStorage.getItem('setup_completed'); // "true" or null

// Check via API
fetch('/api/settings/setup-status').then(r => r.json());

// Use hook
const { setupCompleted } = useSetupStatus();
```

## Flow Diagram

```
User Signs In
    ↓
Check Setup Status
    ↓
Setup Complete? ──No──> Redirect to /settings?setup=true
    │
   Yes
    ↓
Go to Dashboard
```

## Notes

- Setup completion is **browser-specific** (stored in localStorage)
- Clearing browser data will reset setup status
- The hook automatically handles redirects
- Both Shopify AND WhatsApp must be configured for setup to be complete
- Setup can be manually reset via `StoreConfigManager.clearSetupCompleted()`


