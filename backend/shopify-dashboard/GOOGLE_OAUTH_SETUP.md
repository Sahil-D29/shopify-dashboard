# Google OAuth Sign-In Setup Guide

## ✅ Implementation Complete

All the required files have been created/updated for Google OAuth authentication with NextAuth.

## 🔧 Manual Step Required: Create .env.local

You need to manually create the `.env.local` file in the `backend/shopify-dashboard` directory with the following contents (replace the placeholder values with your real credentials, which should **not** be committed to git):

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=YOUR_GENERATED_NEXTAUTH_SECRET
```

### Create the file using PowerShell:

```powershell
cd backend/shopify-dashboard

# Create the .env.local file (fill in your own secure values)
@"
# Google OAuth Credentials
GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=YOUR_GENERATED_NEXTAUTH_SECRET
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
```

## 🔑 Google Cloud Console Configuration

Make sure your Google Cloud Console OAuth 2.0 credentials have:

1. **Authorized JavaScript origins:**
   - `http://localhost:3002`

2. **Authorized redirect URIs:**
   - `http://localhost:3002/api/auth/callback/google`

## 📁 Files Created/Modified

### New Files:
- `lib/auth.ts` - NextAuth configuration with Google & Credentials providers
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API route handler
- `types/next-auth.d.ts` - TypeScript definitions for NextAuth
- `components/providers/SessionProvider.tsx` - Session context provider
- `components/auth/LogoutButton.tsx` - Reusable logout button component
- `components/auth/UserStats.tsx` - User statistics display component
- `components/auth/UserAvatar.tsx` - User avatar component
- `components/auth/index.ts` - Auth components barrel export
- `app/api/users/stats/route.ts` - User statistics API endpoint

### Modified Files:
- `lib/fileAuth.ts` - Enhanced with provider fields and Excel export
- `app/layout.tsx` - Added SessionProvider wrapper
- `app/auth/signin/page.tsx` - Added Google sign-in button with loading states
- `middleware.ts` - Updated to use NextAuth JWT verification
- `components/layout/Sidebar.tsx` - Added user profile display and NextAuth signOut

## 🚀 Start the Application

```bash
cd backend/shopify-dashboard
npm run dev
```

Then open: http://localhost:3002/auth/signin

## ✨ Features Implemented

1. **Google OAuth Sign-In**
   - Click "Continue with Google" button
   - Authenticates via Google OAuth 2.0
   - Creates/updates user in `data/users.json`
   - Updates `data/users.xlsx` with user statistics

2. **Credentials Sign-In**
   - Email/password authentication still works
   - Uses bcrypt for password hashing

3. **User Profile Display**
   - Shows user avatar (Google profile picture or initials)
   - Displays name and email in sidebar

4. **User Data Storage**
   - JSON file: `data/users.json`
   - Excel file: `data/users.xlsx` (auto-generated)
   - Tracks provider type (google/credentials)
   - Records Google ID and profile image

5. **Session Management**
   - JWT-based sessions
   - 30-day session duration
   - Automatic token refresh

## 🔍 Testing Steps

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Clear browser data:**
   - Open DevTools (F12)
   - Go to Application > Storage > Clear site data

3. **Test Google Sign-In:**
   - Navigate to http://localhost:3002/auth/signin
   - Click "Continue with Google"
   - Select your Google account
   - If you see "This app isn't verified":
     - Click "Advanced"
     - Click "Go to Shopify Dashboard (unsafe)"
   - Grant permissions
   - Should redirect to dashboard

4. **Verify user creation:**
   ```bash
   cat data/users.json
   ```
   Should show user with `provider: "google"` and `googleId`

5. **Test sign out:**
   - Click Sign Out in sidebar
   - Should redirect to sign-in page

6. **Verify credentials still work:**
   - Sign out
   - Sign in with email/password
   - Should work as before

## 📊 Sample User Data (JSON)

```json
{
  "users": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "John Doe",
      "email": "john.doe@gmail.com",
      "password": "",
      "createdAt": "2024-11-26T10:30:00.000Z",
      "lastLogin": "2024-11-26T15:45:00.000Z",
      "provider": "google",
      "googleId": "1234567890abcdefghij",
      "image": "https://lh3.googleusercontent.com/a/...",
      "shopifyStoreId": null
    }
  ]
}
```

## 🛠️ Troubleshooting

### "redirect_uri_mismatch" error
- Verify redirect URI in Google Console matches exactly:
  `http://localhost:3002/api/auth/callback/google`
- No trailing slash
- Correct port number (3002)

### "access_denied" error
- Make sure you've added your email as a test user in Google Console
- Go to OAuth consent screen > Test users > Add your email

### Session not persisting
- Check NEXTAUTH_SECRET is set in .env.local
- Clear browser cookies and try again
- Restart the dev server after creating .env.local

### "This app isn't verified" warning
- This is normal for development/testing
- Click Advanced > Go to app (unsafe)
- For production, submit app for verification

## 📋 User Stats Component Usage

To display user statistics in your pages:

```tsx
import UserStats from '@/components/auth/UserStats';

export default function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Statistics</h1>
      <UserStats />
    </div>
  );
}
```

## 🔐 Security Notes

1. Keep `.env.local` file secure and never commit to version control
2. The NEXTAUTH_SECRET should be unique per environment
3. Google OAuth credentials should be rotated periodically
4. For production, use proper SSL certificates and update NEXTAUTH_URL

