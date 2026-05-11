# Setup Guide - Shopify Dashboard

## Quick Start

### Step 1: Navigate to Project Directory

```powershell
cd backend\shopify-dashboard
```

### Step 2: Install Dependencies (if not already installed)

```powershell
npm install
```

### Step 3: Create Environment File

Create a file named `.env.local` in the `backend\shopify-dashboard` directory with this content:

```env
SHOPIFY_SHOP_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
SHOPIFY_API_VERSION=2024-01
```

**PowerShell Command to create the file:**
```powershell
@"
SHOPIFY_SHOP_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
SHOPIFY_API_VERSION=2024-01
"@ | Out-File -FilePath .env.local -Encoding utf8
```

### Step 4: Run the Application

```powershell
npm run dev
```

### Step 5: Open in Browser

The application will automatically open at: `http://localhost:3000`

## What You Should See

✅ **Dashboard Page** (`/`) - Shows:
- Total Revenue card
- Total Orders card
- Total Customers card
- Average Order Value card
- Recent Orders table

✅ **Navigation Sidebar** - Links to:
- Dashboard
- Customers
- Orders
- Products
- Abandoned Carts

✅ **All Pages Working** - Each page displays real data from your Shopify store

## Testing Checklist

- [ ] Application starts without errors
- [ ] Dashboard shows statistics cards with data
- [ ] Can navigate between all pages using sidebar
- [ ] Customers page displays customer list
- [ ] Orders page shows orders with status badges
- [ ] Products page shows product grid with images
- [ ] Abandoned Carts page displays abandoned checkouts
- [ ] No console errors in browser (F12)

## Troubleshooting

### Error: "Cannot find module"
**Fix**: Run `npm install` again

### Error: "Shopify API Error: 401"
**Fix**: Check `.env.local` file has correct access token

### Error: "Module not found"
**Fix**: Make sure you're in `backend\shopify-dashboard` directory

### No data showing
**Fix**: 
- Verify Shopify store has data
- Check browser console for API errors
- Test API endpoint: http://localhost:3000/api/shopify/products

## Project Location

The complete Next.js application is located at:
```
C:\Users\asus\Desktop\Shopify\backend\shopify-dashboard\
```

## Next Steps

Once running, you can:
1. View dashboard metrics
2. Browse customers, orders, and products
3. See abandoned carts that need recovery
4. Test all navigation between pages

## Notes

- This is a **single Next.js application** (no separate backend/frontend)
- Runs on **port 3000** only
- Uses **Server Components** for better performance
- All API calls are handled via Next.js API routes
- Tailwind CSS v4 is properly configured

