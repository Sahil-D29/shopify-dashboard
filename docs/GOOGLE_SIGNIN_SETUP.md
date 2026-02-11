# Google Sign-In Setup

To enable **"Continue with Google"** on the sign-in and sign-up pages:

## 1. Create a Google Cloud project (if you don’t have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.

## 2. Enable the Google+ API (or People API)

1. In the left menu go to **APIs & Services** → **Library**.
2. Search for **Google+ API** or **Google People API** and enable it for your project.

## 3. Create OAuth 2.0 credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. If asked, set the **OAuth consent screen**:
   - User type: **External** (or Internal for workspace-only).
   - App name: e.g. **Shopify Dashboard**.
   - Support email: your email.
   - Save.
4. Application type: **Web application**.
5. Name: e.g. **Shopify Dashboard Web**.
6. **Authorized redirect URIs** – add:
   - Local: `http://localhost:3002/api/auth/callback/google`
   - Production: `https://shopify-dashboard-hm4d.onrender.com/api/auth/callback/google` (or your Render/production URL)
7. Click **Create** and copy the **Client ID** and **Client Secret**.

## 4. Add to `.env.local`

In the `shopify-dashboard` folder, edit `.env.local` and set:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Restart the dev server (`npm run dev`). The **Continue with Google** button will then work on sign-in and sign-up.

## 5. Production (e.g. Render)

- Set **NEXTAUTH_URL** and **NEXT_PUBLIC_APP_URL** to your production URL (e.g. `https://shopify-dashboard-hm4d.onrender.com`).
- Add the production redirect URI in Google Console:  
  `https://shopify-dashboard-hm4d.onrender.com/api/auth/callback/google`
- Also add to **Authorized JavaScript origins**:  
  `https://shopify-dashboard-hm4d.onrender.com`
