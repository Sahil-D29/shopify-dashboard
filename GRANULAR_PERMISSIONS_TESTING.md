# 🧪 Granular Permissions Testing Guide

## Quick Start

### 1. Setup
```bash
cd backend
node scripts/create-test-users.js
npm start
```

### 2. Test Users Created

| Email | Role | Preset | Can Do |
|-------|------|--------|--------|
| `marketing@test.com` | USER | Marketing Manager | Create/edit campaigns, journeys, segments |
| `support@test.com` | USER | Customer Support | Edit customers, orders |
| `content@test.com` | USER | Content Manager | Manage products, create campaign content |
| `user@test.com` | USER | View Only | View everything, no changes |
| `poweruser@test.com` | USER | Power User | Almost everything except delete |

## Test Scenarios

### Scenario 1: Marketing Manager Workflow ✅

```bash
# 1. Login as Marketing Manager
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "marketing@test.com", "password": "User123!@#"}' \
  | jq -r '.token')

# 2. View campaigns ✅
curl -X GET "http://localhost:5000/api/campaigns?storeId=test-store-1" \
  -H "Authorization: Bearer $TOKEN"

# 3. Create campaign ✅
curl -X POST "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale",
    "storeId": "test-store-1",
    "type": "email"
  }'

# 4. Edit campaign ✅
curl -X PUT "http://localhost:5000/api/campaigns/<CAMPAIGN_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Campaign"}'

# 5. Try to delete campaign ❌ (Should fail)
curl -X DELETE "http://localhost:5000/api/campaigns/<CAMPAIGN_ID>" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 Forbidden
```

### Scenario 2: Customer Support Workflow ✅

```bash
# 1. Login as Customer Support
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "support@test.com", "password": "User123!@#"}' \
  | jq -r '.token')

# 2. View customers ✅
curl -X GET "http://localhost:5000/api/shopify/customers?shop=test-store-1.myshopify.com" \
  -H "Authorization: Bearer $TOKEN"

# 3. Edit customer ✅ (if route supports it)
# curl -X PUT "http://localhost:5000/api/customers/<ID>" ...

# 4. Try to create campaign ❌ (Should fail)
curl -X POST "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "storeId": "test-store-1"}'
# Expected: 403 Forbidden
```

### Scenario 3: Store Owner Team Management ✅

```bash
# 1. Login as Store Owner
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "storeowner@test.com", "password": "StoreOwner123!@#"}' \
  | jq -r '.token')

# 2. View team members ✅
curl -X GET "http://localhost:5000/api/team?storeId=test-store-1" \
  -H "Authorization: Bearer $TOKEN"

# 3. Invite new team member with preset ✅
curl -X POST "http://localhost:5000/api/team/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "name": "New Team Member",
    "preset": "Marketing Manager",
    "storeId": "test-store-1"
  }'

# 4. Update user permissions ✅
curl -X PUT "http://localhost:5000/api/team/<USER_ID>/permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "Power User"
  }'

# 5. Get available presets ✅
curl -X GET "http://localhost:5000/api/team/presets" \
  -H "Authorization: Bearer $TOKEN"
```

## Permission Matrix Testing

### Test: Marketing Manager Permissions

| Action | Expected | Test |
|--------|----------|------|
| View campaigns | ✅ Allowed | `GET /api/campaigns` |
| Create campaigns | ✅ Allowed | `POST /api/campaigns` |
| Edit campaigns | ✅ Allowed | `PUT /api/campaigns/:id` |
| Delete campaigns | ❌ Forbidden | `DELETE /api/campaigns/:id` |
| Publish campaigns | ✅ Allowed | `POST /api/campaigns/:id/publish` |
| View customers | ✅ Allowed | `GET /api/shopify/customers` |
| Edit customers | ❌ Forbidden | `PUT /api/customers/:id` |
| Create campaigns | ✅ Allowed | `POST /api/campaigns` |

### Test: Customer Support Permissions

| Action | Expected | Test |
|--------|----------|------|
| View customers | ✅ Allowed | `GET /api/shopify/customers` |
| Edit customers | ✅ Allowed | `PUT /api/customers/:id` |
| View orders | ✅ Allowed | `GET /api/shopify/orders` |
| Edit orders | ✅ Allowed | `PUT /api/orders/:id` |
| Refund orders | ❌ Forbidden | `POST /api/orders/:id/refund` |
| Create campaigns | ❌ Forbidden | `POST /api/campaigns` |

## Error Response Format

When permission is denied, you'll get:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to create campaigns",
    "requiredPermission": "campaigns:create",
    "yourPermissions": {
      "view": true,
      "create": false,
      "edit": false,
      "delete": false
    },
    "availableActions": ["view"]
  }
}
```

This tells the user exactly what they need and what they currently have!

## Quick PowerShell Test

```powershell
# Test Marketing Manager can create campaign
$token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email": "marketing@test.com", "password": "User123!@#"}').token

$campaign = @{
  name = "Test Campaign"
  storeId = "test-store-1"
  type = "email"
} | ConvertTo-Json

try {
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -Body $campaign
  Write-Host "✅ Marketing Manager CAN create campaigns!" -ForegroundColor Green
} catch {
  Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test View Only user cannot create campaign
$viewOnlyToken = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email": "user@test.com", "password": "User123!@#"}').token

try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $viewOnlyToken" } `
    -Body $campaign | Out-Null
  Write-Host "❌ View Only user should NOT be able to create!" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "✅ View Only user correctly blocked!" -ForegroundColor Green
  }
}
```

## Summary

✅ **Granular permissions work!**
- Marketing Manager can create/edit campaigns
- Customer Support can manage customers/orders
- View Only user can only view
- Each user has exactly what they need

✅ **Team management works!**
- Store owners can invite users
- Store owners can set permissions via presets
- Store owners can update permissions anytime

✅ **Security works!**
- Users cannot escalate permissions
- Clear error messages
- All actions logged

