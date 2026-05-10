# 🧪 How to Test Granular Permissions - Step by Step

## 🚀 Quick Start (5 Minutes)

### Step 1: Setup (One Time)

```powershell
# Navigate to backend
cd backend

# Create test users (creates 8 users with different permissions)
node scripts/create-test-users.js

# Start server
npm start
```

**Expected Output:**
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
```

### Step 2: Test Marketing Manager Can Create Campaigns ✅

Open a **new PowerShell window** and run:

```powershell
# 1. Login as Marketing Manager
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "marketing@test.com", "password": "User123!@#"}'

$marketingToken = $response.token
Write-Host "✅ Logged in! Token: $($marketingToken.Substring(0, 20))..." -ForegroundColor Green

# 2. Create a campaign (Marketing Manager CAN do this!)
$campaign = @{
  name = "Summer Sale Campaign"
  storeId = "test-store-1"
  type = "email"
  subject = "Summer Sale - 50% Off!"
} | ConvertTo-Json

try {
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $marketingToken" } `
    -Body $campaign
  
  Write-Host "✅ SUCCESS! Marketing Manager CAN create campaigns!" -ForegroundColor Green
  Write-Host "   Campaign ID: $($result.id)" -ForegroundColor Cyan
} catch {
  Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
```

**Expected Result:** ✅ Success - Campaign created!

### Step 3: Test View Only User Cannot Create Campaigns ❌

```powershell
# 1. Login as View Only User
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email": "user@test.com", "password": "User123!@#"}'

$viewOnlyToken = $response.token

# 2. Try to create campaign (View Only User CANNOT do this!)
$campaign = @{
  name = "Test Campaign"
  storeId = "test-store-1"
  type = "email"
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $viewOnlyToken" } `
    -Body $campaign | Out-Null
  
  Write-Host "❌ FAILED! View Only user should NOT be able to create!" -ForegroundColor Red
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -eq 403) {
    Write-Host "✅ CORRECT! View Only user is blocked (403 Forbidden)" -ForegroundColor Green
    Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
  } else {
    Write-Host "❌ Unexpected error: $statusCode" -ForegroundColor Red
  }
}
```

**Expected Result:** ❌ 403 Forbidden - "You don't have permission to create campaigns"

---

## 📋 Complete Test Scenarios

### Test 1: Marketing Manager Workflow

```powershell
# Login
$token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email": "marketing@test.com", "password": "User123!@#"}').token

Write-Host "`n🧪 Testing Marketing Manager Permissions..." -ForegroundColor Cyan

# Test 1: Can view campaigns ✅
Write-Host "`n1. Testing: View campaigns..." -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns?storeId=test-store-1" `
    -Method GET -Headers @{ "Authorization" = "Bearer $token" }
  Write-Host "   ✅ PASS - Can view campaigns" -ForegroundColor Green
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Can create campaigns ✅
Write-Host "`n2. Testing: Create campaign..." -ForegroundColor Yellow
try {
  $campaign = @{
    name = "Test Campaign $(Get-Date -Format 'HHmmss')"
    storeId = "test-store-1"
    type = "email"
  } | ConvertTo-Json
  
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -Body $campaign
  Write-Host "   ✅ PASS - Can create campaigns" -ForegroundColor Green
  $campaignId = $result.id
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
  $campaignId = $null
}

# Test 3: Can edit campaigns ✅
if ($campaignId) {
  Write-Host "`n3. Testing: Edit campaign..." -ForegroundColor Yellow
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns/$campaignId" `
      -Method PUT -ContentType "application/json" `
      -Headers @{ "Authorization" = "Bearer $token" } `
      -Body '{"name": "Updated Campaign Name"}'
    Write-Host "   ✅ PASS - Can edit campaigns" -ForegroundColor Green
  } catch {
    Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Test 4: Cannot delete campaigns ❌
if ($campaignId) {
  Write-Host "`n4. Testing: Delete campaign (should fail)..." -ForegroundColor Yellow
  try {
    Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns/$campaignId" `
      -Method DELETE -Headers @{ "Authorization" = "Bearer $token" } | Out-Null
    Write-Host "   ❌ FAIL - Should not be able to delete!" -ForegroundColor Red
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
      Write-Host "   ✅ PASS - Correctly blocked from deleting" -ForegroundColor Green
    } else {
      Write-Host "   ❌ FAIL - Wrong error: $statusCode" -ForegroundColor Red
    }
  }
}

Write-Host "`n✅ Marketing Manager tests complete!" -ForegroundColor Green
```

### Test 2: Store Owner Team Management

```powershell
# Login as Store Owner
$token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email": "storeowner@test.com", "password": "StoreOwner123!@#"}').token

Write-Host "`n🧪 Testing Store Owner Team Management..." -ForegroundColor Cyan

# Test 1: View team members ✅
Write-Host "`n1. Testing: View team members..." -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/team?storeId=test-store-1" `
    -Method GET -Headers @{ "Authorization" = "Bearer $token" }
  Write-Host "   ✅ PASS - Can view team" -ForegroundColor Green
  Write-Host "   Team members: $($result.team.Count)" -ForegroundColor Cyan
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Get available presets ✅
Write-Host "`n2. Testing: Get permission presets..." -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/team/presets" `
    -Method GET -Headers @{ "Authorization" = "Bearer $token" }
  Write-Host "   ✅ PASS - Can get presets" -ForegroundColor Green
  Write-Host "   Available presets: $($result.presets.Count)" -ForegroundColor Cyan
  $result.presets | ForEach-Object { Write-Host "     - $($_.name)" -ForegroundColor Gray }
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Invite new team member ✅
Write-Host "`n3. Testing: Invite team member..." -ForegroundColor Yellow
try {
  $invite = @{
    email = "newmember$(Get-Date -Format 'HHmmss')@test.com"
    name = "New Team Member"
    preset = "Marketing Manager"
    storeId = "test-store-1"
  } | ConvertTo-Json
  
  $result = Invoke-RestMethod -Uri "http://localhost:5000/api/team/invite" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -Body $invite
  Write-Host "   ✅ PASS - User invited!" -ForegroundColor Green
  Write-Host "   Temp password: $($result.tempPassword)" -ForegroundColor Cyan
  $newUserId = $result.user.id
} catch {
  Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
  $newUserId = $null
}

# Test 4: Update user permissions ✅
if ($newUserId) {
  Write-Host "`n4. Testing: Update user permissions..." -ForegroundColor Yellow
  try {
    $update = @{
      preset = "Power User"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "http://localhost:5000/api/team/$newUserId/permissions" `
      -Method PUT -ContentType "application/json" `
      -Headers @{ "Authorization" = "Bearer $token" } `
      -Body $update
    Write-Host "   ✅ PASS - Permissions updated!" -ForegroundColor Green
  } catch {
    Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "`n✅ Team management tests complete!" -ForegroundColor Green
```

### Test 3: Compare Different User Permissions

```powershell
Write-Host "`n🧪 Comparing User Permissions..." -ForegroundColor Cyan

# Test users
$users = @(
  @{ email = "user@test.com"; name = "View Only" },
  @{ email = "marketing@test.com"; name = "Marketing Manager" },
  @{ email = "support@test.com"; name = "Customer Support" }
)

foreach ($user in $users) {
  Write-Host "`n📋 Testing: $($user.name)" -ForegroundColor Magenta
  
  # Login
  $token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body "{`"email`": `"$($user.email)`", `"password`": `"User123!@#`"}").token
  
  # Try to create campaign
  $campaign = @{
    name = "Test Campaign"
    storeId = "test-store-1"
    type = "email"
  } | ConvertTo-Json
  
  try {
    Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns" `
      -Method POST -ContentType "application/json" `
      -Headers @{ "Authorization" = "Bearer $token" } `
      -Body $campaign | Out-Null
    Write-Host "   ✅ CAN create campaigns" -ForegroundColor Green
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
      Write-Host "   ❌ CANNOT create campaigns (403 Forbidden)" -ForegroundColor Red
    } else {
      Write-Host "   ⚠️  Error: $statusCode" -ForegroundColor Yellow
    }
  }
}
```

---

## 🎯 Quick Test Script (Copy & Paste)

Save this as `test-permissions.ps1` and run it:

```powershell
# Complete Granular Permissions Test Script
$baseUrl = "http://localhost:5000"

Write-Host "🧪 Granular Permissions Test Suite" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Helper function
function Test-Endpoint {
    param($Method, $Endpoint, $Token, $Body = $null, $ExpectedSuccess = $true)
    
    try {
        $headers = @{ "Authorization" = "Bearer $Token" }
        if ($Body) {
            $result = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method `
                -ContentType "application/json" -Headers $headers -Body ($Body | ConvertTo-Json)
        } else {
            $result = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Headers $headers
        }
        
        if ($ExpectedSuccess) {
            Write-Host "   ✅ PASS" -ForegroundColor Green
            return $result
        } else {
            Write-Host "   ❌ FAIL - Should have been blocked!" -ForegroundColor Red
            return $null
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($ExpectedSuccess) {
            Write-Host "   ❌ FAIL - $statusCode : $($_.Exception.Message)" -ForegroundColor Red
            return $null
        } else {
            if ($statusCode -eq 403) {
                Write-Host "   ✅ PASS - Correctly blocked (403)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Unexpected: $statusCode" -ForegroundColor Yellow
            }
            return $null
        }
    }
}

# 1. Login as Marketing Manager
Write-Host "`n1️⃣ Login as Marketing Manager" -ForegroundColor Magenta
$marketingToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"email": "marketing@test.com", "password": "User123!@#"}').token
Write-Host "   ✅ Logged in" -ForegroundColor Green

# 2. Marketing Manager can create campaign
Write-Host "`n2️⃣ Marketing Manager: Create campaign" -ForegroundColor Magenta
$campaign = @{
    name = "Test Campaign $(Get-Date -Format 'HHmmss')"
    storeId = "test-store-1"
    type = "email"
}
$createdCampaign = Test-Endpoint -Method POST -Endpoint "/api/campaigns" `
    -Token $marketingToken -Body $campaign -ExpectedSuccess $true

# 3. Marketing Manager can edit campaign
if ($createdCampaign) {
    Write-Host "`n3️⃣ Marketing Manager: Edit campaign" -ForegroundColor Magenta
    Test-Endpoint -Method PUT -Endpoint "/api/campaigns/$($createdCampaign.id)" `
        -Token $marketingToken -Body @{ name = "Updated Name" } -ExpectedSuccess $true
}

# 4. Marketing Manager cannot delete campaign
if ($createdCampaign) {
    Write-Host "`n4️⃣ Marketing Manager: Delete campaign (should fail)" -ForegroundColor Magenta
    Test-Endpoint -Method DELETE -Endpoint "/api/campaigns/$($createdCampaign.id)" `
        -Token $marketingToken -ExpectedSuccess $false
}

# 5. View Only user cannot create campaign
Write-Host "`n5️⃣ View Only User: Create campaign (should fail)" -ForegroundColor Magenta
$viewOnlyToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"email": "user@test.com", "password": "User123!@#"}').token
Test-Endpoint -Method POST -Endpoint "/api/campaigns" `
    -Token $viewOnlyToken -Body $campaign -ExpectedSuccess $false

# 6. Store Owner can manage team
Write-Host "`n6️⃣ Store Owner: View team" -ForegroundColor Magenta
$storeOwnerToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"email": "storeowner@test.com", "password": "StoreOwner123!@#"}').token
Test-Endpoint -Method GET -Endpoint "/api/team?storeId=test-store-1" `
    -Token $storeOwnerToken -ExpectedSuccess $true

# 7. Store Owner can get presets
Write-Host "`n7️⃣ Store Owner: Get presets" -ForegroundColor Magenta
Test-Endpoint -Method GET -Endpoint "/api/team/presets" `
    -Token $storeOwnerToken -ExpectedSuccess $true

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ All tests complete!" -ForegroundColor Green
```

**Run it:**
```powershell
.\test-permissions.ps1
```

---

## 📊 Expected Results Summary

| User | Can Create Campaign | Can Edit Campaign | Can Delete Campaign | Can View Campaign |
|------|-------------------|------------------|-------------------|------------------|
| **Marketing Manager** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Customer Support** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **View Only** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Power User** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Store Owner** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🐛 Troubleshooting

### Issue: "User not found"
**Solution:** Run `node scripts/create-test-users.js` first

### Issue: "Invalid token"
**Solution:** Make sure server is running and JWT_SECRET is set in .env

### Issue: "Missing store identifier"
**Solution:** Always provide `storeId` parameter for non-admin users

### Issue: All users can do everything
**Solution:** Check that routes are using `checkPermission()` middleware

---

## ✅ Success Checklist

After running tests, verify:

- [ ] Marketing Manager can create campaigns ✅
- [ ] Marketing Manager cannot delete campaigns ❌
- [ ] View Only user cannot create campaigns ❌
- [ ] Store Owner can view team ✅
- [ ] Store Owner can invite users ✅
- [ ] Store Owner can update permissions ✅
- [ ] Error messages are clear and helpful ✅

**If all checkboxes pass, your granular permissions are working! 🎉**


