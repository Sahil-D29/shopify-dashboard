# Facebook Login Implementation Guide

## ✅ Implementation Complete!

Facebook OAuth login has been successfully integrated into your Shopify Dashboard.

---

## Step 1: Create Facebook App & Get Credentials

### 1.1 Create Facebook App
1. Go to: https://developers.facebook.com/
2. Click **"My Apps"** → **"Create App"**
3. Select **"Consumer"** or **"Business"** type
4. Fill in:
   - **App Name:** `Shopify Dashboard`
   - **App Contact Email:** Your email
   - **App Purpose:** Business

### 1.2 Add Facebook Login Product
1. In app dashboard: **Products** → **Add Product** → **Facebook Login** → **Set Up**

### 1.3 Configure OAuth Redirect URIs
1. Go to **Products** → **Facebook Login** → **Settings**
2. Add **Valid OAuth Redirect URIs**:
   ```
   http://localhost:3002/api/auth/callback/facebook
   https://yourdomain.com/api/auth/callback/facebook
   ```

### 1.4 Get Credentials
1. Go to **Settings** → **Basic**
2. Copy **App ID** (this is your `FACEBOOK_CLIENT_ID`)
3. Click **Show** next to App Secret → Copy **App Secret** (this is your `FACEBOOK_CLIENT_SECRET`)

---

## Step 2: Add Environment Variables

**File: `.env.local`** (in `backend/shopify-dashboard/`)

```env
# Facebook OAuth (ADD THESE)
FACEBOOK_CLIENT_ID=your-facebook-app-id-here
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret-here

# Existing (should already exist)
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3002
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**⚠️ Important:** 
- Never commit `.env.local` to git
- Restart dev server after adding variables

---

## Step 3: Test Facebook Login

1. **Start server:**
   ```bash
   cd backend/shopify-dashboard
   npm run dev
   ```

2. **Go to:** `http://localhost:3002/auth/signin`

3. **Click:** "Continue with Facebook"

4. **Authorize** the app on Facebook

5. **You'll be redirected back and signed in!** ✅

---

## How It Works

1. User clicks "Continue with Facebook"
2. Redirects to Facebook → User authorizes
3. Facebook redirects back with code
4. System creates/finds user in database
5. Checks team management (auto-activates if pending)
6. User signed in → Redirects to dashboard

---

## Troubleshooting

### "Redirect URI Mismatch"
- Ensure callback URL in Facebook app matches exactly:
  ```
  http://localhost:3002/api/auth/callback/facebook
  ```
- No trailing slashes, correct HTTP/HTTPS

### "App Not Set Up"
- App must be in **Development** mode for testing
- Add yourself as test user in **Roles** → **Test Users**

### "Invalid Credentials"
- Verify `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` in `.env.local`
- Restart dev server after adding env variables

---

## Production Setup

1. Add production redirect URI in Facebook app:
   ```
   https://yourdomain.com/api/auth/callback/facebook
   ```

2. Update production `.env`:
   ```env
   FACEBOOK_CLIENT_ID=production-app-id
   FACEBOOK_CLIENT_SECRET=production-app-secret
   NEXTAUTH_URL=https://yourdomain.com
   ```

3. Switch Facebook app to **Live** mode

---

## Features Implemented

✅ Full OAuth flow with Facebook
✅ Auto user creation on first sign-in
✅ Team management integration (auto-activates pending users)
✅ Loading states and error handling
✅ Professional error page
✅ Session management

---

**Ready to use! Just add your Facebook credentials to `.env.local` 🚀**



