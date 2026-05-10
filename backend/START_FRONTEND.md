# 🚀 How to Start the Frontend

## The Issue

You're seeing the **backend API** response (port 5000), but the **frontend** (Next.js) needs to run on **port 3000**.

## Two Servers Needed

1. **Backend Server** (Express) - Port 5000 ✅ Already running
2. **Frontend Server** (Next.js) - Port 3000 ❌ Needs to be started

## Steps to Start Frontend

### 1. Open a NEW Terminal Window

Keep the backend running in one terminal, open a new one for the frontend.

### 2. Navigate to Frontend Directory

```powershell
cd backend\shopify-dashboard
```

### 3. Start the Frontend Server

```powershell
npm run dev
```

### 4. Wait for Server to Start

You should see:
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
- Ready in X seconds
```

### 5. Open in Browser

Go to: **http://localhost:3000** (NOT port 5000!)

## What You Should See

- ✅ Dashboard with statistics
- ✅ Sidebar navigation
- ✅ All pages working (Customers, Orders, Products, etc.)

## Quick Reference

| Service | Port | URL | Status |
|---------|------|-----|--------|
| Backend API | 5000 | http://localhost:5000 | ✅ Running |
| Frontend App | 3000 | http://localhost:3000 | ❌ Need to start |

## Troubleshooting

### "Port 3000 already in use"
```powershell
# Kill process on port 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### "Cannot find module"
```powershell
cd backend\shopify-dashboard
npm install
```

### Frontend shows errors
- Check browser console (F12)
- Make sure backend is still running on port 5000
- Verify `.env.local` file exists in `backend/shopify-dashboard`

