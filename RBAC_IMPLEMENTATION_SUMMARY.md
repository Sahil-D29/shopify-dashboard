# 🔐 RBAC Implementation Summary

## ✅ What Was Implemented

A comprehensive Role-Based Access Control (RBAC) system has been implemented for your Shopify Dashboard SaaS application with three distinct roles:

1. **ADMIN** - Platform owner with full access
2. **STORE_OWNER** - Store owners with access to their own store
3. **USER** - Team members with limited, read-only access

## 📁 Files Created/Modified

### New Files

1. **`backend/middleware/permissions.js`**
   - Defines all permissions based on the access matrix
   - Maps roles to their permissions
   - Provides helper functions: `hasPermission()`, `canAccessStore()`, `canWriteResource()`

2. **`backend/scripts/create-test-users.js`**
   - Script to create test users for all three roles
   - Includes users with different permission levels

3. **`RBAC_TESTING_GUIDE.md`**
   - Comprehensive testing guide with curl examples
   - Test scenarios for all features
   - Access matrix summary

4. **`RBAC_IMPLEMENTATION_SUMMARY.md`** (this file)
   - Overview of the implementation

### Modified Files

1. **`backend/middleware/rbac.js`**
   - Enhanced with permission-based authorization
   - Added `requirePermission()` middleware
   - Added `filterDataByStoreAccess()` helper
   - Added `requireWritePermission()` middleware
   - Improved `authorizeStoreAccess()` to handle all roles

2. **`backend/routes/campaignsRoutes.js`**
   - All endpoints now check permissions
   - Store access filtering for non-admin users
   - Users can create campaigns only if `canCreateCampaigns: true`

3. **`backend/routes/journeysRoutes.js`**
   - Permission checks for all CRUD operations
   - Users can only view journeys (read-only)
   - Store owners and admins can create/edit

4. **`backend/routes/segmentsRoutes.js`**
   - Permission checks for all CRUD operations
   - Users can only view segments (read-only)
   - Store owners and admins can create/edit

5. **`backend/routes/shopifyRoutes.js`**
   - Added authentication middleware
   - Store access checks for all endpoints
   - Admin can access all stores, others only their own

6. **`backend/routes/adminRoutes.js`**
   - Already protected (no changes needed)
   - Only admin role can access

## 🎯 Permission Matrix Implementation

| Feature | ADMIN | STORE_OWNER | USER |
|---------|-------|-------------|------|
| Dashboard | ✅ All stores | ✅ Own store | ✅ Own store (read-only) |
| Customers | ✅ View all | ✅ Manage own | ✅ View only |
| Orders | ✅ View all | ✅ Manage own | ✅ View only |
| Products | ✅ View all | ✅ Manage own | ✅ View only |
| Campaigns | ✅ All | ✅ Create/Edit | 🟡 Create (if allowed) |
| Journeys | ✅ All | ✅ Create/Edit | ✅ View only |
| Segments | ✅ All | ✅ Create/Edit | ✅ View only |
| Abandoned Carts | ✅ All | ✅ View/Recover | ✅ View only |
| Store Settings | ✅ All | ✅ Own store | ❌ No access |
| Team Management | ✅ All | ✅ Own team | ❌ No access |
| Admin Panel | ✅ Full access | ❌ No access | ❌ No access |
| Billing | ✅ All | ✅ Own billing | ❌ No access |
| Shopify OAuth | ✅ Manage | ✅ Own store | ❌ No access |

## 🔧 Key Features

### 1. Permission System
- Granular permissions for each feature
- Role-based permission mapping
- Helper functions for permission checks

### 2. Store Access Control
- Admin can access all stores
- Store owners and users can only access their assigned stores
- Automatic filtering of data based on store access

### 3. Write Permission Control
- Admin: Can write to all resources
- Store Owner: Can write to campaigns, journeys, segments in their store
- User: Can only write to campaigns (if `canCreateCampaigns: true`)

### 4. Data Filtering
- Automatic filtering of results based on user role and store access
- Prevents data leakage between stores
- Admin sees everything, others see only their store

## 🚀 How to Use

### 1. Create Test Users

```bash
cd backend
node scripts/create-test-users.js
```

This creates:
- 1 Admin user
- 2 Store Owner users (different stores)
- 2 User accounts (one with campaign creation permission, one without)

### 2. Test the Implementation

See `RBAC_TESTING_GUIDE.md` for comprehensive testing instructions with curl examples.

### 3. Use in Your Routes

```javascript
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess, requireWritePermission } from '../middleware/rbac.js';

// Require authentication
router.use(authenticate);

// Require store access (filters by store for non-admin)
router.get('/campaigns', authorizeStoreAccess(), async (req, res) => {
  // req.storeId is set if user is not admin
  // Data is automatically filtered
});

// Require write permission
router.post('/campaigns', 
  authorizeStoreAccess(), 
  requireWritePermission('campaigns'),
  async (req, res) => {
    // Only admin and store_owner can reach here
    // Users can only reach here if canCreateCampaigns: true
  }
);
```

## 🔍 Permission Checking

### Check if user has permission:
```javascript
import { hasPermission } from '../middleware/permissions.js';

if (hasPermission(user, PERMISSIONS.CAMPAIGNS_CREATE_EDIT)) {
  // User can create/edit campaigns
}
```

### Check store access:
```javascript
import { canAccessStore } from '../middleware/permissions.js';

if (canAccessStore(user, storeId)) {
  // User can access this store
}
```

### Filter data by store:
```javascript
import { filterDataByStoreAccess } from '../middleware/rbac.js';

const filteredCampaigns = filterDataByStoreAccess(user, campaigns, 'storeId');
```

## 📝 Important Notes

1. **Store IDs**: Store IDs should be normalized (without `.myshopify.com` suffix) in user records for consistent matching.

2. **User Campaign Creation**: Users can only create campaigns if their user object has `canCreateCampaigns: true`. This is set when creating the user or can be updated later.

3. **Authentication Required**: All protected routes require the `authenticate` middleware first, which sets `req.user`.

4. **Store Identifier**: For non-admin users, a store identifier (`storeId`, `shop`) must be provided in the request (query, params, or body).

5. **Error Responses**:
   - `401 Unauthorized`: No token or invalid token
   - `403 Forbidden`: Valid token but insufficient permissions
   - `400 Bad Request`: Missing required parameters (e.g., store identifier)

## 🧪 Testing Checklist

- [x] Admin can access all stores' data
- [x] Store Owner can only access their own store
- [x] User can only view their store's data (read-only)
- [x] Store Owner can create/edit campaigns, journeys, segments
- [x] User cannot create/edit journeys or segments
- [x] User can create campaigns only if `canCreateCampaigns: true`
- [x] Store Owner cannot access admin panel
- [x] User cannot access admin panel
- [x] Cross-store access is blocked for non-admin users
- [x] Missing store identifier returns 400 for non-admin users

## 🔐 Security Features

1. **Role Verification**: Every request verifies the user's role
2. **Store Isolation**: Users can only access data from their assigned stores
3. **Permission Granularity**: Fine-grained permissions for each feature
4. **Audit Logging**: All access denials are logged for security auditing
5. **Data Filtering**: Automatic filtering prevents data leakage

## 📚 Next Steps

1. **Frontend Integration**: Update frontend to respect these permissions
2. **UI Indicators**: Show read-only vs. editable states in the UI
3. **Invitation System**: Implement store owner invitation flow for users
4. **Permission Management**: Add UI for store owners to manage user permissions
5. **Audit Dashboard**: Create admin dashboard to view access logs

## 🐛 Troubleshooting

### Issue: "Missing store identifier" error
**Solution**: Ensure non-admin users provide `storeId` or `shop` in query/params/body

### Issue: "Access denied to this store" error
**Solution**: Verify the user's `stores` array includes the requested store ID

### Issue: User cannot create campaigns
**Solution**: Set `canCreateCampaigns: true` in the user object

### Issue: Admin cannot see all stores
**Solution**: Admin role should have empty `stores` array or the middleware should bypass store checks for admin

## 📞 Support

For issues or questions about the RBAC implementation, refer to:
- `RBAC_TESTING_GUIDE.md` for testing examples
- `backend/middleware/permissions.js` for permission definitions
- `backend/middleware/rbac.js` for middleware implementation

