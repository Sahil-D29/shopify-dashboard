# 🔍 Complete Project Working Explanation

## 📋 Project Overview

This is a **multi-application Shopify management system** with three main components:

1. **Next.js Dashboard** (Main Application) - Port 3002
2. **Express Backend API** - Port 5000  
3. **Legacy React Frontend** (Unused) - Port 3001

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Requests
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  Next.js App     │         │  Express API     │
│  Port: 3002      │         │  Port: 5000      │
│                  │         │                  │
│  - Dashboard     │◄────────┤  - Shopify API   │
│  - Customers     │         │    Routes        │
│  - Orders        │         │  - Webhooks      │
│  - Products      │         │  - GraphQL       │
│  - Campaigns     │         │    Client        │
│  - Journeys      │         │                  │
│  - Segments      │         │                  │
└──────────────────┘         └────────┬─────────┘
                                      │
                                      │ GraphQL/REST
                                      │
                                      ▼
                              ┌──────────────────┐
                              │  Shopify Store   │
                              │  (External API)  │
                              └──────────────────┘
```

---

## 🎯 Component 1: Next.js Dashboard (Main Application)

**Location**: `backend/shopify-dashboard/`  
**Port**: 3002  
**Framework**: Next.js 16 with TypeScript  
**URL**: http://localhost:3002

### Key Features

#### 1. **Authentication System**
- **NextAuth.js** integration
- User sign-in/sign-up pages
- Admin authentication (separate from user auth)
- Session management via cookies
- Middleware protection for routes

**Files**:
- `app/auth/signin/page.tsx` - User login
- `app/auth/signup/page.tsx` - User registration
- `app/admin/login/page.tsx` - Admin login
- `middleware.ts` - Route protection

#### 2. **Store Configuration**
- Dynamic Shopify store configuration
- Stores credentials in:
  - **Browser localStorage** (for frontend)
  - **File system** (`data/shops.json`) (for backend)
- OAuth flow for Shopify app installation
- Multi-store support

**How it works**:
1. User enters Shopify credentials in Settings page
2. `StoreConfigManager` saves to localStorage
3. Backend reads from `data/shops.json` or environment variables
4. OAuth flow stores access tokens in `data/shops.json`

**Files**:
- `app/settings/page.tsx` - Configuration UI
- `lib/store-config.ts` - Frontend config manager
- `lib/store.ts` - Backend token storage
- `app/api/auth/shopify/route.ts` - OAuth handler

#### 3. **Dashboard Page** (`/`)
- Real-time analytics from Shopify
- Statistics cards:
  - Total Revenue (with growth %)
  - Total Orders (with growth %)
  - Total Customers
  - Average Order Value
- Recent orders table
- Data refresh functionality

**Data Flow**:
```
User visits / → 
  Dashboard fetches from /api/shopify/analytics →
    Next.js API route calls Express backend →
      Express uses Shopify GraphQL API →
        Returns aggregated data →
          Dashboard displays stats
```

**Files**:
- `app/page.tsx` - Main dashboard
- `app/api/shopify/analytics/route.ts` - Analytics API

#### 4. **Customers Management** (`/customers`)
- List all customers from Shopify
- Add new customers
- Export to CSV
- Customer details view

**API Flow**:
```
GET /api/shopify/customers →
  Express backend /api/shopify/customers →
    Shopify GraphQL query →
      Returns customer list
```

**Files**:
- `app/customers/page.tsx` - Customer list
- `app/api/shopify/customers/route.ts` - Customer API
- `backend/routes/shopifyRoutes.js` - Express route

#### 5. **Orders Management** (`/orders`)
- List all orders
- Order details (status, fulfillment, customer)
- Filter and search
- Status badges (Paid, Pending, Refunded)

**Files**:
- `app/orders/page.tsx` - Orders list
- `app/api/shopify/orders/route.ts` - Orders API

#### 6. **Products Management** (`/products`)
- Product catalog grid view
- Product images, prices, inventory
- Variant information
- Vendor and type filtering

**Files**:
- `app/products/page.tsx` - Products list
- `app/api/shopify/products/route.ts` - Products API

#### 7. **Abandoned Carts** (`/abandoned-carts`)
- List abandoned checkouts
- Customer contact information
- Cart value and items
- Recovery actions (WhatsApp integration ready)

**Files**:
- `app/abandoned-carts/page.tsx` - Abandoned carts
- `app/api/shopify/checkouts/route.ts` - Checkouts API

#### 8. **Customer Segments** (`/segments`)
- Create dynamic customer segments
- Filter builder with multiple criteria:
  - Customer attributes (name, email, phone)
  - Order data (total spent, order count)
  - Engagement (marketing opt-in)
- Real-time preview of matching customers
- AND/OR logical operators
- Edit and delete segments

**How it works**:
1. User creates segment with filters
2. Frontend sends segment definition to API
3. API evaluates filters against customer data
4. Returns matching customer count
5. Segment saved (currently in-memory, should use DB)

**Files**:
- `app/segments/page.tsx` - Segments list
- `app/api/segments/route.ts` - Segment CRUD
- `app/api/segments/preview/route.ts` - Preview matching

#### 9. **Campaigns** (`/campaigns`)
- Create and manage marketing campaigns
- Campaign calendar view
- Message templates
- Send campaigns to segments

**Files**:
- `app/campaigns/page.tsx` - Campaigns list
- `app/campaigns/create/page.tsx` - Create campaign
- `app/api/campaigns/route.ts` - Campaign API

#### 10. **Journeys** (`/journeys`)
- Visual journey builder
- Customer journey automation
- Node-based flow editor
- Journey analytics

**Files**:
- `app/journeys/page.tsx` - Journeys list
- `app/journeys/[id]/builder/page.tsx` - Journey builder
- `app/api/journeys/route.ts` - Journey API

#### 11. **Admin Panel** (`/admin`)
- Separate admin authentication
- Store management
- User management
- Analytics and audit logs
- System settings

**Files**:
- `app/admin/page.tsx` - Admin dashboard
- `app/admin/stores/page.tsx` - Store management
- `app/admin/users/page.tsx` - User management

---

## 🔧 Component 2: Express Backend API

**Location**: `backend/`  
**Port**: 5000  
**Framework**: Express.js (ES Modules)  
**URL**: http://localhost:5000

### Purpose
Acts as a **proxy/middleware layer** between Next.js frontend and Shopify API.

### Key Features

#### 1. **Shopify API Routes** (`/api/shopify/*`)

**Products** (`GET /api/shopify/products`)
```javascript
// Flow:
Request → shopifyRoutes.js → 
  createShopifyClient(shop) → 
    Shopify GraphQL query → 
      Transform response → 
        Return JSON
```

**Orders** (`GET /api/shopify/orders`)
- Fetches orders with customer and line items
- Supports limit parameter
- Returns formatted order data

**Customers** (`GET /api/shopify/customers`)
- Fetches customer list with order history
- Includes addresses and contact info

**Analytics** (`GET /api/shopify/analytics`)
- Calculates revenue, orders, customers
- Computes growth percentages
- Aggregates data from orders

**Locations** (`GET /api/shopify/locations`)
- Fetches store locations
- Address and contact information

**Checkouts** (`GET /api/shopify/checkouts`)
- Abandoned checkout data
- Customer and line item details

**Files**:
- `backend/routes/shopifyRoutes.js` - All Shopify routes
- `backend/config/shopify.js` - Shopify client configuration

#### 2. **Webhook Routes** (`/api/webhooks/*`)

**WhatsApp Webhooks** (`/api/webhooks/whatsapp`)
- GET: Webhook verification (Meta/Facebook)
- POST: Receives WhatsApp messages and status updates
- Handles incoming messages
- Processes delivery status

**Files**:
- `backend/routes/webhookRoutes.js` - Webhook handlers

#### 3. **Shopify Client Configuration**

**File**: `backend/config/shopify.js`

**How it works**:
1. Reads session from `data/shops.json` (created by OAuth)
2. Falls back to environment variables if file doesn't exist
3. Creates GraphQL client with access token
4. Returns client for API calls

**Session Storage**:
- Primary: `backend/shopify-dashboard/data/shops.json`
- Format: `{ "shop.myshopify.com": { shop, accessToken, scope } }`
- Fallback: Environment variables

#### 4. **CORS & Security**
- Helmet.js for security headers (disabled in dev)
- CORS enabled for all origins in development
- Content Security Policy disabled for dev

**File**: `backend/server.js`

---

## 🔄 Data Flow Examples

### Example 1: Loading Dashboard

```
1. User opens http://localhost:3002
   ↓
2. Dashboard component mounts
   ↓
3. Calls: GET /api/shopify/analytics?refresh=false
   ↓
4. Next.js API route: app/api/shopify/analytics/route.ts
   ↓
5. Checks cache (in-memory)
   ↓
6. If not cached, calls: http://localhost:5000/api/shopify/analytics?shop=...
   ↓
7. Express route: backend/routes/shopifyRoutes.js
   ↓
8. createShopifyClient() reads from data/shops.json
   ↓
9. Executes GraphQL query to Shopify
   ↓
10. Returns data → Express → Next.js API → Frontend
   ↓
11. Dashboard displays stats
```

### Example 2: Adding a Customer

```
1. User clicks "Add Customer" in /customers
   ↓
2. Modal form opens
   ↓
3. User fills form and submits
   ↓
4. Frontend calls: POST /api/shopify/customers
   ↓
5. Next.js API route processes request
   ↓
6. Calls Express backend: POST http://localhost:5000/api/shopify/customers
   ↓
7. Express creates Shopify GraphQL mutation
   ↓
8. Shopify creates customer
   ↓
9. Success response → Frontend refreshes customer list
```

### Example 3: OAuth Installation Flow

```
1. User visits /install or clicks "Install App"
   ↓
2. GET /api/auth/install
   ↓
3. Generates OAuth URL with:
   - shop parameter
   - scopes
   - redirect_uri
   ↓
4. Redirects to Shopify OAuth page
   ↓
5. User approves permissions
   ↓
6. Shopify redirects to: /api/auth/shopify/callback?code=...
   ↓
7. Backend exchanges code for access token
   ↓
8. Saves to data/shops.json:
   {
     "shop.myshopify.com": {
       "shop": "shop.myshopify.com",
       "accessToken": "shpat_...",
       "scope": "read_products,read_orders,...",
       "installedAt": 1234567890
     }
   }
   ↓
9. Redirects to dashboard
```

---

## 📁 Key File Locations

### Configuration Files
- `backend/.env` - Environment variables (not in repo)
- `backend/shopify-dashboard/.env.local` - Next.js env vars
- `backend/shopify-dashboard/data/shops.json` - OAuth tokens (not in repo)

### Frontend (Next.js)
- `backend/shopify-dashboard/app/` - All pages
- `backend/shopify-dashboard/app/api/` - API routes
- `backend/shopify-dashboard/components/` - React components
- `backend/shopify-dashboard/lib/` - Utilities and helpers

### Backend (Express)
- `backend/server.js` - Express server entry point
- `backend/routes/shopifyRoutes.js` - Shopify API routes
- `backend/routes/webhookRoutes.js` - Webhook handlers
- `backend/config/shopify.js` - Shopify client setup
- `backend/services/shopifyService.js` - Legacy service (unused)

---

## 🔐 Authentication & Authorization

### User Authentication
- **NextAuth.js** handles user sessions
- Session stored in cookies (`next-auth.session-token`)
- Protected routes require authentication
- Middleware checks session before allowing access

### Admin Authentication
- Separate from user auth
- Uses `admin_session` cookie
- JWT-based with `ADMIN_JWT_SECRET`
- Admin routes: `/admin/*`

### Shopify OAuth
- App installation flow
- Stores access tokens in `data/shops.json`
- Supports multiple stores
- Token refresh handled automatically

---

## 💾 Data Storage

### Current Implementation

1. **Shopify Data**: Stored in Shopify (source of truth)
2. **Store Config**: 
   - Frontend: localStorage
   - Backend: `data/shops.json` + environment variables
3. **Segments**: In-memory array (lost on restart) ⚠️
4. **Campaigns**: File-based JSON (likely `data/campaigns.json`)
5. **Users**: Prisma database (if configured)

### Production Recommendations
- Use PostgreSQL/MongoDB for:
  - Segments
  - Campaigns
  - User sessions
  - Audit logs
- Keep Shopify as source of truth for:
  - Products
  - Orders
  - Customers

---

## 🚀 How to Start the Project

### Option 1: Start Everything
```bash
# From project root
npm run start-all
# or
./start-all.ps1  # Windows PowerShell
```

### Option 2: Start Individually

**Terminal 1 - Express Backend**:
```bash
cd backend
npm start
# Runs on http://localhost:5000
```

**Terminal 2 - Next.js Dashboard**:
```bash
cd backend/shopify-dashboard
npm run dev
# Runs on http://localhost:3002
```

---

## 🔌 API Endpoints Summary

### Express Backend (Port 5000)
- `GET /api/shopify/products` - Get products
- `GET /api/shopify/orders` - Get orders
- `GET /api/shopify/customers` - Get customers
- `GET /api/shopify/analytics` - Get analytics
- `GET /api/shopify/locations` - Get locations
- `GET /api/shopify/checkouts` - Get abandoned checkouts
- `GET /api/webhooks/whatsapp` - WhatsApp webhook verification
- `POST /api/webhooks/whatsapp` - WhatsApp webhook receiver
- `GET /health` - Health check

### Next.js API (Port 3002)
- `GET /api/shopify/*` - Proxies to Express backend
- `GET /api/segments` - Get segments
- `POST /api/segments` - Create segment
- `GET /api/campaigns` - Get campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/auth/shopify` - OAuth install
- `GET /api/auth/shopify/callback` - OAuth callback
- `GET /api/health` - Health check

---

## 🎨 Technology Stack

### Frontend (Next.js)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Shadcn/ui (Radix UI)
- **State**: React hooks + Zustand
- **Forms**: React Hook Form
- **Charts**: Chart.js + react-chartjs-2
- **Icons**: Lucide React
- **Auth**: NextAuth.js

### Backend (Express)
- **Framework**: Express.js 5
- **Language**: JavaScript (ES Modules)
- **Shopify SDK**: @shopify/shopify-api
- **Security**: Helmet.js
- **CORS**: cors middleware

### Data & Storage
- **Shopify API**: GraphQL + REST
- **File Storage**: JSON files in `data/` directory
- **Database**: Prisma (configured but may not be active)

---

## 🔄 Real-time Features

### Data Refresh
- Manual refresh buttons on dashboard
- Cache invalidation on webhook events
- In-memory caching for performance
- Cache TTL: 5 minutes (configurable)

### Webhooks
- Shopify webhooks for real-time updates
- WhatsApp webhooks for message delivery
- Cache updates on webhook events

---

## ⚠️ Important Notes

### Development vs Production
- **CSP disabled** in development (Helmet config)
- **CORS open** in development
- **File-based storage** (not suitable for production)
- **In-memory segments** (lost on restart)

### Security Considerations
1. **Environment Variables**: Never commit `.env` files
2. **Access Tokens**: Stored in `data/shops.json` (should be encrypted)
3. **Session Cookies**: Use secure cookies in production
4. **API Keys**: Rotate regularly

### Known Limitations
1. Segments stored in-memory (need database)
2. No user authentication required for some routes
3. File-based token storage (not scalable)
4. Single-instance only (no horizontal scaling)

---

## 📊 Current Status

✅ **Working**:
- Dashboard with real-time data
- Customer/Order/Product management
- OAuth installation flow
- Multi-store support
- Campaign creation
- Journey builder
- Segment creation (UI only)

⚠️ **Needs Improvement**:
- Segment persistence (database)
- Production-ready storage
- Horizontal scaling support
- Enhanced error handling
- Rate limiting

---

## 🎯 Summary

This is a **comprehensive Shopify management platform** with:
- **Next.js dashboard** for user interface
- **Express backend** as API proxy
- **Shopify GraphQL API** for data
- **OAuth flow** for store installation
- **Multi-store support**
- **Campaign and journey automation**
- **Customer segmentation**

The system is **fully functional** for development and can be enhanced for production use with proper database integration and security hardening.

