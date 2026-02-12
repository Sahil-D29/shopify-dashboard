import NextAuth, { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUserByEmail, findUserById, updateLastLogin } from '@/lib/fileAuth';
import { prisma } from './prisma';
import { UserRole, UserStatus, MemberStatus } from '@prisma/client';
import { getBaseUrl } from './utils/getBaseUrl';

// --- Helper: Activate pending user on sign-in ---
async function checkAndActivatePendingUser(email: string) {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return false;
    }

    // Find pending invitations for this user
    const invitations = await prisma.invitation.findMany({
      where: {
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        inviter: true,
      },
    });

    let updated = false;

    for (const invitation of invitations) {
      // Create store member from invitation
      await prisma.storeMember.upsert({
        where: {
          userId_storeId: {
            userId: user.id,
            storeId: invitation.storeId,
          },
        },
        update: {
          status: MemberStatus.ACTIVE,
        },
        create: {
          userId: user.id,
          storeId: invitation.storeId,
          role: invitation.role as any,
          status: MemberStatus.ACTIVE,
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
        },
      });

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      updated = true;
      console.log(`[Auth] Activated pending user ${email} for store ${invitation.storeId}`);
    }

    return updated;
  } catch (error) {
    console.error('[Auth] Error activating pending user:', error);
    return false;
  }
}

// Build providers: add Google only when credentials are set (avoids crash when env is missing)
const providers: NextAuthConfig['providers'] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  );
} else if (process.env.NODE_ENV === 'development') {
  console.warn('⚠️  [Auth] Google sign-in disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local (see docs/GOOGLE_SIGNIN_SETUP.md)');
}
providers.push(
  CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password');
        }

        const user = await findUserByEmail(credentials.email as string);

        if (!user) {
          throw new Error('No user found with this email');
        }

        if (!user.password) {
          throw new Error('Please sign in with Google');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        // Auto-activate pending user access on successful sign in
        await checkAndActivatePendingUser(user.email);

        // Update last login
        await updateLastLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: 'user',
        };
      }
    })
);

export const authConfig: NextAuthConfig = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth providers (Google)
      if (account?.provider === 'google' && user.email) {
        try {
          let existingUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
          });

          if (!existingUser) {
            // Create new user
            existingUser = await prisma.user.create({
              data: {
                name: user.name || 'Google User',
                email: user.email.toLowerCase(),
                passwordHash: null, // OAuth users don't have passwords
                role: UserRole.STORE_OWNER,
                status: UserStatus.ACTIVE,
                lastLogin: new Date(),
              },
            });
            
            console.log(`✅ New Google user created and saved:`);
            console.log(`   📧 Email: ${existingUser.email}`);
            console.log(`   👤 Name: ${existingUser.name}`);
            console.log(`   📅 Created: ${existingUser.createdAt}`);
          } else {
            // Update existing user
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                lastLogin: new Date(),
                name: user.name || existingUser.name,
              },
            });
            
            console.log(`✅ Existing user logged in with ${account.provider} (updated):`);
            console.log(`   📧 Email: ${existingUser.email}`);
            console.log(`   🕐 Last Login: ${new Date().toISOString()}`);
          }

          // Auto-activate pending user access on successful OAuth sign in
          await checkAndActivatePendingUser(user.email);

          return true;
        } catch (error) {
          console.error(`❌ Error during ${account.provider} sign-in:`, error);
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.role = (user as any).role;
        // For Google, use Prisma user id so session matches DB (provider user.id is Google's id)
        if (account?.provider === 'google' && user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: (user.email as string).toLowerCase() },
              select: { id: true },
            });
            if (dbUser) token.id = dbUser.id;
            else token.id = user.id;
          } catch {
            token.id = user.id;
          }
        } else {
          token.id = user.id;
        }
      }

      if (account?.provider === 'google') {
        token.provider = 'google';
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        (session.user as any).role = token.role as string;
        
        // Check if user has a team member role for any store
        // This allows team members to have their team role override their main account role
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email! },
            include: {
              storeMembers: {
                where: {
                  status: MemberStatus.ACTIVE,
                },
                include: {
                  store: {
                    select: {
                      id: true,
                      storeName: true,
                    },
                  },
                },
              },
            },
          });

          if (dbUser && dbUser.storeMembers.length > 0) {
            // Use the first active store member role
            const member = dbUser.storeMembers[0];
            (session.user as any).teamRole = member.role;
            (session.user as any).teamStoreId = member.storeId;
            console.log(`[Auth] User ${session.user.email} has team role ${member.role} for store ${member.storeId}`);
          }
        } catch (error) {
          console.error('[Auth] Error checking team role:', error);
        }
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Production-safe: never redirect to localhost; use env-based base URL
      let base =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        baseUrl ||
        '';
      if (!base || base.includes('localhost')) {
        try {
          base = getBaseUrl();
        } catch {
          base = baseUrl || '';
        }
      }
      base = String(base).replace(/\/$/, '');

      // If url contains localhost, extract path and use production base
      let targetPath = url;
      if (url.includes('localhost')) {
        try {
          targetPath = new URL(url).pathname + (new URL(url).search || '');
        } catch {
          targetPath = url.startsWith('/') ? url : '/' + url.replace(/^\//, '');
        }
      }

      const normalized = targetPath.startsWith('/')
        ? targetPath
        : (() => {
            try {
              const u = new URL(targetPath);
              return u.pathname + (u.search || '');
            } catch {
              return '/' + targetPath.replace(/^\//, '');
            }
          })();

      if (normalized === '/auth/signin' || normalized.startsWith('/auth/signin?')) {
        return base ? `${base}/settings?setup=true` : '/settings?setup=true';
      }
      if (targetPath.startsWith('/')) {
        return base ? `${base}${targetPath}` : targetPath;
      }
      try {
        const parsed = new URL(targetPath);
        if (parsed.origin.includes('localhost')) {
          return base ? `${base}${parsed.pathname}${parsed.search}` : `${parsed.pathname}${parsed.search}`;
        }
        if (base && parsed.origin === new URL(base).origin) return targetPath;
      } catch {
        /* invalid url */
      }
      return base ? `${base}/settings?setup=true` : '/settings?setup=true';
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,
  },
  // Use Auth.js default cookie names (authjs.session-token) so middleware can read the session
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
};

// Validate required environment variables at startup
// Don't throw during build (next build sets NODE_ENV=production but env vars may not be available)
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  const errorMessage =
    'AUTH_SECRET or NEXTAUTH_SECRET is not configured. ' +
    'Please set one in your .env.local file. ' +
    'Generate one with: node scripts/generate-secrets.js';

  console.warn('⚠️  [Auth]', errorMessage);
  console.warn('⚠️  [Auth] Authentication will not work until AUTH_SECRET or NEXTAUTH_SECRET is configured.');
}

export const authOptions = authConfig;
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
