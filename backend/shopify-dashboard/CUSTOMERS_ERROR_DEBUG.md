# 🔍 Customer Fetch Error Debugging - Enhanced Logging

## Changes Applied

### 1. ✅ Frontend Error Logging (`app/customers/page.tsx`)

**Added detailed logging:**
- Logs the fetch URL before making request
- Logs response status and headers
- Logs full error response body (text and parsed JSON)
- Logs successful data receipt with customer count
- Enhanced error catch with full error details including stack trace

**Error Handling:**
```typescript
- Logs URL being fetched
- Logs response status and headers
- Attempts to read error response as text
- Tries to parse error as JSON
- Extracts error message from multiple possible fields
- Shows detailed error in console
```

### 2. ✅ Backend API Route Logging (`app/api/customers/route.ts`)

**Added step-by-step logging:**
- Logs when request starts
- Logs request parameters (forceRefresh, limit)
- Logs cache hits/misses
- Logs Shopify client creation
- Logs config header presence
- Logs each Shopify API call (customers, orders)
- Logs success with counts
- Logs detailed errors with stack traces

**Error Handling:**
- Returns detailed error information
- Includes error message, details, and status code
- Returns empty customers array to prevent frontend crashes
- Logs full error object with stack trace

### 3. ✅ Shopify Client Error Logging (`lib/shopify/client.ts`)

**Enhanced `requestRaw` method:**
- Validates configuration before request
- Logs request details (method, URL, shop, hasAccessToken)
- Logs response status and OK status
- Attempts to read and parse error responses
- Handles rate limiting (429) with retry-after info
- Handles authentication errors (401/403)
- Extracts error messages from Shopify response format
- Handles network errors separately

**Error Messages:**
- Configuration errors: "Shopify configuration not found"
- Rate limiting: "Shopify API rate limit exceeded"
- Authentication: "Invalid Shopify credentials"
- API errors: Includes status, statusText, and error details
- Network errors: "Failed to connect to Shopify API"

## How to Debug

### 1. Check Browser Console
Open DevTools (F12) → Console tab and look for:
- 🔄 Fetching customers from: [URL]
- 📡 Response status: [status] [statusText]
- ✅ Customers data received: { customerCount, lastSynced, cached }
- ❌ API Error Response: { status, statusText, body }

### 2. Check Server Logs
Look in the terminal where Next.js is running for:
- 🔄 GET /api/customers - Starting request
- 📋 Request params: { forceRefresh, limit }
- 🔗 Getting Shopify client...
- 🔑 Config header present: true/false
- 📥 Fetching customers from Shopify...
- ✅ Fetched X customers from Shopify
- ❌ Error in GET /api/customers: { error, message, stack }

### 3. Common Issues and Solutions

#### Issue: "Shopify configuration not found"
**Solution:**
- Go to Settings page
- Configure Shopify store URL and access token
- Verify configuration is saved

#### Issue: "Invalid Shopify credentials"
**Solution:**
- Check Shopify Admin API credentials
- Verify access token has correct permissions
- Regenerate access token if needed

#### Issue: "Shopify API rate limit exceeded"
**Solution:**
- Wait for the retry-after period
- Implement rate limiting in your code
- Reduce request frequency

#### Issue: Network errors
**Solution:**
- Check internet connection
- Verify Shopify store URL is correct
- Check firewall/proxy settings

#### Issue: 406 Method Not Allowed
**Solution:**
- Verify API route uses correct HTTP method (GET)
- Check Next.js route configuration
- Ensure route file is in correct location

## Expected Log Flow (Success)

### Frontend:
```
🔄 Fetching customers from: http://localhost:3002/api/customers?limit=250
📡 Response status: 200 OK
✅ Customers data received: { customerCount: 10, lastSynced: 1234567890, cached: false }
```

### Backend:
```
🔄 GET /api/customers - Starting request
📋 Request params: { forceRefresh: false, limit: 250 }
🔗 Getting Shopify client...
🔑 Config header present: true
📥 Fetching customers from Shopify...
🔗 Shopify API Request: { method: 'GET', url: 'https://...', shop: '...', hasAccessToken: true }
📡 Shopify API Response: { status: 200, statusText: 'OK', ok: true }
✅ Fetched 10 customers from Shopify
📥 Fetching orders from Shopify...
✅ Fetched 5 orders from Shopify
💾 Caching 10 formatted customers
✅ Returning customers response
```

## Expected Log Flow (Error)

### Frontend:
```
🔄 Fetching customers from: http://localhost:3002/api/customers?limit=250
📡 Response status: 500 Internal Server Error
❌ API Error Response: { status: 500, statusText: 'Internal Server Error', body: '{"error":"Failed to fetch customers","details":"..."}' }
❌ Parsed error data: { error: '...', details: '...' }
❌ Error fetching customers: { error: Error, message: '...', stack: '...' }
```

### Backend:
```
🔄 GET /api/customers - Starting request
🔗 Getting Shopify client...
🔑 Config header present: false
⚠️ No X-Shopify-Config header found, using env vars fallback
📥 Fetching customers from Shopify...
🔗 Shopify API Request: { method: 'GET', url: 'https://...', shop: '...', hasAccessToken: true }
📡 Shopify API Response: { status: 401, statusText: 'Unauthorized', ok: false }
❌ Shopify API Error Response: { status: 401, statusText: 'Unauthorized', url: '...', body: '...' }
❌ Error in GET /api/customers: { error: Error, message: 'Invalid Shopify credentials', stack: '...' }
```

## Next Steps

1. **Open the application** and navigate to Customers page
2. **Open browser DevTools** (F12) → Console tab
3. **Check the logs** to see exactly where the error occurs
4. **Check server terminal** for backend logs
5. **Share the error logs** to identify the root cause
6. **Fix based on the specific error** shown in logs

The enhanced logging will now show you exactly what's failing and where!

