# Shopify Dashboard - Local Development Guide

This guide walks you through setting up the Shopify dashboard for local development with real Shopify store data.

## Prerequisites

- Node.js 18+ installed
- A Shopify Partner account (free at https://partners.shopify.com)
- A development store (create one in Partner Dashboard)
- ngrok account (free tier works) or localtunnel

## Step 1: Install Dependencies

```bash
npm install
# or
pnpm install
```

## Step 2: Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here

# For direct Admin API access (optional, for testing)
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com

# App URL (will be set to ngrok URL)
APP_URL=https://your-ngrok-url.ngrok.io
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io

# Optional: ngrok auth token for custom domains
NGROK_AUTHTOKEN=your_ngrok_token
```

## Step 3: Set Up Local Tunneling

### Option A: Using ngrok

1. Install ngrok: https://ngrok.com/download
2. Authenticate (optional, for custom domains):
   ```bash
   ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
   ```
3. Start tunnel:
   ```bash
   ngrok http 3002
   ```
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Option B: Using localtunnel

```bash
npx localtunnel --port 3002
```

Copy the provided URL.

## Step 4: Configure Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to **Apps** → **Create app**
3. Choose **Custom app** or **Public app** (for testing, Custom is easier)
4. Set the following URLs:
   - **App URL**: `https://your-ngrok-url.ngrok.io`
   - **Allowed redirection URL(s)**: `https://your-ngrok-url.ngrok.io/api/auth/callback`
   - **Webhook URL**: `https://your-ngrok-url.ngrok.io/api/webhooks`
5. Configure webhook subscriptions:
   - `products/create`
   - `products/update`
   - `orders/create`
   - `orders/updated`
   - `customers/create`
   - `customers/update`
6. Copy your **API Key** and **API Secret** to `.env.local`

## Step 5: Update Environment Variables

Update `.env.local` with your ngrok URL:

```bash
APP_URL=https://your-ngrok-url.ngrok.io
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
```

## Step 6: Start the Development Server

```bash
npm run dev
# or
pnpm dev
```

The app will start on `http://localhost:3002` (or the port specified in `package.json`).

## Step 7: Install the App to Your Store

1. Open your browser and navigate to:
   ```
   https://your-ngrok-url.ngrok.io/api/auth/install?shop=your-store.myshopify.com
   ```
   Replace `your-store` with your actual development store name.

2. You'll be redirected to Shopify's OAuth authorization page
3. Click **Install app**
4. You'll be redirected back to the dashboard

## Step 8: Verify Installation

1. Check that `data/shops.json` was created with your store's access token
2. Visit the dashboard at `https://your-ngrok-url.ngrok.io`
3. You should see real data from your Shopify store

## Step 9: Test Webhooks

1. Create a new product in your Shopify admin
2. Check the terminal logs - you should see:
   ```
   ✅ Webhook received: products/create for your-store.myshopify.com
   ```
3. The dashboard should reflect the new product (or refresh to see it)

## Troubleshooting

### 405 Method Not Allowed Errors

If you see 405 errors:
1. Stop the server (Ctrl+C)
2. Clear Next.js cache:
   ```bash
   rm -rf .next
   # or on Windows:
   Remove-Item -Recurse -Force .next
   ```
3. Restart the server

### Webhooks Not Working

1. Verify ngrok is running and URL is correct
2. Check webhook URL in Shopify Partner Dashboard matches ngrok URL
3. Verify `SHOPIFY_API_SECRET` is set correctly in `.env.local`
4. Check terminal logs for webhook errors

### OAuth Callback Fails

1. Verify `APP_URL` in `.env.local` matches your ngrok URL exactly
2. Check that redirect URL in Partner Dashboard matches: `https://your-ngrok-url.ngrok.io/api/auth/callback`
3. Ensure `SHOPIFY_API_SECRET` is correct

### No Data Showing

1. Verify store is installed: check `data/shops.json` exists
2. Test API endpoint directly: `https://your-ngrok-url.ngrok.io/api/products`
3. Check browser console for errors
4. Verify `SHOPIFY_ADMIN_TOKEN` or OAuth token is valid

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env.local` or `data/shops.json` to git
- The file-based token store is for development only
- In production, use a proper database (PostgreSQL, MongoDB, etc.)
- Always validate HMAC signatures for webhooks and OAuth

## Next Steps

- Replace file-based storage with a database
- Implement proper session management
- Add rate limiting for Shopify API calls
- Set up proper error monitoring
- Configure production deployment

## Support

For issues or questions, check:
- [Shopify API Documentation](https://shopify.dev/docs/api)
- [Next.js Documentation](https://nextjs.org/docs)
- [ngrok Documentation](https://ngrok.com/docs)


