# 🔄 Port Changed to 3002

## Issue
Port 3000 was already occupied by another process.

## Solution
Changed Next.js app to run on **port 3002**.

## New Ports

| Application | Port | URL |
|------------|------|-----|
| Backend API | 5000 | http://localhost:5000 |
| Next.js Dashboard | 3002 | http://localhost:3002 |

## Start the Application

```powershell
cd backend\shopify-dashboard
npm run dev
```

Then open: **http://localhost:3002**

