# 🚀 Quick Start Guide - Fix ngrok Offline Error

## The Error
If you see `ERR_NGROK_3200: The endpoint is offline`, it means either:
1. Next.js server is not running on port 3002
2. ngrok tunnel is not running
3. You're using a placeholder URL instead of the actual ngrok URL

## ✅ Step-by-Step Fix

### Step 1: Start Next.js Server

Open a **new terminal** and run:

```powershell
cd backend\shopify-dashboard
npm run dev
```

Wait until you see:
```
✓ Ready in X seconds
○ Local:        http://localhost:3002
```

**Keep this terminal open!**

### Step 2: Start ngrok Tunnel

Open **another new terminal** and run:

```powershell
ngrok http 3002
```

You should see:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3002
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

**Keep this terminal open too!**

### Step 3: Update Environment Variables

1. Create or edit `.env.local` in `backend/shopify-dashboard/`:

```bash
SHOPIFY_API_KEY=your_actual_api_key
SHOPIFY_API_SECRET=your_actual_api_secret
APP_URL=https://abc123.ngrok.io
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

**Replace `abc123.ngrok.io` with your actual ngrok URL!**

2. Restart the Next.js server (Ctrl+C, then `npm run dev` again)

### Step 4: Test the Install URL

Use the **actual ngrok URL** in your browser:

```
https://abc123.ngrok.io/api/auth/install?shop=sai-laxmi-dev.myshopify.com
```

**NOT** `your-ngrok-url.ngrok.io` - use the real URL from ngrok!

## 🔍 Troubleshooting

### Check if Server is Running

```powershell
# Check if port 3002 is in use
netstat -ano | findstr ":3002"
```

If nothing shows, the server is not running.

### Check if ngrok is Running

```powershell
# Check ngrok process
Get-Process -Name ngrok -ErrorAction SilentlyContinue
```

If nothing shows, ngrok is not running.

### Common Issues

1. **"Port 3002 already in use"**
   - Kill the process: `Get-Process -Name node | Stop-Process -Force`
   - Or change port in `package.json`: `"dev": "next dev -p 3003"`

2. **"ngrok not found"**
   - Install ngrok: https://ngrok.com/download
   - Or use: `npx localtunnel --port 3002`

3. **"Still showing offline"**
   - Make sure BOTH terminals are running (Next.js AND ngrok)
   - Wait 10-15 seconds after starting both
   - Check the ngrok URL matches your `.env.local`

## ✅ Verification

1. ✅ Next.js running on `http://localhost:3002`
2. ✅ ngrok forwarding to port 3002
3. ✅ `.env.local` has correct ngrok URL
4. ✅ Using actual ngrok URL (not placeholder)

Once all are ✅, the install URL should work!


