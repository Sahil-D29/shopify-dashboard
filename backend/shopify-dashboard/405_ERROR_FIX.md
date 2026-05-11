# 🔧 405 Method Not Allowed - Diagnosis & Fix

## Issue Analysis

**Error**: All API endpoints returning 405 Method Not Allowed

**Root Cause**: The routes exist and have correct exports, but Next.js may not be recognizing them due to:
1. Server not restarted after route changes
2. Route file syntax errors
3. Next.js build cache issues
4. Missing runtime configuration

## ✅ Verification

All required routes exist:
- ✅ `/app/api/customers/route.ts` - Has `export async function GET()`
- ✅ `/app/api/shopify/analytics/route.ts` - Has `export async function GET()`
- ✅ `/app/api/shopify/orders/route.ts` - Has `export async function GET()`
- ✅ `/app/api/shopify/products/route.ts` - Has `export async function GET()`
- ✅ `/app/api/shopify/locations/route.ts` - Has `export async function GET()`
- ✅ `/app/api/shopify/checkouts/route.ts` - Has `export async function GET()`

## 🔧 Fix Steps

### Step 1: Restart Next.js Server
```powershell
# Stop the current server (Ctrl+C)
# Then restart:
cd backend\shopify-dashboard
npm run dev
```

### Step 2: Clear Next.js Cache
```powershell
cd backend\shopify-dashboard
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

### Step 3: Verify Route Exports
All routes should have:
```typescript
export const runtime = 'nodejs'; // Optional but recommended

export async function GET(request: NextRequest) {
  // Implementation
}
```

### Step 4: Check for Syntax Errors
Run TypeScript check:
```powershell
cd backend\shopify-dashboard
npx tsc --noEmit
```

## 🎯 Quick Fix Commands

```powershell
# 1. Stop the server (Ctrl+C in terminal)

# 2. Clear cache and restart
cd backend\shopify-dashboard
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev

# 3. Test endpoints in browser:
# http://localhost:3002/api/customers
# http://localhost:3002/api/shopify/analytics
```

## 📋 Route Verification Checklist

- [x] `/api/customers/route.ts` exists and exports GET
- [x] `/api/shopify/analytics/route.ts` exists and exports GET
- [x] `/api/shopify/orders/route.ts` exists and exports GET
- [x] `/api/shopify/products/route.ts` exists and exports GET
- [x] `/api/shopify/locations/route.ts` exists and exports GET
- [x] `/api/shopify/checkouts/route.ts` exists and exports GET

## 🔍 Debugging

If 405 errors persist after restart:

1. **Check Browser Network Tab**:
   - Open DevTools → Network
   - Check the actual request method
   - Verify the URL is correct

2. **Check Server Logs**:
   - Look for route registration messages
   - Check for any error messages

3. **Test Directly**:
   ```powershell
   # Test in PowerShell
   Invoke-WebRequest -Uri "http://localhost:3002/api/customers" -Method GET
   ```

4. **Verify Next.js Version**:
   ```powershell
   cd backend\shopify-dashboard
   npm list next
   ```

## ✅ Expected Result

After restart, all endpoints should return:
- Status: 200 OK (if configured)
- Status: 500 (if Shopify not configured - but NOT 405)
- Status: 401/403 (if credentials invalid - but NOT 405)

**405 should NOT occur** if routes are properly exported and server is restarted.

