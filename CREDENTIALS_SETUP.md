# Credentials Setup Guide

## ⚠️ IMPORTANT: Create these files manually (they are gitignored for security)

---

## 1. Create `backend/shopify-dashboard/.env.local`

Create a new file at `backend/shopify-dashboard/.env.local` with the following contents (replace all placeholder values with your real credentials, which should **never** be committed):

```env
# ===========================================
# DATABASE (Neon PostgreSQL)
# ===========================================
DATABASE_URL="YOUR_NEON_DATABASE_URL"

# ===========================================
# AUTHENTICATION
# ===========================================
NEXTAUTH_URL="http://localhost:3002"
NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET
NODE_ENV=development

# ===========================================
# SHOPIFY CONFIGURATION
# ===========================================
SHOPIFY_STORE_URL=YOUR_SHOPIFY_STORE_URL
SHOPIFY_SHOP_URL=YOUR_SHOPIFY_SHOP_URL
SHOPIFY_STORE_DOMAIN=YOUR_SHOPIFY_STORE_DOMAIN
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET
SHOPIFY_API_VERSION=2024-10

# ===========================================
# META / WHATSAPP CONFIGURATION
# ===========================================
WHATSAPP_PHONE_NUMBER_ID=YOUR_WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN
META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET
META_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN

# ===========================================
# APP URLS (Update with ngrok for webhooks)
# ===========================================
APP_URL=http://localhost:3002
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_BASE_URL=http://localhost:3002
```

---

## 2. Create `backend/.env`

Create a new file at `backend/.env` with the following contents (again, use your own secure values):

```env
# ===========================================
# SHOPIFY CONFIGURATION
# ===========================================
SHOPIFY_STORE_URL=YOUR_SHOPIFY_STORE_URL
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET
SHOPIFY_API_VERSION=2024-10

# ===========================================
# META / WHATSAPP CONFIGURATION
# ===========================================
WHATSAPP_PHONE_NUMBER_ID=YOUR_WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN
META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET

# ===========================================
# SERVER CONFIGURATION
# ===========================================
HOST=localhost:5000
PORT=5000
NODE_ENV=development
```

---

## 3. Quick Setup Commands (PowerShell)

Run these commands in PowerShell to create the files (remember to substitute your own secret values before running in a real environment):

```powershell
# Navigate to project root
cd C:\Users\asus\Desktop\Shopify

# Create backend/.env
@"
# SHOPIFY CONFIGURATION
SHOPIFY_STORE_URL=YOUR_SHOPIFY_STORE_URL
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET
SHOPIFY_API_VERSION=2024-10

# META / WHATSAPP CONFIGURATION
WHATSAPP_PHONE_NUMBER_ID=YOUR_WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN
META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET

# SERVER CONFIGURATION
HOST=localhost:5000
PORT=5000
NODE_ENV=development
"@ | Out-File -FilePath "backend\.env" -Encoding UTF8

# Create backend/shopify-dashboard/.env.local
@"
# AUTHENTICATION
NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET
NODE_ENV=development

# SHOPIFY CONFIGURATION
SHOPIFY_STORE_URL=YOUR_SHOPIFY_STORE_URL
SHOPIFY_SHOP_URL=YOUR_SHOPIFY_SHOP_URL
SHOPIFY_STORE_DOMAIN=YOUR_SHOPIFY_STORE_DOMAIN
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET
SHOPIFY_API_VERSION=2024-10

# META / WHATSAPP CONFIGURATION
WHATSAPP_PHONE_NUMBER_ID=YOUR_WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN
META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET
META_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN

# APP URLS
APP_URL=http://localhost:3002
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_BASE_URL=http://localhost:3002
"@ | Out-File -FilePath "backend\shopify-dashboard\.env.local" -Encoding UTF8

Write-Host "✅ Environment files created successfully!"
```

---

## 4. Verification

After creating the files, verify the setup:

1. **Test Shopify Connection:**
   ```bash
   cd backend/shopify-dashboard
   npm run dev
   # Navigate to http://localhost:3002/api/shopify/test-connection
   ```

2. **Test WhatsApp Connection:**
   ```bash
   # Navigate to http://localhost:3002/api/whatsapp/debug-env
   ```

---

## 5. Credentials Reference

| Service | Variable | Description |
|---------|----------|-------------|
| **Shopify** | SHOPIFY_STORE_URL | sai-laxmi-dev.myshopify.com |
| **Shopify** | SHOPIFY_ACCESS_TOKEN | Admin API access token (shpat_...) |
| **Shopify** | SHOPIFY_API_KEY | App API key |
| **Shopify** | SHOPIFY_API_SECRET | App API secret (shpss_...) |
| **WhatsApp** | WHATSAPP_PHONE_NUMBER_ID | 901548389701354 |
| **WhatsApp** | WHATSAPP_BUSINESS_ACCOUNT_ID | 854321680362580 |
| **WhatsApp** | WHATSAPP_ACCESS_TOKEN | Permanent access token (EAA...) |
| **Meta** | META_APP_ID | 2044883972927043 |
| **Meta** | META_APP_SECRET | App secret key |

---

## ⚠️ Security Notes

- **NEVER** commit `.env` or `.env.local` files to git
- These files should be in your `.gitignore`
- For production, use environment variables from your hosting provider
- Rotate tokens periodically for security

