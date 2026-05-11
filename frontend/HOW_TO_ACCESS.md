# 🌐 How to Access Your Applications

## Three Applications Running

### 1. **Backend API (Express)** - Port 5000
- **URL**: http://localhost:5000
- **Status**: ✅ Running
- **Purpose**: API endpoints for Shopify data
- **Test**: http://localhost:5000/health

### 2. **Frontend Dashboard (Next.js)** - Port 3000  
- **URL**: http://localhost:3000
- **Status**: ✅ Running
- **Purpose**: Main web application (Shopify Dashboard)
- **Features**: Customers, Orders, Products, Journeys, Campaigns

### 3. **React Frontend (Create React App)** - Port 3001
- **URL**: http://localhost:3001 (or check terminal)
- **Status**: Starting...
- **Purpose**: Alternative React frontend
- **Note**: This is a separate React app

## Quick Access

**Main Application (Recommended):**
👉 **http://localhost:3000** - Next.js Dashboard

**API Endpoints:**
👉 **http://localhost:5000** - Backend API
👉 **http://localhost:5000/health** - Health check

**React App (if needed):**
👉 **http://localhost:3001** - Create React App

## Which One to Use?

- **For the main Shopify Dashboard**: Use **http://localhost:3000** (Next.js)
- **For API testing**: Use **http://localhost:5000**
- **For the React app**: Use **http://localhost:3001** (if started)

## Start Commands

```powershell
# Backend (Port 5000)
cd backend
npm run dev

# Next.js Frontend (Port 3000) - MAIN APP
cd backend\shopify-dashboard
npm run dev

# React Frontend (Port 3001) - Alternative
cd frontend
npm start
```

