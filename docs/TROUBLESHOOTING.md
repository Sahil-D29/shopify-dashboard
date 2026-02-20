# Troubleshooting & Common Pitfalls

## Top Issues

### 1. "Store not found" errors on API calls
**Cause:** storeId not being resolved on the server.
**Fix:** Always pass `x-store-id` header from client:
```typescript
const { currentStore } = useTenant();
fetch('/api/...', {
  headers: { 'x-store-id': currentStore?.id || '' }
});
```
Or ensure `current_store_id` cookie is set (TenantProvider does this automatically).

### 2. session.user.storeId is undefined
**Cause:** The NextAuth session callback does NOT set `storeId` on the user object.
**Fix:** Use `useTenant()` hook on client, `getCurrentStoreId()` on server. Never rely on `session.user.storeId`.

### 3. Build fails: "ENCRYPTION_KEY not found"
**Fix:** Generate secrets:
```bash
node scripts/generate-secrets.js
```
Copy the `ENCRYPTION_KEY=...` line to `.env.local`. Must be exactly 64 hex characters.

### 4. Auth crash on Render startup
**Cause:** `NEXTAUTH_SECRET` or `AUTH_SECRET` not set.
**Fix:** Set `NEXTAUTH_SECRET` in Render environment variables. The app has resilient `getBaseUrl()` that won't crash if URL detection fails (fixed in commit a8449e8).

### 5. Razorpay checkout not opening
**Cause:** Missing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` env vars.
**Fix:** Add both to `.env.local`. The `/api/health` endpoint now checks for Razorpay config.
**Note:** Razorpay uses **Orders API** (not Subscriptions). See `lib/razorpay.ts`.

### 6. Stripe checkout redirects to wrong URL
**Cause:** `getBaseUrl()` returning localhost in production.
**Fix:** Set `NEXT_PUBLIC_APP_URL` or `NEXTAUTH_URL` to your production domain.

### 7. request.json() fails or returns empty
**Cause:** `request.json()` can only be called once per request in Next.js.
**Fix:** Parse body once and pass the result around:
```typescript
const body = await request.json();
// Use body.field1, body.field2, etc.
// Do NOT call request.json() again
```

### 8. Admin panel login not working
**Cause:** Admin auth is separate from NextAuth. Uses `admin_session` cookie + jose JWT.
**Fix:**
- Ensure `ADMIN_JWT_SECRET` env var is set
- Create admin user: `node scripts/create-admin.js`
- Login at `/admin/auth/login`, not `/auth/signin`

### 9. Cron routes return 401 Unauthorized
**Cause:** Missing `CRON_SECRET` query parameter.
**Fix:** Call cron routes with: `/api/cron/campaign-runner?secret={CRON_SECRET}`

### 10. Shopify OAuth redirect mismatch
**Fix:** In Shopify Partner Dashboard, set redirect URI to: `{NEXTAUTH_URL}/api/auth/callback/shopify`

### 11. Campaign worker not sending messages
**Known issue:** `jobs/campaign.worker.ts` only marks campaigns as COMPLETED without actually sending messages. Full send logic needs to be implemented (segments, customer list, WhatsApp/SMS send).

### 12. Prisma "prepared statement already exists" error
**Cause:** Connection pooling issue with Neon.
**Fix:** Ensure `DATABASE_URL` uses the **pooled** connection string (contains `-pooler` in hostname).

### 13. Google OAuth not working
**Cause:** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set.
**Fix:** See `docs/GOOGLE_SIGNIN_SETUP.md` for full setup guide. The app gracefully disables Google sign-in if env vars are missing.

## Debug Tips

### Check system health
```
GET /api/health
```
Returns status of: database, auth secret, encryption key, admin secret, Razorpay config.

### Check current store context
```
GET /api/store/current
```

### View console logs
Settings page (`app/settings/page.tsx`) has debug `console.log` statements (TODO: remove for production).

### Prisma Studio (DB inspection)
```bash
npx prisma studio
```
Opens web UI at http://localhost:5555 to browse all tables.

### Check user permissions
```
GET /api/user/permissions
```
Returns current user's role and access level.

## Environment Checklist
Before reporting bugs, verify these are set:
- [ ] `DATABASE_URL` (pooled Neon connection)
- [ ] `NEXTAUTH_SECRET` or `AUTH_SECRET`
- [ ] `ENCRYPTION_KEY` (64 hex chars)
- [ ] `NEXTAUTH_URL` (your app URL)
- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (for INR billing)
- [ ] `ADMIN_JWT_SECRET` (for admin panel)

Full reference: `docs/ENV_VARIABLES.md`
