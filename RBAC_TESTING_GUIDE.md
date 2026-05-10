# 🔐 Role-Based Access Control (RBAC) Testing Guide

This guide explains how to test the implemented RBAC system with three roles: **ADMIN**, **STORE_OWNER**, and **USER**.

## 📋 Prerequisites

1. **Setup Environment**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and set JWT_SECRET (or use default for testing)
   ```

2. **Install Dependencies** (if not already installed):
   ```bash
   npm install bcrypt jsonwebtoken
   ```

3. **Create Test Users**: Run the test user creation script:
   ```bash
   node scripts/create-test-users.js
   ```

4. **Start the Backend Server**:
   ```bash
   npm start
   ```

5. **Get JWT Tokens**: Login to get tokens for each test user:
   ```bash
   # Login as Admin
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@test.com", "password": "Admin123!@#"}'
   
   # Save the token from response: {"success": true, "token": "...", "user": {...}}
   ```

**See `QUICK_TEST_GUIDE.md` for step-by-step testing instructions!**

## 👥 Test Users

| Role | Email | Password | Store Access | Special Permissions |
|------|-------|----------|--------------|---------------------|
| **ADMIN** | `admin@test.com` | `Admin123!@#` | All stores | Full access |
| **STORE_OWNER** | `storeowner@test.com` | `StoreOwner123!@#` | `test-store-1` | Manage own store |
| **STORE_OWNER 2** | `storeowner2@test.com` | `StoreOwner123!@#` | `test-store-2` | Manage own store |
| **USER** | `user@test.com` | `User123!@#` | `test-store-1` | View only |
| **USER (Campaigns)** | `usercampaigns@test.com` | `User123!@#` | `test-store-1` | View + Create campaigns |

**Note:** Store IDs are configurable via `TEST_STORE_1` and `TEST_STORE_2` environment variables.

## 🧪 Testing Scenarios

### 1. Dashboard Access

#### Test: Admin can view all stores
```bash
# Get admin token first, then:
curl -X GET "http://localhost:5000/api/shopify/analytics" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns analytics for default store

#### Test: Store Owner can view own store
```bash
curl -X GET "http://localhost:5000/api/shopify/analytics?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>"
```
**Expected**: ✅ Success - Returns analytics for `test-store-1` store

**Note:** Replace `test-store-1` with your actual store ID from environment variables.

#### Test: Store Owner cannot view other stores
```bash
curl -X GET "http://localhost:5000/api/shopify/analytics?shop=test-store-2.myshopify.com" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>"
```
**Expected**: ❌ 403 Forbidden - "Access denied to this store"

**Note:** This test assumes store owner 1 only has access to `test-store-1`, not `test-store-2`.

#### Test: User can view own store (read-only)
```bash
curl -X GET "http://localhost:5000/api/shopify/analytics?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ✅ Success - Returns analytics (read-only access)

---

### 2. Customers Access

#### Test: Admin can view all customers
```bash
curl -X GET "http://localhost:5000/api/shopify/customers" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns customers from all stores

#### Test: Store Owner can view own customers
```bash
curl -X GET "http://localhost:5000/api/shopify/customers?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>"
```
**Expected**: ✅ Success - Returns customers from `test-store-1` store

#### Test: User can view customers (read-only)
```bash
curl -X GET "http://localhost:5000/api/shopify/customers?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ✅ Success - Returns customers (view only)

---

### 3. Campaigns Access

#### Test: Admin can view all campaigns
```bash
curl -X GET "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns all campaigns

#### Test: Store Owner can create campaign
```bash
curl -X POST "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "storeId": "test-store-1",
    "type": "email"
  }'
```
**Expected**: ✅ 201 Created - Campaign created successfully

#### Test: Store Owner can edit own campaign
```bash
curl -X PUT "http://localhost:5000/api/campaigns/<CAMPAIGN_ID>" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Campaign"}'
```
**Expected**: ✅ Success - Campaign updated

#### Test: Store Owner cannot edit other store's campaign
```bash
# First, create a campaign as storeowner2, then try to edit as storeowner
curl -X PUT "http://localhost:5000/api/campaigns/<OTHER_STORE_CAMPAIGN_ID>" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked Campaign"}'
```
**Expected**: ❌ 403 Forbidden - "Access denied to this campaign"

#### Test: User cannot create campaign (default)
```bash
curl -X POST "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "storeId": "sai-laxmi-dev",
    "type": "email"
  }'
```
**Expected**: ❌ 403 Forbidden - "You do not have permission to create campaigns"

#### Test: User can view campaigns
```bash
curl -X GET "http://localhost:5000/api/campaigns?storeId=test-store-1" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ✅ Success - Returns campaigns (view only)

#### Test: User with campaign permission can create
```bash
curl -X POST "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer <USER_CAMPAIGNS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "storeId": "sai-laxmi-dev",
    "type": "email"
  }'
```
**Expected**: ✅ 201 Created - Campaign created (user has `canCreateCampaigns: true`)

#### Test: User cannot edit campaigns
```bash
curl -X PUT "http://localhost:5000/api/campaigns/<CAMPAIGN_ID>" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Campaign"}'
```
**Expected**: ❌ 403 Forbidden - "You do not have permission to edit campaigns"

---

### 4. Journeys Access

#### Test: Admin can view all journeys
```bash
curl -X GET "http://localhost:5000/api/journeys" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns all journeys

#### Test: Store Owner can create journey
```bash
curl -X POST "http://localhost:5000/api/journeys" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Journey",
    "storeId": "test-store-1"
  }'
```
**Expected**: ✅ 201 Created - Journey created

#### Test: User cannot create journey
```bash
curl -X POST "http://localhost:5000/api/journeys" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Journey",
    "storeId": "sai-laxmi-dev"
  }'
```
**Expected**: ❌ 403 Forbidden - "You do not have permission to create journeys"

#### Test: User can view journeys (read-only)
```bash
curl -X GET "http://localhost:5000/api/journeys?storeId=test-store-1" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ✅ Success - Returns journeys (view only)

---

### 5. Segments Access

#### Test: Admin can view all segments
```bash
curl -X GET "http://localhost:5000/api/segments" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns all segments

#### Test: Store Owner can create segment
```bash
curl -X POST "http://localhost:5000/api/segments" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Segment",
    "storeId": "sai-laxmi-dev",
    "criteria": {}
  }'
```
**Expected**: ✅ 201 Created - Segment created

#### Test: User cannot create segment
```bash
curl -X POST "http://localhost:5000/api/segments" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Segment",
    "storeId": "sai-laxmi-dev"
  }'
```
**Expected**: ❌ 403 Forbidden - "You do not have permission to create segments"

---

### 6. Admin Panel Access

#### Test: Admin can access admin routes
```bash
curl -X GET "http://localhost:5000/api/admin/users" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns all users

#### Test: Store Owner cannot access admin routes
```bash
curl -X GET "http://localhost:5000/api/admin/users" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>"
```
**Expected**: ❌ 403 Forbidden - "This action requires one of: admin"

#### Test: User cannot access admin routes
```bash
curl -X GET "http://localhost:5000/api/admin/users" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ❌ 403 Forbidden - "This action requires one of: admin"

---

### 7. Abandoned Carts Access

#### Test: Admin can view all abandoned carts
```bash
curl -X GET "http://localhost:5000/api/shopify/checkouts" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Expected**: ✅ Success - Returns all abandoned checkouts

#### Test: Store Owner can view own abandoned carts
```bash
curl -X GET "http://localhost:5000/api/shopify/checkouts?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <STORE_OWNER_TOKEN>"
```
**Expected**: ✅ Success - Returns abandoned checkouts for own store

#### Test: User can view abandoned carts (read-only)
```bash
curl -X GET "http://localhost:5000/api/shopify/checkouts?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected**: ✅ Success - Returns abandoned checkouts (view only)

---

## 📊 Access Matrix Summary

| Feature | ADMIN | STORE_OWNER | USER |
|---------|-------|-------------|------|
| **Dashboard** | ✅ All stores | ✅ Own store | ✅ Own store (read-only) |
| **Customers** | ✅ View all | ✅ Manage own | ✅ View only |
| **Orders** | ✅ View all | ✅ Manage own | ✅ View only |
| **Products** | ✅ View all | ✅ Manage own | ✅ View only |
| **Campaigns** | ✅ All | ✅ Create/Edit | 🟡 Create (if allowed) |
| **Journeys** | ✅ All | ✅ Create/Edit | ✅ View only |
| **Segments** | ✅ All | ✅ Create/Edit | ✅ View only |
| **Abandoned Carts** | ✅ All | ✅ View/Recover | ✅ View only |
| **Store Settings** | ✅ All | ✅ Own store | ❌ No access |
| **Team Management** | ✅ All | ✅ Own team | ❌ No access |
| **Admin Panel** | ✅ Full access | ❌ No access | ❌ No access |
| **Billing** | ✅ All | ✅ Own billing | ❌ No access |
| **Shopify OAuth** | ✅ Manage | ✅ Own store | ❌ No access |

## 🔍 Testing Checklist

- [ ] Admin can access all stores' data
- [ ] Store Owner can only access their own store
- [ ] User can only view their store's data (read-only)
- [ ] Store Owner can create/edit campaigns, journeys, segments
- [ ] User cannot create/edit journeys or segments
- [ ] User can create campaigns only if `canCreateCampaigns: true`
- [ ] Store Owner cannot access admin panel
- [ ] User cannot access admin panel
- [ ] Cross-store access is blocked for non-admin users
- [ ] Missing store identifier returns 400 for non-admin users
- [ ] Unauthorized requests return 401
- [ ] Forbidden requests return 403

## 🛠️ Quick Test Script

Create a file `test-rbac.sh`:

```bash
#!/bin/bash

# Set your tokens here
ADMIN_TOKEN="your_admin_token"
STORE_OWNER_TOKEN="your_store_owner_token"
USER_TOKEN="your_user_token"

BASE_URL="http://localhost:5000"

echo "Testing Admin Access..."
curl -X GET "$BASE_URL/api/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN"

echo "Testing Store Owner Access..."
curl -X GET "$BASE_URL/api/campaigns?storeId=sai-laxmi-dev" -H "Authorization: Bearer $STORE_OWNER_TOKEN"

echo "Testing User Access..."
curl -X GET "$BASE_URL/api/campaigns?storeId=sai-laxmi-dev" -H "Authorization: Bearer $USER_TOKEN"

echo "Testing User Cannot Create Campaign..."
curl -X POST "$BASE_URL/api/campaigns" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "storeId": "sai-laxmi-dev"}'
```

## 📝 Notes

1. **JWT Tokens**: You'll need to implement authentication endpoints to get JWT tokens for each user. The tokens should include the user's role and store information.

2. **Store IDs**: Make sure store IDs match between your test data and actual store identifiers.

3. **Campaign Creation for Users**: The `canCreateCampaigns` flag must be set to `true` in the user object for users to create campaigns.

4. **Error Messages**: All error responses should be clear and indicate the reason for denial.

5. **Logging**: All access denials are logged in the activity logs for audit purposes.

## 🚀 Next Steps

1. Implement authentication endpoints to generate JWT tokens
2. Create frontend components that respect these permissions
3. Add UI indicators for read-only vs. editable content
4. Implement invitation system for store owners to invite users
5. Add audit logging dashboard for admins

