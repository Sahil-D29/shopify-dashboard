# 🚀 Complete Startup Guide

This project consists of **THREE applications** that need to be started separately.

---

## 📋 Overview

| Application | Location | Port | URL | Purpose |
|------------|----------|------|-----|---------|
| **Backend API** | `backend/` | 5000 | http://localhost:5000 | Express server (Shopify API proxy) |
| **Frontend** (React) | `frontend/` | 3001 | http://localhost:3001 | React dashboard |
| **Shopify Dashboard** (Next.js) | `backend/shopify-dashboard/` | 3002 | http://localhost:3002 | Next.js dashboard (recommended) |

---

## 🎯 Quick Start (Recommended)

### **Option 1: Shopify Dashboard (Next.js) - RECOMMENDED** ⭐

This is the **main application** with the most features (Campaigns, Journeys, Segments, etc.)

#### Step 1: Start Backend Server
Open **Terminal 1** (PowerShell):
```powershell
cd backend
npm install  # If not already installed
npm start
```

Wait until you see:
```
🚀 Server running on port 5000
```

#### Step 2: Start Shopify Dashboard
Open **Terminal 2** (PowerShell):
```powershell
cd backend\shopify-dashboard
npm install  # If not already installed
npm run dev
```

Wait until you see:
```
○ Local:        http://localhost:3002
✓ Ready in X seconds
```

#### Step 3: Access the Application
Open your browser and go to:
- **Main Dashboard**: http://localhost:3002

---

### **Option 2: React Frontend**

If you want to use the React frontend instead:

#### Step 1: Start Backend Server
Open **Terminal 1**:
```powershell
cd backend
npm install
npm start
```

#### Step 2: Start React Frontend
Open **Terminal 2**:
```powershell
cd frontend
npm install
npm start
```

The browser will automatically open to **http://localhost:3001**

---

## 📝 Prerequisites

### 1. Backend Environment File

Create a `.env` file in the `backend/` directory:

```env
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
PORT=5000
```

### 2. Shopify Dashboard Environment (Optional)

If you need it, create a `.env.local` file in `backend/shopify-dashboard/`:

```env
SHOPIFY_SHOP_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
SHOPIFY_API_VERSION=2024-01
```

---

## 🔍 Access Points

### Backend API
- **Health Check**: http://localhost:5000/health
- **API Base**: http://localhost:5000/api/shopify/
- **Endpoints**:
  - `/api/shopify/products`
  - `/api/shopify/customers`
  - `/api/shopify/orders`
  - `/api/shopify/abandoned`

### Shopify Dashboard (Next.js) - Recommended
- **Main Dashboard**: http://localhost:3002
- **Pages Available**:
  - `/` - Dashboard
  - `/customers` - Customer management
  - `/orders` - Order management
  - `/products` - Product catalog
  - `/abandoned-carts` - Abandoned carts
  - `/campaigns` - Campaign management
  - `/journeys` - Customer journeys
  - `/segments` - Customer segments
  - `/templates` - Message templates
  - `/settings` - Configuration

### React Frontend
- **Main Dashboard**: http://localhost:3001

---

## ⚙️ Running All Three (Full Stack)

If you want to run everything at once, you need **THREE terminals**:

### Terminal 1: Backend API
```powershell
cd backend
npm start
```
✅ Server running on port 5000

### Terminal 2: Next.js Dashboard
```powershell
cd backend\shopify-dashboard
npm run dev
```
✅ Dashboard running on port 3002

### Terminal 3: React Frontend (Optional)
```powershell
cd frontend
npm start
```
✅ Frontend running on port 3001

---

## 🛠️ Troubleshooting

### Port Already in Use

#### Kill process on port 5000:
```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

#### Kill process on port 3002:
```powershell
Get-NetTCPConnection -LocalPort 3002 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

#### Kill process on port 3001:
```powershell
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Module Not Found
```powershell
# Install dependencies
cd backend
npm install

cd ..\backend\shopify-dashboard
npm install

cd ..\..\frontend
npm install
```

### Backend Not Starting
1. Check if `.env` file exists in `backend/` directory
2. Verify all required environment variables are set
3. Check that port 5000 is not in use

### Frontend Can't Connect to Backend
1. Make sure backend is running on port 5000
2. Check browser console for CORS errors
3. Verify backend health: http://localhost:5000/health

---

## 📚 Summary

**For most users, you only need to run:**
1. Backend API (port 5000)
2. Shopify Dashboard (port 3002)

**Access at:** http://localhost:3002

The React frontend (port 3001) is optional and less feature-rich than the Next.js dashboard.

---

## ✅ Quick Command Reference

### Start Everything (3 separate terminals):
```powershell
# Terminal 1
cd backend && npm start

# Terminal 2  
cd backend\shopify-dashboard && npm run dev

# Terminal 3 (Optional)
cd frontend && npm start
```

### Minimal Setup (Recommended):
```powershell
# Terminal 1
cd backend && npm start

# Terminal 2
cd backend\shopify-dashboard && npm run dev
```

Then access: **http://localhost:3002** 🎉

