# How to Find and Set ADMIN_JWT_SECRET

## 🔍 Finding the Admin JWT Secret

The `ADMIN_JWT_SECRET` is an environment variable that needs to be set in your `.env.local` file. Here's how to find it or set it up:

## 📍 Where It's Used

The `ADMIN_JWT_SECRET` is used in:
- `lib/auth/admin-auth.ts` - For creating and verifying admin JWT tokens
- `middleware.ts` - For verifying admin sessions

## 🔎 How to Check If It's Set

### Method 1: Check Environment File

Look for `.env.local` in your project root:
```
backend/shopify-dashboard/.env.local
```

### Method 2: Check Current Value (Runtime)

The code checks for the secret in this order:
1. `process.env.ADMIN_JWT_SECRET` (preferred)
2. `process.env.NEXTAUTH_SECRET` (fallback)
3. `'admin-secret-key-change-this'` (default - **INSECURE**)

### Method 3: Check via Code

You can temporarily add this to see what's being used:

```typescript
// In lib/auth/admin-auth.ts
console.log('Admin JWT Secret:', process.env.ADMIN_JWT_SECRET || 'NOT SET - Using fallback');
```

## ⚙️ How to Set It

### Step 1: Create or Edit `.env.local`

Create or edit the file at:
```
backend/shopify-dashboard/.env.local
```

### Step 2: Add the Secret

Add this line to your `.env.local` file:

```env
ADMIN_JWT_SECRET=your-super-secret-admin-key-12345-abcdef
```

### Step 3: Generate a Secure Secret

**Option A: Using Node.js (Recommended)**

```bash
cd backend/shopify-dashboard
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: Using OpenSSL**

```bash
openssl rand -hex 32
```

**Option C: Online Generator**
- Visit: https://generate-secret.vercel.app/32
- Copy the generated secret

**Option D: Manual (Less Secure)**
- Use a long random string (at least 32 characters)
- Mix of letters, numbers, and special characters

### Step 4: Example `.env.local` File

```env
# Admin JWT Secret (MUST be different from user secret)
ADMIN_JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# User JWT Secret (NextAuth)
NEXTAUTH_SECRET=your-nextauth-secret-here

# Other environment variables...
```

## 🔐 Security Best Practices

1. **Never commit `.env.local` to git** - It should be in `.gitignore`
2. **Use a different secret** - `ADMIN_JWT_SECRET` should be different from `NEXTAUTH_SECRET`
3. **Use a strong secret** - At least 32 characters, random
4. **Rotate secrets** - Change them periodically
5. **Don't share secrets** - Keep them private

## 🚨 Important Notes

### Current Behavior

If `ADMIN_JWT_SECRET` is not set, the system will:
1. Try to use `NEXTAUTH_SECRET` (if set)
2. Fall back to `'admin-secret-key-change-this'` (INSECURE - for development only)

### Production Warning

⚠️ **NEVER use the default fallback in production!**

Always set a proper `ADMIN_JWT_SECRET` in production environments.

## ✅ Verification

After setting the secret:

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Test admin login**:
   - Go to: `http://localhost:3002/admin/login`
   - Login with admin credentials
   - If login works, the secret is being used correctly

3. **Check console logs** (if you added the debug line):
   - Should show your secret (first few characters only for security)

## 🔧 Troubleshooting

### Issue: Admin login not working

**Solution:**
1. Check if `.env.local` exists
2. Verify `ADMIN_JWT_SECRET` is set correctly
3. Restart the server after changing `.env.local`
4. Check for typos in the secret

### Issue: "Invalid token" errors

**Solution:**
1. Clear browser cookies
2. Verify the secret hasn't changed
3. Check if you're using the same secret that was used to create tokens

### Issue: Secret not being read

**Solution:**
1. Ensure file is named `.env.local` (not `.env` or `.env.local.txt`)
2. Ensure file is in the correct location: `backend/shopify-dashboard/.env.local`
3. Restart the server (environment variables are loaded at startup)
4. Check for syntax errors in `.env.local` (no spaces around `=`)

## 📝 Quick Setup Script

You can use this PowerShell script to generate and add the secret:

```powershell
# Generate secret
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Add to .env.local
$envFile = "backend\shopify-dashboard\.env.local"
if (Test-Path $envFile) {
    $content = Get-Content $envFile
    if ($content -match "ADMIN_JWT_SECRET") {
        $content = $content -replace "ADMIN_JWT_SECRET=.*", "ADMIN_JWT_SECRET=$secret"
        $content | Set-Content $envFile
    } else {
        Add-Content $envFile "`nADMIN_JWT_SECRET=$secret"
    }
} else {
    "ADMIN_JWT_SECRET=$secret" | Out-File $envFile
}

Write-Host "✅ ADMIN_JWT_SECRET added to .env.local"
Write-Host "Secret: $secret"
```

## 🎯 Summary

1. **Location**: `backend/shopify-dashboard/.env.local`
2. **Variable Name**: `ADMIN_JWT_SECRET`
3. **Generate**: Use crypto.randomBytes or openssl
4. **Format**: Long random string (32+ characters)
5. **Restart**: Always restart server after changing

---

**Remember**: Keep your secrets secure and never commit them to version control!

