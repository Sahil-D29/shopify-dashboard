# 🧪 Quick Testing Guide - RBAC System with Granular Permissions

> **See `HOW_TO_TEST_GRANULAR_PERMISSIONS.md` for the most detailed step-by-step testing guide!**

## Step 1: Setup Environment

```bash
# Navigate to backend directory
cd backend

# Copy environment template
cp .env.example .env

# Edit .env file (or use default values for testing)
# At minimum, set:
# JWT_SECRET=your-secret-key-here
```

## Step 2: Install Dependencies (if not already installed)

```bash
npm install bcrypt jsonwebtoken
```

## Step 3: Create Test Users

```bash
# This creates 8 test users with different roles and permission presets
node scripts/create-test-users.js
```

**Output will show:**
```
✅ Created 8 test users:
   - admin@test.com (admin)
   - storeowner@test.com (store_owner)
   - storeowner2@test.com (store_owner)
   - user@test.com (user) - View Only preset
   - marketing@test.com (user) - Marketing Manager preset
   - support@test.com (user) - Customer Support preset
   - content@test.com (user) - Content Manager preset
   - poweruser@test.com (user) - Power User preset

📋 Test User Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN:
  Email: admin@test.com
  Password: Admin123!@#
  Access: All stores
...
```

## Step 4: Start the Server

```bash
npm start
```

Server should start on `http://localhost:5000`

## Step 5: Test Authentication

### 5.1 Login as Admin

**PowerShell:**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "admin@test.com", "password": "Admin123!@#"}'

$adminToken = $response.token
Write-Host "Admin Token: $adminToken"
```

**Bash/curl:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "Admin123!@#"}'
```

**Save the token from the response!**

### 5.2 Login as Store Owner

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "storeowner@test.com", "password": "StoreOwner123!@#"}'

$storeOwnerToken = $response.token
Write-Host "Store Owner Token: $storeOwnerToken"
```

### 5.3 Login as Different Users

```powershell
# View Only User
$userResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "user@test.com", "password": "User123!@#"}'
$userToken = $userResponse.token

# Marketing Manager
$marketingResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "marketing@test.com", "password": "User123!@#"}'
$marketingToken = $marketingResponse.token

# Customer Support
$supportResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "support@test.com", "password": "User123!@#"}'
$supportToken = $supportResponse.token
```

## Step 6: Test RBAC Permissions

### Test 1: Admin Can Access Admin Panel ✅

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $adminToken" }
```

**Expected:** ✅ Success - Returns list of all users

### Test 2: Store Owner Cannot Access Admin Panel ❌

```powershell
try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $storeOwnerToken" }
} catch {
  Write-Host "Expected Error: $($_.Exception.Message)"
}
```

**Expected:** ❌ 403 Forbidden - "This action requires one of: admin"

### Test 3: Admin Can View All Campaigns ✅

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $adminToken" }
```

**Expected:** ✅ Success - Returns all campaigns (or empty array)

### Test 4: Store Owner Can View Own Store Campaigns ✅

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns?storeId=test-store-1" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" }
```

**Expected:** ✅ Success - Returns campaigns for test-store-1

### Test 5: Store Owner Can Create Campaign ✅

```powershell
$campaignData = @{
  name = "Test Campaign"
  storeId = "test-store-1"
  type = "email"
  subject = "Test Email"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" } `
  -Body $campaignData
```

**Expected:** ✅ 201 Created - Campaign created successfully

### Test 6: User Cannot Create Campaign (Default) ❌

```powershell
$campaignData = @{
  name = "Test Campaign"
  storeId = "test-store-1"
  type = "email"
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $userToken" } `
    -Body $campaignData
} catch {
  Write-Host "Expected Error: $($_.Exception.Message)"
}
```

**Expected:** ❌ 403 Forbidden - "You do not have permission to create campaigns"

### Test 7: User Can View Campaigns (Read-Only) ✅

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns?storeId=test-store-1" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $userToken" }
```

**Expected:** ✅ Success - Returns campaigns (read-only access)

### Test 8: User Cannot Edit Campaign ❌

```powershell
# First, get a campaign ID from previous test
$campaignId = "some-campaign-id"

try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns/$campaignId" `
    -Method PUT `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $userToken" } `
    -Body '{"name": "Updated Campaign"}'
} catch {
  Write-Host "Expected Error: $($_.Exception.Message)"
}
```

**Expected:** ❌ 403 Forbidden - "You do not have permission to edit campaigns"

## Step 7: Test Team Management (Store Owner)

### 7.1 View Team Members

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/team?storeId=test-store-1" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" }
```

**Expected**: ✅ Success - Returns list of team members

### 7.2 Invite New Team Member with Preset

```powershell
$inviteData = @{
  email = "newmember@test.com"
  name = "New Team Member"
  preset = "Marketing Manager"
  storeId = "test-store-1"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:5000/api/team/invite" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" } `
  -Body $inviteData

Write-Host "✅ User invited! Temp password: $($result.tempPassword)" -ForegroundColor Green
```

**Expected**: ✅ 201 Created - User invited with Marketing Manager permissions

### 7.3 Update User Permissions

```powershell
$updateData = @{
  preset = "Power User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/team/$($result.user.id)/permissions" `
  -Method PUT `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" } `
  -Body $updateData
```

**Expected**: ✅ Success - Permissions updated

### 7.4 Get Available Presets

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/team/presets" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $storeOwnerToken" }
```

**Expected**: ✅ Success - Returns list of available permission presets

## Step 8: Complete Test Script

Save this as `test-rbac-complete.ps1`:

```powershell
# Complete RBAC Test Script
$baseUrl = "http://localhost:5000"

Write-Host "🧪 RBAC Testing Script" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Step 1: Login as Admin
Write-Host "`n1️⃣ Logging in as Admin..." -ForegroundColor Yellow
$adminLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "admin@test.com", "password": "Admin123!@#"}'
$adminToken = $adminLogin.token
Write-Host "   ✅ Admin logged in" -ForegroundColor Green

# Step 2: Login as Store Owner
Write-Host "`n2️⃣ Logging in as Store Owner..." -ForegroundColor Yellow
$storeOwnerLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "storeowner@test.com", "password": "StoreOwner123!@#"}'
$storeOwnerToken = $storeOwnerLogin.token
Write-Host "   ✅ Store Owner logged in" -ForegroundColor Green

# Step 3: Login as User
Write-Host "`n3️⃣ Logging in as User..." -ForegroundColor Yellow
$userLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "user@test.com", "password": "User123!@#"}'
$userToken = $userLogin.token
Write-Host "   ✅ User logged in" -ForegroundColor Green

# Test 1: Admin can access admin panel
Write-Host "`n📋 Test 1: Admin can access admin panel" -ForegroundColor Magenta
try {
  $result = Invoke-RestMethod -Uri "$baseUrl/api/admin/users" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $adminToken" }
  Write-Host "   ✅ PASS - Admin can access admin panel" -ForegroundColor Green
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Store Owner cannot access admin panel
Write-Host "`n📋 Test 2: Store Owner cannot access admin panel" -ForegroundColor Magenta
try {
  Invoke-RestMethod -Uri "$baseUrl/api/admin/users" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $storeOwnerToken" } | Out-Null
  Write-Host "   ❌ FAIL - Should have been forbidden" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "   ✅ PASS - Store Owner correctly denied access" -ForegroundColor Green
  } else {
    Write-Host "   ❌ FAIL - Wrong error: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Test 3: Store Owner can create campaign
Write-Host "`n📋 Test 3: Store Owner can create campaign" -ForegroundColor Magenta
try {
  $campaignData = @{
    name = "Test Campaign $(Get-Date -Format 'yyyyMMddHHmmss')"
    storeId = "test-store-1"
    type = "email"
    subject = "Test Email"
  } | ConvertTo-Json

  $result = Invoke-RestMethod -Uri "$baseUrl/api/campaigns" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $storeOwnerToken" } `
    -Body $campaignData
  Write-Host "   ✅ PASS - Campaign created: $($result.id)" -ForegroundColor Green
  $campaignId = $result.id
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: User cannot create campaign
Write-Host "`n📋 Test 4: User cannot create campaign" -ForegroundColor Magenta
try {
  $campaignData = @{
    name = "Test Campaign"
    storeId = "test-store-1"
    type = "email"
  } | ConvertTo-Json

  Invoke-RestMethod -Uri "$baseUrl/api/campaigns" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $userToken" } `
    -Body $campaignData | Out-Null
  Write-Host "   ❌ FAIL - Should have been forbidden" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "   ✅ PASS - User correctly denied campaign creation" -ForegroundColor Green
  } else {
    Write-Host "   ❌ FAIL - Wrong error: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Test 5: User can view campaigns (read-only)
Write-Host "`n📋 Test 5: User can view campaigns (read-only)" -ForegroundColor Magenta
try {
  $result = Invoke-RestMethod -Uri "$baseUrl/api/campaigns?storeId=test-store-1" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $userToken" }
  Write-Host "   ✅ PASS - User can view campaigns" -ForegroundColor Green
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Testing Complete!" -ForegroundColor Green
```

Run it:
```powershell
.\test-rbac-complete.ps1
```

## Step 8: Test with Browser (Postman/Thunder Client)

### Using Postman:

1. **Create Collection:**
   - Name: "RBAC Tests"

2. **Add Request: Login Admin**
   - Method: POST
   - URL: `http://localhost:5000/api/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "admin@test.com",
       "password": "Admin123!@#"
     }
     ```
   - Save token from response

3. **Add Request: Get Campaigns (Admin)**
   - Method: GET
   - URL: `http://localhost:5000/api/campaigns`
   - Headers:
     - `Authorization: Bearer {{admin_token}}`
   - Save `admin_token` from login response

4. **Add Request: Create Campaign (Store Owner)**
   - Method: POST
   - URL: `http://localhost:5000/api/campaigns`
   - Headers:
     - `Authorization: Bearer {{store_owner_token}}`
     - `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "name": "Test Campaign",
       "storeId": "test-store-1",
       "type": "email"
     }
     ```

## Step 9: Verify Activity Logs

Check that access denials are logged:

```powershell
# Read activity logs
$logs = Get-Content "backend\data\activity-logs.json" | ConvertFrom-Json
$logs | Where-Object { $_.type -eq "access_denied" } | Select-Object -First 5
```

## Common Issues & Solutions

### Issue: "User not found" on login
**Solution:** Make sure you ran `node scripts/create-test-users.js` first

### Issue: "Invalid token"
**Solution:** 
- Check JWT_SECRET in .env matches
- Make sure token is in format: `Bearer <token>`
- Token might have expired (default: 7 days)

### Issue: "Missing store identifier"
**Solution:** For non-admin users, always provide `storeId` or `shop` parameter

### Issue: "Access denied to this store"
**Solution:** User's `stores` array must include the store ID they're trying to access

## Quick Verification Checklist

- [ ] Server starts without errors
- [ ] Test users created successfully
- [ ] Can login as admin
- [ ] Can login as store owner
- [ ] Can login as user
- [ ] Admin can access `/api/admin/users`
- [ ] Store owner cannot access `/api/admin/users` (403)
- [ ] Store owner can create campaign
- [ ] User cannot create campaign (403)
- [ ] User can view campaigns (read-only)
- [ ] Activity logs are being written

## Next Steps

Once basic tests pass:
1. Test all scenarios from `RBAC_TESTING_GUIDE.md`
2. Test cross-store access blocking
3. Test permission edge cases
4. Verify activity logging works
5. Test with different user combinations

