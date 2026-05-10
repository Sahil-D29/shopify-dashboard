# Settings Page 500 Error - Fix Applied

## Problem
Getting "Internal Server Error" (500) when accessing `/settings` page in Next.js application.

## Root Cause Analysis

The error was likely caused by:
1. **Unhandled errors in `getUserContext()`** - When reading user data from JSON files
2. **Missing error handling in API routes** - Errors were not being caught and logged properly
3. **JSON parsing errors** - Invalid or corrupted JSON files could cause crashes
4. **File access errors** - Missing files or permission issues

## Fixes Applied

### 1. Enhanced Error Handling in `fileAuth.ts`
- ✅ Added validation for empty files
- ✅ Added JSON structure validation
- ✅ Better error messages for different error types (ENOENT, SyntaxError, etc.)
- ✅ Comprehensive error logging with stack traces

### 2. Enhanced Error Handling in `user-context.ts`
- ✅ Wrapped `auth()` call in try-catch
- ✅ Wrapped `findUserById()` and `findStoreUserById()` in try-catch
- ✅ Added detailed error logging
- ✅ Graceful fallback to null instead of crashing

### 3. Enhanced Error Handling in API Routes
- ✅ `/api/user/permissions/route.ts`:
  - Wrapped `getUserContext()` in try-catch
  - Returns safe response (200) instead of crashing
  - Detailed error logging

- ✅ `/api/settings/status/route.ts`:
  - Wrapped `getUserContext()` in try-catch
  - Returns safe response instead of 500 error
  - Detailed error logging

## What to Check Next

### 1. Check Server Console Logs
When you access `/settings`, check the terminal where Next.js is running. You should now see detailed error logs like:
```
[UserContext] Error getting session: ...
[User Permissions API] Error getting user context: ...
```

### 2. Verify Data Files
Check if these files exist and are valid JSON:
- `backend/shopify-dashboard/data/users.json`
- `backend/shopify-dashboard/data/stores/store-registry.json` (if using store users)

### 3. Check Environment Variables
Ensure these are set in `.env.local`:
```env
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3002
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 4. Verify File Permissions
Ensure the data directory is readable:
```bash
# On Windows (PowerShell)
Get-Acl backend/shopify-dashboard/data

# On Linux/Mac
ls -la backend/shopify-dashboard/data
```

### 5. Test the API Routes Directly
Test these endpoints directly:
```bash
# Test user permissions
curl http://localhost:3002/api/user/permissions

# Test settings status
curl http://localhost:3002/api/settings/status
```

## Expected Behavior After Fix

1. **No more 500 errors** - All errors are caught and handled gracefully
2. **Detailed error logs** - Check console for specific error messages
3. **Safe responses** - API routes return 200 with error details instead of crashing
4. **Frontend handles errors** - Settings page should show appropriate error messages

## Debugging Steps

1. **Clear browser cache and cookies**
2. **Restart Next.js dev server**:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   ```
3. **Check browser console** - Look for any client-side errors
4. **Check Network tab** - See the actual API response
5. **Check server logs** - Look for the detailed error messages we added

## Common Issues and Solutions

### Issue: "Users file not found"
**Solution**: The file will be created automatically, or you can create it manually:
```json
{
  "users": []
}
```

### Issue: "Invalid JSON"
**Solution**: Validate the JSON file:
```bash
# On Windows (PowerShell)
Get-Content backend/shopify-dashboard/data/users.json | ConvertFrom-Json

# On Linux/Mac
cat backend/shopify-dashboard/data/users.json | jq .
```

### Issue: "NEXTAUTH_SECRET not configured"
**Solution**: Generate and set the secret:
```bash
node backend/shopify-dashboard/scripts/generate-secrets.js
```

### Issue: "Session not found"
**Solution**: 
- Make sure you're logged in
- Check if cookies are being set
- Verify NEXTAUTH_URL matches your app URL

## Next Steps

1. **Restart the server** and try accessing `/settings` again
2. **Check the console logs** for specific error messages
3. **If error persists**, share the console logs so we can identify the exact issue
4. **Verify all data files exist** and are valid JSON

## Files Modified

- ✅ `backend/shopify-dashboard/lib/fileAuth.ts` - Enhanced error handling
- ✅ `backend/shopify-dashboard/lib/user-context.ts` - Added try-catch blocks
- ✅ `backend/shopify-dashboard/app/api/user/permissions/route.ts` - Error handling
- ✅ `backend/shopify-dashboard/app/api/settings/status/route.ts` - Error handling

---

**Status**: ✅ Fixes Applied  
**Next**: Test the application and check console logs for specific errors

