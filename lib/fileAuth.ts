import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Empty string for OAuth users
  shopifyStoreId: string | null;
  createdAt: string;
  lastLogin?: string;
  provider?: 'credentials' | 'google' | 'facebook';
  googleId?: string;
  facebookId?: string;
  image?: string;
  resetToken?: string | null;
  resetTokenExpiry?: string | null;
  /** Prisma User.role (SUPER_ADMIN, STORE_OWNER, VIEWER, etc.) - used as fallback when no StoreMember for current store */
  role?: string;
}

// Convert Prisma User to legacy User format (includes role for authorization fallback)
function prismaUserToLegacyUser(prismaUser: any): User {
  return {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    password: prismaUser.passwordHash || '',
    shopifyStoreId: prismaUser.ownedStores?.[0]?.shopifyStoreId || null,
    createdAt: prismaUser.createdAt.toISOString(),
    lastLogin: prismaUser.lastLogin?.toISOString(),
    provider: 'credentials',
    image: undefined,
    resetToken: null,
    resetTokenExpiry: null,
    role: prismaUser.role ?? undefined,
  };
}

// Read users from database
export async function readUsers(): Promise<User[]> {
  try {
    const users = await prisma.user.findMany({
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    return users.map(prismaUserToLegacyUser);
  } catch (error) {
    console.error('❌ Error reading users from database:', error);
    return [];
  }
}

// Write users - not needed for Prisma, but kept for compatibility
export async function writeUsers(users: User[]): Promise<void> {
  // This function is kept for backward compatibility but does nothing
  // Users should be created/updated through Prisma directly
  console.warn('⚠️ writeUsers() called - use Prisma directly instead');
}

// Legacy function aliases for backwards compatibility
export async function ensureDataDirectory() {
  // No-op for Prisma
}

export async function getUsers(): Promise<User[]> {
  return readUsers();
}

export async function saveUsers(users: User[]) {
  return writeUsers(users);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    return user ? prismaUserToLegacyUser(user) : null;
  } catch (error) {
    console.error('❌ Error finding user by email:', error);
    return null;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    return user ? prismaUserToLegacyUser(user) : null;
  } catch (error) {
    console.error('❌ Error finding user by id:', error);
    return null;
  }
}


export async function createUser(name: string, email: string, password: string): Promise<User> {
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        role: 'STORE_OWNER', // Default role for new users
        status: 'ACTIVE',
      },
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    
    return prismaUserToLegacyUser(user);
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    
    if (!user) return null;
    
    if (!user.passwordHash) {
      // OAuth user trying to use password
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (isValid) {
      await updateLastLogin(user.id);
      return prismaUserToLegacyUser(user);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error verifying password:', error);
    return null;
  }
}

export async function updateLastLogin(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  } catch (error) {
    console.error('❌ Error updating last login:', error);
  }
}

// Get user statistics
export async function getUserStats() {
  try {
    const users = await prisma.user.findMany({
      include: {
        ownedStores: {
          select: {
            shopifyStoreId: true,
          },
        },
      },
    });
    
    const allUsers: User[] = users.map(prismaUserToLegacyUser);
    
    return {
      total: allUsers.length,
      googleUsers: allUsers.filter((u: User) => u.provider === 'google').length,
      credentialUsers: allUsers.filter((u: User) => u.provider === 'credentials' || !u.provider).length,
      recentLogins: allUsers
        .filter((u: User) => u.lastLogin)
        .sort((a: User, b: User) => new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime())
        .slice(0, 5),
    };
  } catch (error) {
    console.error('❌ Error getting user stats:', error);
    return {
      total: 0,
      googleUsers: 0,
      credentialUsers: 0,
      recentLogins: [],
    };
  }
}
