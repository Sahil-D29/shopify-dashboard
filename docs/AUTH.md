# Authentication & Authorization

## Overview
Two separate auth systems:
1. **NextAuth v5** — main app authentication (users, store owners, team members)
2. **Admin JWT** — admin panel authentication (super admins only)

## NextAuth Setup

### Config: `lib/auth.ts`
- **Providers:** Google OAuth + Credentials (email/password with bcryptjs)
- **Session strategy:** JWT (stateless, 30-day maxAge)
- **Cookie:** `authjs.session-token` (httpOnly)
- **Secret:** `AUTH_SECRET` or `NEXTAUTH_SECRET` env var

### Session Contents
```typescript
session.user = {
  id: string,          // Prisma User.id (UUID)
  email: string,
  name: string,
  image: string | null,
  role: string,        // 'user' for credentials, varies for OAuth
  teamRole?: string,   // StoreMember role if user is a team member
  teamStoreId?: string // Store ID from team membership
}
```
**IMPORTANT:** `session.user.storeId` does NOT exist. Use `useTenant()` or `getCurrentStoreId()` instead.

### Checking Auth in API Routes
```typescript
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // session.user.id, session.user.email available
}
```

### Multi-store Aware Auth
```typescript
import { getUserContext } from '@/lib/user-context';

export async function GET(request: NextRequest) {
  const { userId, storeId } = await getUserContext(request);
  if (!userId || !storeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### Route Protection: `middleware.ts`
- Uses `auth.config.ts` (Edge-compatible, no Prisma)
- Protected: all routes except `/auth/*`, `/api/auth/*`, `/admin/login`, `/_next/*`, `/favicon.ico`
- Redirects unauthenticated users to `/auth/signin`

## Admin Auth

### Config: `lib/auth/admin-auth.ts`
- Separate from NextAuth
- Uses `admin_session` cookie with jose JWT
- Secret: `ADMIN_JWT_SECRET` env var
- Only users with `SUPER_ADMIN` role can access

### Checking Admin Auth
```typescript
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

### Admin Routes
- Login: `/admin/auth/login` (POST) — returns JWT in `admin_session` cookie
- Logout: `/admin/auth/logout` (POST)
- Session: `/admin/auth/session` (GET) — validate current admin session

## User Roles
| Role | Access |
|------|--------|
| SUPER_ADMIN | Full admin panel + all stores |
| STORE_OWNER | Own stores + team management |
| MANAGER | Store operations (campaigns, journeys, contacts) |
| TEAM_MEMBER | Limited store access (chat, contacts) |
| VIEWER | Read-only access |

Roles defined in Prisma enum `UserRole`. Store-specific roles in `StoreMember.role`.

## Google OAuth Setup
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Redirect URI: `{NEXTAUTH_URL}/api/auth/callback/google`
- See `docs/GOOGLE_SIGNIN_SETUP.md` for full setup guide

## Password Reset Flow
- `/api/auth/forgot-password` — sends reset email
- `/api/auth/verify-reset-token` — validates token
- `/api/auth/reset-password` — sets new password
- Uses `User.passwordResetToken` and `User.passwordResetExpires` fields

## Team Invitations
1. Owner sends invite via `/api/teams/[storeId]/invite`
2. Creates `Invitation` record with token + expiry
3. Invitee receives email with accept link
4. On sign-in, `checkAndActivatePendingUser()` auto-activates pending invitations
5. Creates `StoreMember` record linking user to store
