# Campaign Section Testing Guide

## Overview
The campaign section allows you to create, manage, and track WhatsApp marketing campaigns. This guide covers both UI and API testing.

## Server Status
- Base URL: `http://localhost:3000`
- Campaign API: `/api/campaigns`

## 1. UI Testing (Browser-Based)

### Step 1: Access Campaigns Page
1. Open your browser and navigate to: `http://localhost:3000/campaigns`
2. **Expected Result:**
   - You should see the campaigns dashboard
   - If no campaigns exist, you'll see an empty state with "Create Your First Campaign" button
   - If a sample campaign exists, you'll see a "Diwali Flash Sale 2024" campaign card

### Step 2: View Sample Campaign (if exists)
1. The sample campaign "Diwali Flash Sale 2024" should appear automatically
2. **Expected Result:**
   - Campaign card shows:
     - Campaign name
     - Status badge (RUNNING, SCHEDULED, etc.)
     - Metrics (sent, opened, clicked, revenue)
     - Open rate and click rate percentages
   - Stats cards at the top show:
     - Total Campaigns: 1
     - Active Campaigns: 1
     - Messages Sent
     - Revenue Generated
     - Avg Open Rate

### Step 3: Test Filters
1. Use the search box to search for "Diwali"
2. Use the Status filter dropdown - select "RUNNING"
3. Use the Channel filter - select "WhatsApp"
4. **Expected Result:**
   - Search filters campaigns by name
   - Status filter shows only campaigns with selected status
   - Channel filter shows only WhatsApp campaigns

### Step 4: Create a New Campaign
1. Click "Create Campaign" button
2. Navigate to `/campaigns/create`
3. **Expected Result:**
   - Campaign wizard opens with multiple steps
   - You can fill in:
     - Campaign name
     - Description
     - Select segments
     - Message content
     - Schedule type
     - Tags

### Step 5: View Campaign Details
1. Click on a campaign card
2. Navigate to `/campaigns/[id]`
3. **Expected Result:**
   - Detailed campaign view shows:
     - Full campaign information
     - Metrics and analytics
     - Edit/Delete options
     - Send/Pause buttons

### Step 6: Test Calendar View
1. Click "Calendar View" button
2. Navigate to `/campaigns/calendar`
3. **Expected Result:**
   - Calendar view displays scheduled campaigns
   - Shows campaigns by date

## 2. API Testing (Using PowerShell/curl)

### Test 1: Get All Campaigns
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns" -Method GET | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "campaigns": [
    {
      "id": "camp_1",
      "name": "Diwali Flash Sale 2024",
      "status": "RUNNING",
      "metrics": {
        "sent": 2456,
        "delivered": 2398,
        "opened": 1918,
        "clicked": 767,
        "converted": 192,
        "revenue": 234000
      }
    }
  ]
}
```

### Test 2: Create a New Campaign
```powershell
# PowerShell
$body = @{
    name = "Test Campaign 2024"
    description = "This is a test campaign"
    type = "ONE_TIME"
    scheduleType = "IMMEDIATE"
    segmentIds = @()
    estimatedReach = 100
    messageContent = @{
        body = "Hello {{name}}! This is a test message."
    }
    tags = @("test", "demo")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "campaign": {
    "id": "camp_1733...",
    "name": "Test Campaign 2024",
    "status": "RUNNING",
    "channel": "WHATSAPP",
    "metrics": {
      "sent": 0,
      "delivered": 0,
      "opened": 0,
      "clicked": 0,
      "converted": 0,
      "failed": 0,
      "unsubscribed": 0,
      "revenue": 0
    }
  },
  "success": true
}
```

### Test 3: Get Specific Campaign
```powershell
# Replace camp_1 with actual campaign ID
Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns/camp_1" -Method GET | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "campaign": {
    "id": "camp_1",
    "name": "Diwali Flash Sale 2024",
    "status": "RUNNING",
    ...
  }
}
```

### Test 4: Update Campaign
```powershell
# PowerShell
$body = @{
    name = "Updated Campaign Name"
    description = "Updated description"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns/camp_1" -Method PUT -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

### Test 5: Send/Launch Campaign
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns/camp_1/send" -Method POST | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "campaign": {
    "id": "camp_1",
    "status": "RUNNING",
    "startedAt": 1733...
  },
  "success": true,
  "message": "Campaign launched successfully"
}
```

### Test 6: Duplicate Campaign
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns/camp_1/duplicate" -Method POST | ConvertTo-Json -Depth 10
```

### Test 7: Delete Campaign
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/campaigns/camp_1" -Method DELETE | ConvertTo-Json
```

## 3. Quick Test Checklist

### ✅ Basic Functionality
- [ ] Campaigns page loads without errors
- [ ] Sample campaign appears (if initialized)
- [ ] Stats cards display correct numbers
- [ ] Search filter works
- [ ] Status filter works
- [ ] Channel filter works

### ✅ Campaign Creation
- [ ] Create campaign button navigates to create page
- [ ] Campaign wizard opens and allows input
- [ ] Campaign can be created successfully
- [ ] New campaign appears in the list

### ✅ Campaign Management
- [ ] Click on campaign card opens detail page
- [ ] Campaign details page shows all information
- [ ] Edit campaign works
- [ ] Delete campaign works
- [ ] Duplicate campaign works
- [ ] Send/Launch campaign works

### ✅ API Endpoints
- [ ] GET `/api/campaigns` returns campaigns
- [ ] POST `/api/campaigns` creates new campaign
- [ ] GET `/api/campaigns/[id]` returns specific campaign
- [ ] PUT `/api/campaigns/[id]` updates campaign
- [ ] DELETE `/api/campaigns/[id]` deletes campaign
- [ ] POST `/api/campaigns/[id]/send` launches campaign
- [ ] POST `/api/campaigns/[id]/duplicate` duplicates campaign

## 4. Common Issues & Solutions

### Issue: No campaigns showing
**Solution:** The sample campaign should auto-initialize. Check browser console and server logs for errors.

### Issue: Campaign creation fails
**Solution:** 
- Check browser console for errors
- Verify all required fields are filled
- Check server logs for detailed error messages

### Issue: API returns 500 error
**Solution:**
- Check server terminal for error logs
- Verify the server is running on port 3000
- Check network tab in browser DevTools

### Issue: Campaign not updating
**Solution:**
- Campaigns are stored in memory (global variable)
- Server restart will reset campaigns
- This is expected behavior for development

## 5. Testing with Browser DevTools

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to campaigns page
4. Check API calls:
   - `GET /api/campaigns` should return 200
   - Response should contain campaigns array
   - Check for any 404 or 500 errors

## 6. Server Logs

Watch your terminal where the server is running. You should see:
- `📋 Fetching X campaigns` - When campaigns are loaded
- `📝 Creating campaign: [name]` - When creating
- `✅ Campaign created successfully` - When creation succeeds
- `🚀 Campaign [id] launched` - When sending

## 7. Next Steps After Testing

If everything works:
1. Create multiple campaigns with different statuses
2. Test filtering with multiple campaigns
3. Test the calendar view with scheduled campaigns
4. Test campaign metrics and analytics

If issues are found:
1. Check browser console for frontend errors
2. Check server terminal for backend errors
3. Verify API endpoints are responding correctly
4. Check network requests in DevTools

