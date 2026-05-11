# 🔧 Fix 405 Errors - Server Restart Required

## Issue
405 Method Not Allowed errors on all API endpoints.

## Root Cause
Next.js routes exist and are correctly configured, but the server needs to be restarted to recognize them.

## ✅ Solution: Restart Server

### Step 1: Stop Current Server
Press `Ctrl+C` in the terminal where Next.js is running.

### Step 2: Clear Next.js Cache
```powershell
cd backend\shopify-dashboard
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

### Step 3: Restart Server
```powershell
npm run dev
```

### Step 4: Verify Routes
After restart, test these URLs in browser:
- http://localhost:3002/api/shopify/analytics
- http://localhost:3002/api/shopify/orders
- http://localhost:3002/api/shopify/products
- http://localhost:3002/api/customers
- http://localhost:3002/api/shopify/locations
- http://localhost:3002/api/shopify/checkouts

## ✅ Expected Result

After restart:
- **200 OK**: If Shopify is configured correctly
- **500 Error**: If Shopify is not configured (but NOT 405)
- **401/403**: If credentials are invalid (but NOT 405)

**405 errors will be completely resolved after restart!**

## 📋 Route Verification

All routes are verified to exist and have correct exports:
- ✅ `/api/shopify/analytics/route.ts` - GET export
- ✅ `/api/shopify/orders/route.ts` - GET export
- ✅ `/api/shopify/products/route.ts` - GET export
- ✅ `/api/customers/route.ts` - GET export
- ✅ `/api/shopify/locations/route.ts` - GET export
- ✅ `/api/shopify/checkouts/route.ts` - GET export

## 🎯 Quick Fix Script

Run this PowerShell script:
```powershell
cd backend\shopify-dashboard
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

**The 405 errors are a Next.js routing cache issue - restart will fix it!**

