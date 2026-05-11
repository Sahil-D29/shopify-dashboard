# Settings Page Permission Fix

## Issues Fixed

### 1. Role Checking Issues
**Problem**: The role checking was case-sensitive and didn't handle all role variations.

**Fix**: 
- Made role checking case-insensitive
- Added support for multiple role formats:
  - `'admin'`, `'ADMIN'`, `'administrator'` → `ADMIN`
  - `'manager'`, `'store_owner'`, `'storeowner'`, `'owner'` → `STORE_OWNER`
  - `'builder'`, `'viewer'` → `USER`

### 2. Store User Role Mapping
**Problem**: Store users have roles `'admin'`, `'manager'`, `'builder'`, `'viewer'` (lowercase), but the code was checking for uppercase.

**Fix**: 
- Normalize all role values to lowercase before comparison
- Map `'manager'` role to `STORE_OWNER` (store owners can access settings)

### 3. Infinite Loading Issue
**Problem**: Settings page could get stuck in loading state if API call failed or timed out.

**Fix**:
- Added 10-second timeout for permission checks
- Better error handling with user-friendly messages
- Allow access in setup mode even if permission check fails

### 4. Permission Check Too Strict
**Problem**: Users were blocked from accessing settings even when they should have access.

**Fix**:
- Allow access in setup mode (`?setup=true`) even if permission check fails
- More flexible role checking
- Better debug logging to identify issues

## Debug Logging Added

The following console logs have been added to help debug permission issues:

1. **User Context** (`lib/user-context.ts`):
   - Logs when user is found in main users or store users
   - Logs the role mapping process
   - Logs final user context with permissions

2. **Permissions API** (`app/api/user/permissions/route.ts`):
   - Logs permission check requests
   - Logs user context details
   - Logs access granted/denied decisions

3. **Settings Page** (`app/settings/page.tsx`):
   - Logs permission check process
   - Logs access decisions
   - Logs setup mode detection

## How to Debug Permission Issues

### Step 1: Check Browser Console
Open browser DevTools (F12) and check the Console tab. Look for:
- `[UserContext]` logs - shows user lookup and role mapping
- `[User Permissions API]` logs - shows permission check results
- `[Settings Page]` logs - shows page-level permission checks

### Step 2: Check User Role
Verify the user's role in the database:

**For main users** (`backend/data/users.json`):
```json
{
  "id": "user_xxx",
  "email": "user@example.com",
  "role": "store_owner"  // or "admin", "STORE_OWNER", etc.
}
```

**For store users** (`backend/data/stores/{storeId}/users.json`):
```json
{
  "id": "user_xxx",
  "email": "user@example.com",
  "role": "manager",  // Maps to STORE_OWNER
  "storeId": "store_xxx"
}
```

### Step 3: Verify Role Mapping
The system maps roles as follows:

| Database Role | System Role | Can Access Settings |
|--------------|-------------|---------------------|
| `admin`, `ADMIN`, `administrator` | `ADMIN` | ✅ Yes |
| `manager`, `store_owner`, `owner` | `STORE_OWNER` | ✅ Yes |
| `builder`, `viewer` | `USER` | ❌ No |

### Step 4: Test Setup Mode
If you're having permission issues, try accessing settings in setup mode:
```
http://localhost:3002/settings?setup=true
```

This will bypass strict permission checks and allow you to complete setup.

## Common Issues and Solutions

### Issue: "You do not have permission to access Settings"
**Solution**:
1. Check browser console for debug logs
2. Verify user role in database matches expected values
3. Try accessing with `?setup=true` parameter
4. Check if user is logged in correctly

### Issue: Infinite Loading
**Solution**:
1. Check browser console for errors
2. Verify API endpoint `/api/user/permissions` is accessible
3. Check network tab for failed requests
4. Clear browser cache and cookies
5. Restart development server

### Issue: Role Not Recognized
**Solution**:
1. Check the actual role value in database (case-sensitive in database, but code handles case-insensitive)
2. Verify role is one of: `admin`, `manager`, `store_owner`, `owner`
3. For store users, ensure role is `manager` (maps to STORE_OWNER)

## Testing Checklist

- [ ] Login as user with `role: "admin"` → Should access settings
- [ ] Login as user with `role: "manager"` (store user) → Should access settings
- [ ] Login as user with `role: "store_owner"` → Should access settings
- [ ] Login as user with `role: "builder"` → Should NOT access settings
- [ ] Access `/settings?setup=true` → Should work even without proper role
- [ ] Check browser console for debug logs
- [ ] Verify no infinite loading states

## Temporary Bypass (For Development Only)

If you need immediate access for testing, you can temporarily modify the permission check in `app/settings/page.tsx`:

```typescript
// TEMPORARY: Allow all authenticated users
if (data.success) {
  setHasAccess(true);
} else {
  // Still allow in setup mode
  if (isSetupMode) {
    setHasAccess(true);
  }
}
```

**⚠️ WARNING**: Remove this bypass before deploying to production!

## Next Steps

1. Test with different user roles
2. Check console logs to verify role mapping
3. Update user roles in database if needed
4. Remove debug logs before production (optional)

