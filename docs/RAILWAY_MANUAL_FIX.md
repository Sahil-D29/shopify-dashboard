# Railway Build Timeout - Manual Fix Required (Historical)

> **Note:** This doc referred to the legacy Express backend. The app is now a single Next.js app in `shopify-dashboard/`. Kept for reference only.

## ⚠️ Critical Issue

Railway's Railpack is **auto-detecting** `node server.js` as the build command, ignoring `railway.json`. This requires a **manual fix in Railway Dashboard**.

## 🔧 Immediate Solution (Do This Now)

### Step 1: Go to Railway Dashboard
1. Open your Railway project
2. Click on your **backend service**

### Step 2: Open Settings
1. Click **"Settings"** tab
2. Scroll to **"Build & Deploy"** section

### Step 3: Set Build Command Manually
1. Find **"Build Command"** field
2. **Clear it** or set to: `npm install`
3. **DO NOT** leave it empty if Railway auto-detects `node server.js`

### Step 4: Verify Start Command
1. Find **"Start Command"** field  
2. Should be: `npm start`
3. If empty, set it to: `npm start`

### Step 5: Verify Root Directory
1. Find **"Root Directory"** field
2. Should be: `backend`
3. If empty or wrong, set it to: `backend`

### Step 6: Save and Redeploy
1. Click **"Save"** or changes auto-save
2. Go to **"Deployments"** tab
3. Click **"Redeploy"** on latest deployment

## ✅ What Should Happen

After manual fix, build logs should show:

```
▸ install
$ npm install
✅ Success

▸ build
$ npm install  ✅ (or empty/nothing)
✅ Build complete

Deploy
──────────
$ npm start
🚀 Server running...
```

## ❌ What's Currently Happening (Wrong)

```
▸ build
$ node server.js  ❌ (Auto-detected - WRONG!)
Build timed out...
```

## 📝 Why This Happens

Railway's Railpack auto-detection runs **before** reading `railway.json`. It sees:
- `package.json` has `"main": "server.js"`
- Tries to run it as build command
- Ignores `railway.json` buildCommand setting

## 🎯 Permanent Fix

After manual fix works:
1. The configuration will be saved in Railway
2. Future deployments will use the correct build command
3. You can delete `railway.json` if you want (or keep it for reference)

## 🔍 Verify It Worked

Check build logs - should see:
- ✅ `npm install` in build phase (NOT `node server.js`)
- ✅ Build completes successfully
- ✅ Server starts in deploy phase

---

**Action Required**: Go to Railway Dashboard NOW and set Build Command manually!
