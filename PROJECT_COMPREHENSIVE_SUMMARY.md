# 📊 Shopify Dashboard - Comprehensive Project Summary

## 🎯 Project Overview

This is a **sophisticated, enterprise-level Shopify Dashboard and WhatsApp Marketing Platform** built with modern web technologies. It serves as a comprehensive **CRM and Marketing Automation System** for Shopify stores, enabling store owners to automate customer communication, manage campaigns, segment customers, and track performance analytics through an intuitive dashboard interface.

**Main Purpose**: Enable Shopify store owners to automate marketing workflows, send targeted WhatsApp messages, manage customer relationships, execute automated customer journeys, and track performance analytics through a unified dashboard.

---

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend: Next.js 16 (TypeScript)               │
│                    Port: 3002 (localhost)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │  Journeys    │  │  Campaigns   │     │
│  │   Analytics  │  │  Builder     │  │  Manager     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Customers   │  │  Segments    │  │  Settings    │     │
│  │  Management  │  │  Builder     │  │  & Config    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│          Backend: Express.js (Node.js)                       │
│                    Port: 5000                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Shopify    │  │  WhatsApp    │  │  Campaign    │     │
│  │   Service    │  │  Service     │  │  Worker      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Journey     │  │  Segment     │  │  Auth        │     │
│  │  Worker      │  │  Service     │  │  Service      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          ↕ API Calls
┌─────────────────────────────────────────────────────────────┐
│              External Services                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Shopify    │  │  WhatsApp    │  │   Stripe    │     │
│  │   Admin API  │  │  Business    │  │   Payment   │     │
│  │              │  │  API         │  │   API       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Frontend (Next.js)** → Makes API calls to Next.js API routes
2. **Next.js API Routes** → Proxy requests to Express backend (port 5000)
3. **Express Backend** → Calls external APIs (Shopify, WhatsApp, Stripe)
4. **Background Workers** → Process campaigns and journeys automatically
5. **File Storage** → JSON files for data persistence (development mode)

---

## 🛠️ Tech Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.0.0 | React framework with App Router |
| **React** | 19.2.0 | UI library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **shadcn/ui** | Latest | Component library (Radix UI based) |
| **TanStack Query** | 5.90.7 | Data fetching and caching |
| **Zustand** | 5.0.8 | State management |
| **React Hook Form** | 7.53.0 | Form handling |
| **Zod** | 4.1.13 | Schema validation |
| **NextAuth.js** | 5.0.0-beta.30 | Authentication |
| **Chart.js / Recharts** | Latest | Data visualization |
| **React Flow** | 12.9.2 | Visual workflow builder |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | Latest LTS | Runtime environment |
| **Express.js** | 5.1.0 | Web framework |
| **@shopify/shopify-api** | 12.1.2 | Shopify API client |
| **Axios** | 1.13.0 | HTTP client |
| **bcrypt** | 6.0.0 | Password hashing |
| **jsonwebtoken** | 9.0.2 | JWT authentication |
| **Stripe** | 17.3.1 | Payment processing |
| **Helmet** | 8.1.0 | Security headers |
| **express-rate-limit** | 7.1.5 | Rate limiting |
| **CORS** | 2.8.5 | Cross-origin resource sharing |

### Data Storage

- **File-based JSON storage** (development):
  - `users.json` - User accounts
  - `teams.json` - Team memberships
  - `campaigns.json` - Campaign data
  - `journeys.json` - Journey definitions
  - `segments.json` - Customer segments
  - `subscriptions.json` - Subscription plans
  - `permissions.json` - User permissions

### External Integrations

- **Shopify Admin REST API** - Product, order, customer data
- **Shopify GraphQL API** - Advanced queries
- **WhatsApp Business API** - Messaging
- **Stripe API** - Payment processing
- **Google OAuth** - Social authentication

---

## ✨ Core Features

### 1. 📊 Dashboard & Analytics

**Location**: `/` (Home page)

**Features**:
- **Real-time Analytics**:
  - Total Revenue with growth percentage
  - Total Orders with growth tracking
  - Total Customers count
  - Average Order Value (AOV)
  - Abandoned cart statistics
- **Live Data Sync**: Auto-refresh every 30 seconds
- **Data Cards**: Products, Orders, Customers, Locations, Checkouts
- **Recent Orders Table**: Latest order details with status badges
- **Connection Status**: Visual indicators for Shopify sync status
- **Revenue Trends**: Time-based revenue visualization
- **Order Growth**: Period-over-period comparisons

### 2. 👥 Customer Management

**Location**: `/customers`

**Features**:
- **Customer List**:
  - Full customer database from Shopify
  - Name, Email, Phone, Address
  - Order count and total spent
  - Join date and customer tags
  - Marketing opt-in status
- **Add Customers**: 
  - Modal form for creating new customers
  - Full address support
  - Marketing preferences
  - Validation and error handling
- **Export to CSV**: 
  - One-click export of all customer data
  - Formatted filenames with timestamps
- **Live Sync**: Real-time updates from Shopify
- **Customer Details**: Individual customer view with order history

### 3. 🎯 Customer Segmentation

**Location**: `/segments`

**Features**:
- **Dynamic Filter Builder**:
  - Multiple filter criteria
  - AND/OR logical operators
  - Real-time preview count
  - Visual filter interface
- **Filter Types Supported**:
  - **Customer Attributes**: First Name, Last Name, Email, Phone, Tags
  - **Order Data**: Total Spent, Number of Orders
  - **Engagement**: Marketing Opt-in status
- **Operators**:
  - Text: equals, contains, starts with, ends with, empty/not empty
  - Numbers: equals, greater than, less than, between
  - Boolean: is true, is false
- **Segment Management**:
  - Create, Edit, Delete segments
  - Preview matching customers
  - Customer count display
  - Segment analytics
  - Compare segments
  - Export segment customers

### 4. 🚀 Automated Customer Journeys

**Location**: `/journeys`

**Features**:
- **Visual Journey Builder**: Drag-and-drop interface for creating workflows
- **Trigger Nodes** (Entry Points):
  - Segment Joined - Customer joins a segment
  - Abandoned Cart - Cart abandonment detected
  - Event Trigger - Custom Shopify events
  - Date/Time - Scheduled triggers
  - Manual Entry - Manual enrollment
- **Action Nodes**:
  - Send WhatsApp Message - Template-based messaging
  - Wait/Delay - Time-based pauses
  - Conditional Logic - IF/THEN branches
  - Goal Tracking - Conversion tracking
- **Delay Nodes**:
  - Fixed time delays (hours, days, weeks)
  - Optimal time sending
  - Quiet hours configuration
  - Holiday calendar support
  - Weekend skipping
- **Condition Nodes**:
  - Audience splits
  - Property-based routing
  - A/B testing variants
- **Goal Nodes**:
  - Conversion tracking
  - Exit conditions
  - Goal attribution
- **Journey Management**:
  - Template library with pre-built journeys
  - Version control and rollback
  - Test mode with specific customers
  - Analytics dashboard
  - Enrollment management
  - Auto-processing engine
  - Re-entry rules

### 5. 📢 Marketing Campaigns

**Location**: `/campaigns`

**Features**:
- **Campaign Types**:
  - One-Time Campaigns - Single send campaigns
  - Recurring Campaigns - Scheduled repeating campaigns
  - Drip Campaigns - Multi-step sequential messaging
  - Trigger-Based - Event-triggered campaigns
- **Campaign Features**:
  - Audience Targeting - Segment-based targeting
  - Message Content - WhatsApp template messages
  - Scheduling - Immediate, Scheduled, or Recurring
  - A/B Testing - Multi-variant testing with winner selection
  - Smart Timing - Send at optimal customer times
  - Rate Limiting - Control sending speed (Fast/Medium/Slow)
- **Metrics Tracking**:
  - Sent, Delivered, Opened, Clicked
  - Conversions and Revenue
  - Failed and Unsubscribed counts
  - Message-level statistics
- **Campaign Management**:
  - Create, Edit, Duplicate campaigns
  - Pause/Resume campaigns
  - Calendar view for scheduled campaigns
  - Campaign analytics dashboard
  - Message statistics per campaign

### 6. 💬 WhatsApp Integration

**Location**: `/settings/whatsapp`

**Features**:
- **Template Management**:
  - Sync templates from WhatsApp Business API
  - Template approval status tracking
  - Template preview and validation
  - Variable mapping
  - Template library
- **Message Sending**:
  - Template-based messages (for 24h+ window)
  - Text messages (within 24h window)
  - Media attachments (Images, Videos, Documents)
  - Button actions (Quick Reply, URL, Phone)
- **Configuration Wizard**:
  - 6-step guided setup
  - Template selection
  - Variable mapping
  - Media configuration
  - Button setup
  - Send window settings
  - Preview & testing
- **WhatsApp Features**:
  - Delivery Reports - Track message delivery status
  - Read Receipts - Track message opens
  - Button Clicks - Track user interactions
  - Inbound Messages - Receive and process customer replies
  - Webhook Integration - Real-time status updates
  - Test Mode - Send test messages to sandbox
  - Rate Limiting - Respect WhatsApp API limits
  - Error Handling - Comprehensive error messages

### 7. ⚙️ Settings & Configuration

**Location**: `/settings`

**Features**:
- **Store Configuration**:
  - Shopify Credentials (Shop URL, Access Token, API Key, API Secret)
  - Connection Testing - Verify credentials before saving
  - Dynamic Configuration - Switch between stores
  - localStorage Persistence - Credentials saved in browser
- **WhatsApp Configuration**:
  - API Credentials (Phone Number ID, Access Token)
  - Template Management - Sync and manage templates
  - Subscription Settings - WhatsApp Business subscription
  - Test Connection - Verify WhatsApp API access
- **Team Management** (`/settings/team`):
  - Add team members by email
  - Role assignment (Admin, Store Owner, User)
  - Permission management
  - Auto-activation flow (pending → active on sign-in)
  - Team member list with status

### 8. 🔐 Authentication & Authorization

**Features**:
- **Authentication Methods**:
  - Email/Password - Bcrypt password hashing, JWT sessions
  - Google OAuth - OAuth 2.0 flow with profile picture
- **Authorization System**:
  - **Role-Based Access Control (RBAC)**:
    - **ADMIN** - Platform owner with full access
    - **STORE_OWNER** - Store owners with access to their own store
    - **USER** - Team members with customizable permissions
  - **Granular Permissions**:
    - Feature-level permissions (campaigns, customers, orders, etc.)
    - Action-level permissions (view, create, edit, delete, publish)
    - Permission presets (Marketing Manager, Customer Support, Content Manager, etc.)
  - **Middleware Protection**: Route-level authentication and authorization
  - **Session Management**: JWT-based sessions with 7-day expiration
  - **File-based Auth**: JSON file storage (development mode)

### 9. 📦 Orders Management

**Location**: `/orders`

**Features**:
- Order list with details
- Order status badges (Paid, Pending, Refunded)
- Fulfillment status tracking
- Customer information per order
- Filter and search functionality
- Order value and item details

### 10. 🛍️ Products Management

**Location**: `/products`

**Features**:
- Product catalog grid view
- Product images, prices, inventory
- Variant information
- Vendor and type filtering
- Product search
- Inventory tracking

### 11. 🛒 Abandoned Carts

**Location**: `/abandoned-carts`

**Features**:
- List abandoned checkouts
- Customer contact information
- Cart value and items
- Time abandoned tracking
- Recovery actions (WhatsApp integration ready)
- Cart recovery campaigns

### 12. 💳 Subscription & Billing

**Features**:
- Subscription plan management
- Stripe integration for payments
- Plan features configuration
- Usage metrics tracking
- Billing history
- Plan upgrade/downgrade

### 13. 📈 Admin Panel

**Location**: `/admin`

**Features**:
- User management
- Store management
- Analytics dashboard
- Audit logs
- System health monitoring
- Activity logs
- Billing management

---

## 🔄 How It Works

### 1. Application Startup

1. **Backend Server** (`backend/server.js`):
   - Starts Express server on port 5000
   - Initializes system health monitoring
   - Starts background workers (Campaign Worker, Journey Worker)
   - Sets up middleware (CORS, Helmet, Rate Limiting)
   - Registers API routes

2. **Frontend Server** (`backend/shopify-dashboard`):
   - Starts Next.js dev server on port 3002
   - Loads environment variables
   - Initializes NextAuth configuration
   - Sets up API routes

### 2. User Authentication Flow

1. User visits `/auth/signin`
2. Can sign in with:
   - Email/Password (credentials provider)
   - Google OAuth (OAuth provider)
3. NextAuth validates credentials:
   - Checks `users.json` for email/password match
   - For OAuth, creates/updates user in `users.json`
   - Auto-activates pending team memberships
4. JWT token generated and stored in cookie
5. User redirected to dashboard

### 3. Data Fetching Flow

1. **Frontend Component** requests data:
   ```typescript
   const { data } = useQuery(['customers'], () => 
     fetch('/api/shopify/customers').then(res => res.json())
   );
   ```

2. **Next.js API Route** (`app/api/shopify/customers/route.ts`):
   - Validates authentication
   - Checks permissions
   - Proxies request to Express backend

3. **Express Backend** (`backend/routes/shopifyRoutes.js`):
   - Validates store access
   - Calls Shopify API using `@shopify/shopify-api`
   - Returns data to Next.js API route

4. **Frontend** receives and displays data

### 4. Campaign Execution Flow

1. **User Creates Campaign**:
   - Selects segment/audience
   - Chooses WhatsApp template
   - Sets schedule and rate limit
   - Saves to `campaigns.json`

2. **Campaign Worker** (`backend/workers/campaignWorker.js`):
   - Polls `campaigns.json` every minute
   - Finds campaigns ready to send
   - Processes campaign queue
   - Sends messages via WhatsApp API
   - Updates campaign status and metrics

3. **Webhook Handler**:
   - Receives WhatsApp delivery status
   - Updates campaign metrics
   - Logs activity

### 5. Journey Execution Flow

1. **User Creates Journey**:
   - Builds visual workflow in Journey Builder
   - Defines triggers, delays, actions
   - Activates journey

2. **Journey Worker** (`backend/workers/journeyWorker.js`):
   - Processes journey enrollments
   - Executes nodes in sequence
   - Handles delays and conditions
   - Sends WhatsApp messages
   - Tracks goal completion

3. **Enrollment Management**:
   - Customers enrolled when trigger fires
   - Progress tracked in `journey-enrollments.json`
   - Customers exit when goal reached or journey ends

### 6. Segment Evaluation Flow

1. **User Creates Segment**:
   - Defines filters (e.g., "Total Spent > $100")
   - Saves segment definition

2. **Segment Preview**:
   - Frontend calls `/api/segments/preview`
   - Backend evaluates filters against all customers
   - Returns matching customer count

3. **Segment Usage**:
   - Segments used in campaigns and journeys
   - Real-time evaluation when needed
   - Customer list cached for performance

### 7. WhatsApp Message Sending Flow

1. **Template Selection**:
   - User selects approved WhatsApp template
   - Maps variables (e.g., `{{customer_name}}`)

2. **Message Preparation**:
   - Variables replaced with actual data
   - Media attachments added if needed
   - Buttons configured

3. **API Call**:
   - POST to WhatsApp Business API
   - Includes phone number, template, variables
   - Returns message ID

4. **Status Tracking**:
   - Webhook receives delivery status
   - Updates campaign/journey metrics
   - Logs in activity logs

---

## 📁 Project Structure

```
Shopify/
├── backend/
│   ├── server.js                    # Express server (port 5000)
│   ├── routes/                      # API route handlers
│   │   ├── authRoutes.js           # Authentication
│   │   ├── shopifyRoutes.js        # Shopify API proxy
│   │   ├── campaignsRoutes.js      # Campaign management
│   │   ├── journeysRoutes.js       # Journey management
│   │   ├── segmentsRoutes.js       # Segment management
│   │   ├── teamRoutes.js           # Team management
│   │   ├── subscriptionsRoutes.js  # Subscription management
│   │   └── ...
│   ├── services/                    # Business logic
│   │   ├── campaignsService.js
│   │   ├── journeysService.js
│   │   ├── segmentsService.js
│   │   ├── shopifyService.js
│   │   └── ...
│   ├── middleware/                  # Express middleware
│   │   ├── auth.js                 # Authentication
│   │   ├── rbac.js                 # Role-based access control
│   │   ├── permissions.js          # Permission checks
│   │   └── rate-limiter.js         # Rate limiting
│   ├── workers/                     # Background workers
│   │   ├── campaignWorker.js       # Campaign processor
│   │   └── journeyWorker.js        # Journey processor
│   ├── config/                      # Configuration files
│   │   ├── shopify.js              # Shopify API config
│   │   ├── roles.config.js         # Role definitions
│   │   └── permissions.config.js   # Permission definitions
│   ├── data/                        # JSON data files
│   │   ├── users.json              # User accounts
│   │   ├── teams.json              # Team memberships
│   │   ├── campaigns.json          # Campaign data
│   │   ├── journeys.json           # Journey definitions
│   │   └── ...
│   └── shopify-dashboard/           # MAIN FRONTEND APP
│       ├── app/                     # Next.js App Router
│       │   ├── page.tsx            # Dashboard home
│       │   ├── layout.tsx          # Root layout
│       │   ├── customers/          # Customer pages
│       │   ├── orders/             # Orders pages
│       │   ├── products/           # Products pages
│       │   ├── segments/           # Segments pages
│       │   ├── campaigns/          # Campaigns pages
│       │   ├── journeys/           # Journeys pages
│       │   ├── settings/           # Settings pages
│       │   ├── auth/               # Auth pages
│       │   └── api/                # API routes
│       │       ├── shopify/        # Shopify API proxies
│       │       ├── whatsapp/       # WhatsApp API
│       │       ├── journeys/       # Journey engine
│       │       ├── campaigns/      # Campaign engine
│       │       └── segments/       # Segment API
│       ├── components/             # React components
│       │   ├── ui/                 # Shadcn/ui components
│       │   ├── journeys/           # Journey builder components
│       │   ├── campaigns/          # Campaign components
│       │   ├── customers/          # Customer components
│       │   └── segments/           # Segment components
│       ├── lib/                    # Core libraries
│       │   ├── auth.ts             # NextAuth config
│       │   ├── shopify/            # Shopify client
│       │   └── types.ts            # TypeScript types
│       └── data/                    # Frontend data files
│           └── shops.json          # Shopify store sessions
└── frontend/                        # OLD/UNUSED React app (can ignore)
```

---

## 🔒 Security Features

1. **Authentication**:
   - JWT-based sessions
   - Bcrypt password hashing
   - Secure cookie configuration
   - OAuth 2.0 for Google sign-in

2. **Authorization**:
   - Role-based access control (RBAC)
   - Granular permissions
   - Store-level access control
   - Middleware protection on all routes

3. **Security Headers**:
   - Helmet.js for security headers
   - CORS configuration
   - Rate limiting
   - Input validation

4. **Data Protection**:
   - Environment variables for secrets
   - Secure file storage
   - Input sanitization
   - SQL injection prevention (file-based, but prepared for DB)

---

## 🚀 Deployment Architecture

### Development Mode:
- **Frontend**: Next.js dev server (port 3002)
- **Backend**: Express server (port 5000)
- **Storage**: JSON files in `backend/data/`
- **Auth**: File-based user storage

### Production Considerations:
- Database migration (PostgreSQL/MongoDB recommended)
- Redis for caching and sessions
- Background job queue (Bull/BullMQ)
- CDN for static assets
- Environment-specific configurations
- Monitoring and logging (Sentry, LogRocket)
- Docker containerization

---

## 📊 Key Metrics & Monitoring

- **System Health**: Server uptime, worker status, Shopify token validity
- **Campaign Metrics**: Sent, delivered, opened, clicked, conversions
- **Journey Metrics**: Enrollments, completions, drop-offs
- **Usage Metrics**: API calls, message sends, storage usage
- **Activity Logs**: User actions, system events, errors

---

## 🎓 Key Technologies & Patterns

### Frontend Patterns:
- **Server Components**: Next.js App Router with Server Components
- **Client Components**: Interactive UI with React hooks
- **API Routes**: Next.js API routes as backend proxy
- **State Management**: Zustand for global state, React Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: shadcn/ui (Radix UI primitives)

### Backend Patterns:
- **RESTful API**: Express.js routes
- **Service Layer**: Business logic separation
- **Worker Pattern**: Background job processing
- **Middleware Chain**: Authentication → Authorization → Handler
- **File-based Storage**: JSON files for development (easily migratable to DB)

### Integration Patterns:
- **API Proxy**: Next.js API routes proxy to Express backend
- **Webhook Handling**: Real-time event processing
- **Polling Workers**: Scheduled background jobs
- **Event-driven**: Journey triggers and campaign execution

---

## 📝 Summary

This is a **production-ready, enterprise-level Shopify Dashboard and Marketing Automation Platform** with:

✅ **Complete Feature Set**: Dashboard, Customers, Orders, Products, Segments, Campaigns, Journeys, WhatsApp Integration
✅ **Modern Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Express.js
✅ **Robust Authentication**: Email/Password + Google OAuth with RBAC
✅ **Automation Engine**: Background workers for campaigns and journeys
✅ **WhatsApp Integration**: Full WhatsApp Business API integration
✅ **Scalable Architecture**: Service layer, worker pattern, middleware chain
✅ **Security**: JWT auth, RBAC, rate limiting, input validation
✅ **Developer Experience**: TypeScript, ESLint, comprehensive error handling

The application is designed to scale from development (file-based storage) to production (database-backed) with minimal changes, making it suitable for both MVP and enterprise deployments.


