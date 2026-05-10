# Shopify Dashboard - Next.js 14

A complete Shopify dashboard application built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. This dashboard connects to Shopify stores via the Admin REST API and displays real-time data including customers, orders, products, and abandoned carts.

## Features

✅ **Dashboard Page** - Overview with:
- Total Revenue (with growth percentage)
- Total Orders (with growth percentage)
- Total Customers
- Average Order Value (AOV)
- Recent Orders table

✅ **Customers Page** - Full customer list with:
- Name, Email, Phone
- Orders Count
- Total Spent
- Join Date

✅ **Orders Page** - Complete order management with:
- Order details
- Payment status badges (colored)
- Fulfillment status badges (colored)
- Customer information

✅ **Products Page** - Product catalog with:
- Grid layout (responsive)
- Product images
- Price and inventory levels
- Vendor information

✅ **Abandoned Carts Page** - Cart recovery with:
- Customer details
- Cart value
- Time abandoned
- WhatsApp recovery button (placeholder)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Shadcn/ui
- **Icons**: Lucide React
- **API**: Shopify Admin REST API
- **Date Formatting**: date-fns

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend/shopify-dashboard
npm install
```

### 2. Create Environment File

Create a `.env.local` file in the `backend/shopify-dashboard` directory:

```env
SHOPIFY_SHOP_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
SHOPIFY_API_VERSION=2024-01
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
shopify-dashboard/
├── app/
│   ├── layout.tsx              # Root layout with sidebar
│   ├── page.tsx                # Dashboard (home)
│   ├── customers/
│   │   └── page.tsx            # Customers page
│   ├── orders/
│   │   └── page.tsx            # Orders page
│   ├── products/
│   │   └── page.tsx            # Products page
│   ├── abandoned-carts/
│   │   └── page.tsx            # Abandoned carts page
│   └── api/
│       └── shopify/
│           ├── customers/route.ts
│           ├── orders/route.ts
│           ├── products/route.ts
│           ├── abandoned/route.ts
│           └── analytics/route.ts
├── components/
│   ├── ui/                     # Shadcn/ui components
│   ├── layout/
│   │   └── Sidebar.tsx         # Navigation sidebar
│   └── dashboard/
│       └── StatCard.tsx        # Statistics card component
├── lib/
│   ├── shopify/
│   │   └── client.ts           # Shopify API client
│   └── types.ts                # TypeScript interfaces
└── .env.local                  # Environment variables
```

## Available Routes

- `/` - Dashboard (home page)
- `/customers` - Customers list
- `/orders` - Orders list
- `/products` - Products catalog
- `/abandoned-carts` - Abandoned checkouts

## API Endpoints

All API routes are available at `/api/shopify/*`:

- `GET /api/shopify/customers` - Fetch customers (limit: 250)
- `GET /api/shopify/orders` - Fetch orders (limit: 250)
- `GET /api/shopify/products` - Fetch products (limit: 250)
- `GET /api/shopify/abandoned` - Fetch abandoned checkouts (limit: 250)
- `GET /api/shopify/analytics` - Calculate dashboard metrics

## Key Features

### Dashboard Analytics
- Calculates total revenue from all orders
- Computes Average Order Value (AOV)
- Shows growth percentages for revenue and orders
- Displays recent orders table

### Status Badges
- **Payment Status**: Paid (green), Pending (yellow), Refunded (red)
- **Fulfillment Status**: Fulfilled (blue), Unfulfilled (gray), Partial (orange)

### Data Fetching
- Server-side rendering for better performance
- Real-time data from Shopify API
- Error handling and loading states
- Fetches up to 250 items per resource

## Troubleshooting

### Issue: Tailwind CSS not working
**Solution**: The project uses Tailwind CSS v4 with `@tailwindcss/postcss`. This is already configured in `postcss.config.mjs`.

### Issue: API errors (401/403)
**Solution**: 
- Check `.env.local` file exists and has correct credentials
- Verify Shopify access token is valid
- Ensure no extra spaces in environment variables

### Issue: Images not loading
**Solution**: 
- Check `next.config.ts` has Shopify CDN domains configured
- Verify image URLs are from `cdn.shopify.com` or `*.shopifycdn.com`

### Issue: No data showing
**Solution**:
- Verify Shopify store has data (products, customers, orders)
- Check browser console for API errors
- Verify backend API routes are accessible

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Next Steps

Future enhancements:
- [ ] Search and filter functionality
- [ ] Export data to CSV
- [ ] Real-time updates (WebSocket)
- [ ] WhatsApp integration for cart recovery
- [ ] Advanced analytics and charts
- [ ] Multi-store support
- [ ] Authentication and user management

## License

MIT
