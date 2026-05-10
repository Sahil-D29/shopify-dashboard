# Quick Start - Security Implementation

## 🚀 Immediate Actions Required

### Step 1: Generate Secrets
```bash
cd backend/shopify-dashboard
node scripts/generate-secrets.js
```

Copy the output to `backend/shopify-dashboard/.env.local`:
```env
ENCRYPTION_KEY=<64-character-hex-string>
NEXTAUTH_SECRET=<64-character-hex-string>
ADMIN_JWT_SECRET=<64-character-hex-string>
```

### Step 2: Encrypt Existing Tokens
```bash
cd backend/shopify-dashboard
# Make sure ENCRYPTION_KEY is in .env.local first!
npx ts-node scripts/encrypt-existing-tokens.ts
```

### Step 3: Restart Servers
```bash
# Restart both backend and frontend
# Backend (port 5000)
cd backend
npm start

# Frontend (port 3002)
cd backend/shopify-dashboard
npm run dev
```

## ✅ What's Been Implemented

### Security
- ✅ All secrets moved to environment variables
- ✅ Token encryption for shops.json
- ✅ Rate limiting (5 login attempts per 15 min)
- ✅ Secure session cookies
- ✅ Input validation with Zod

### Architecture
- ✅ Permissions system (ADMIN, STORE_OWNER, USER)
- ✅ Error boundaries
- ✅ File-based segment storage
- ✅ Audit logging
- ✅ Token expiration handling

## 📝 Using New Features

### In API Routes - Add Permissions
```typescript
import { requirePermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission('segments:create');
  if (error) return error;
  // ... your code
}
```

### In API Routes - Add Validation
```typescript
import { validateRequest } from '@/lib/validations/validate';
import { CreateSegmentSchema } from '@/lib/validations/schemas';

export async function POST(request: NextRequest) {
  const { data, error } = await validateRequest(request, CreateSegmentSchema);
  if (error) return error;
  // ... use validated data
}
```

### Using Token Manager
```typescript
import { getShopToken, saveShopToken } from '@/lib/token-manager';

// Get token (automatically decrypts)
const token = await getShopToken('shop.myshopify.com');

// Save token (automatically encrypts)
await saveShopToken('shop.myshopify.com', 'access-token', 'scopes');
```

### Audit Logging
```typescript
import { logAudit } from '@/lib/audit-logger';

await logAudit({
  userId: session.user.id,
  userEmail: session.user.email,
  action: 'segment.create',
  resource: 'segment',
  resourceId: segment.id,
  ipAddress: request.ip,
});
```

## ⚠️ Important Notes

1. **Backup First**: Backup `data/shops.json` before running migration
2. **Environment Variables**: All three secrets are required
3. **Token Migration**: Run only once after setting ENCRYPTION_KEY
4. **Role Assignment**: Users need `role` field in session (add to user model)

## 🐛 Troubleshooting

### "ENCRYPTION_KEY is not configured"
- Make sure `.env.local` exists in `backend/shopify-dashboard/`
- Check that ENCRYPTION_KEY is exactly 64 characters (32 bytes in hex)

### "ADMIN_JWT_SECRET is not configured"
- Add ADMIN_JWT_SECRET to `.env.local`
- Restart the server after adding

### "Decryption failed"
- Token might be corrupted
- Check if ENCRYPTION_KEY matches the one used to encrypt
- Restore from backup if needed

### Rate limiting too strict
- Adjust limits in `lib/rate-limit.ts` or `middleware/rate-limiter.js`
- For development, you can temporarily increase limits

## 📚 Full Documentation

See `SECURITY_IMPLEMENTATION_COMPLETE.md` for complete details.


