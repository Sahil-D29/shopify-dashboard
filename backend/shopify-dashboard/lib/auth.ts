import NextAuth, { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { readUsers, writeUsers, User } from '@/lib/fileAuth';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// --- Helper: Activate pending user on sign-in ---
async function checkAndActivatePendingUser(email: string) {
  try {
    const teamsFilePath = path.join(process.cwd(), 'data', 'teams.json');

    // Ensure file exists
    try {
      await fs.access(teamsFilePath);
    } catch {
      await fs.mkdir(path.dirname(teamsFilePath), { recursive: true });
      await fs.writeFile(teamsFilePath, JSON.stringify({ teams: [] }, null, 2));
    }

    const fileContent = await fs.readFile(teamsFilePath, 'utf-8');
    const teamsData = fileContent ? JSON.parse(fileContent) : { teams: [] };

    let updated = false;

    for (const team of teamsData.teams || []) {
      const pendingUser = team.pendingUsers?.find((u: any) => u.email === email);
      if (pendingUser) {
        const newMember = {
          id: pendingUser.id,
          email: pendingUser.email,
          role: pendingUser.role,
          addedBy: pendingUser.addedBy,
          addedAt: pendingUser.addedAt,
          activatedAt: new Date().toISOString(),
          status: 'active',
        };

        team.members = team.members || [];
        team.members.push(newMember);
        team.pendingUsers = (team.pendingUsers || []).filter((u: any) => u.email !== email);
        updated = true;
        console.log(`[Auth] Activated pending user ${email} for store ${team.storeId}`);
      }
    }

    if (updated) {
      await fs.writeFile(teamsFilePath, JSON.stringify(teamsData, null, 2));
    }

    return updated;
  } catch (error) {
    console.error('[Auth] Error activating pending user:', error);
    return false;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
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

        const users = await readUsers();
        const user = users.find((u) => u.email === credentials.email);

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
        await checkAndActivatePendingUser(user.email!);

        // Update last login
        user.lastLogin = new Date().toISOString();
        await writeUsers(users);

        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
          role: (user as any).role || 'user',
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth providers (Google)
      if (account?.provider === 'google') {
        try {
          const users = await readUsers();
          let existingUser = users.find((u) => u.email === user.email);

          if (!existingUser) {
            const newUser: User = {
              id: uuidv4(),
              name: user.name || 'Google User',
              email: user.email!,
              password: '', // Empty for OAuth users
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              provider: account.provider,
              googleId: (profile as { sub?: string })?.sub || account.providerAccountId,
              image: user.image || undefined,
              shopifyStoreId: null,
            };

            users.push(newUser);
            await writeUsers(users);
            
            console.log(`✅ New Google user created and saved:`);
            console.log(`   📧 Email: ${newUser.email}`);
            console.log(`   👤 Name: ${newUser.name}`);
            console.log(`   🆔 Google ID: ${newUser.googleId}`);
            console.log(`   📅 Created: ${newUser.createdAt}`);
          } else {
            existingUser.lastLogin = new Date().toISOString();
            if (!existingUser.provider) {
              existingUser.provider = account.provider;
            }
            
            // Update Google ID if missing
            if (!existingUser.googleId) {
              existingUser.googleId = (profile as { sub?: string })?.sub || account.providerAccountId;
            }
            
            if (!existingUser.image && user.image) {
              existingUser.image = user.image;
            }
            
            await writeUsers(users);
            
            console.log(`✅ Existing user logged in with ${account.provider} (updated):`);
            console.log(`   📧 Email: ${existingUser.email}`);
            console.log(`   🕐 Last Login: ${existingUser.lastLogin}`);
          }

          // Auto-activate pending user access on successful OAuth sign in
          if (user.email) {
            await checkAndActivatePendingUser(user.email);
          }

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
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.role = (user as any).role;
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
          const teamsFilePath = path.join(process.cwd(), 'data', 'teams.json');
          const fileContent = await fs.readFile(teamsFilePath, 'utf-8').catch(() => '{"teams": []}');
          const teamsData = JSON.parse(fileContent);
          
          // Find if user is an active team member in any store
          for (const team of teamsData.teams || []) {
            const member = team.members?.find((m: any) => m.email === session.user.email);
            if (member && member.role) {
              // Store team role in session (can be used by frontend to determine access)
              (session.user as any).teamRole = member.role;
              (session.user as any).teamStoreId = team.storeId;
              console.log(`[Auth] User ${session.user.email} has team role ${member.role} for store ${team.storeId}`);
              // Note: We keep the main account role, but frontend can check teamRole for store-specific access
            }
          }
        } catch (error) {
          console.error('[Auth] Error checking team role:', error);
        }
      }

      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from 30 for security)
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax', // CSRF protection
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.callback-url' 
        : 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Host-next-auth.csrf-token' 
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
};

// Validate required environment variables at startup
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET is not configured. ' +
    'Please set it in your .env.local file. ' +
    'Generate one with: node scripts/generate-secrets.js'
  );
}

export const authOptions = authConfig;
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
