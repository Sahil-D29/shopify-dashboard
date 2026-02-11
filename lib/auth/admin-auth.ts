import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export interface AdminUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'admin';
  permissions: string[];
  createdAt: string;
  lastLogin: string | null;
  status: 'active' | 'inactive';
  mfaEnabled: boolean;
  ipWhitelist: string[];
}

export interface AdminSession {
  type: 'admin';
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string | null;
  status: 'success' | 'failed';
}

// Read admin users (super admins from database)
export async function readAdminUsers(): Promise<AdminUser[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });

    return users.map((u: (typeof users)[number]) => ({
      id: u.id,
      email: u.email,
      password: u.passwordHash || '',
      name: u.name,
      role: 'super_admin' as const,
      permissions: ['*'],
      createdAt: u.createdAt.toISOString(),
      lastLogin: u.lastLogin?.toISOString() || null,
      status: 'active' as const,
      mfaEnabled: false,
      ipWhitelist: []
    }));
  } catch (error) {
    console.error('Error reading admin users:', error);
    return [];
  }
}

// Write admin users (deprecated - use user repository)
export async function writeAdminUsers(admins: AdminUser[]): Promise<void> {
  console.warn('writeAdminUsers is deprecated. Use user repository methods instead.');
}

// Find admin by email
export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    password: user.passwordHash || '',
    name: user.name,
    role: 'super_admin',
    permissions: ['*'],
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() || null,
    status: 'active',
    mfaEnabled: false,
    ipWhitelist: []
  };
}

// Find admin by ID
export async function findAdminById(id: string): Promise<AdminUser | null> {
  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    password: user.passwordHash || '',
    name: user.name,
    role: 'super_admin',
    permissions: ['*'],
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() || null,
    status: 'active',
    mfaEnabled: false,
    ipWhitelist: []
  };
}

// Verify admin password
export async function verifyAdminPassword(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;

  if (admin.status !== 'active') {
    return null;
  }

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) return null;

  // Update last login in database
  await prisma.user.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() }
  });

  admin.lastLogin = new Date().toISOString();
  return admin;
}

// Create admin JWT token
export async function createAdminToken(admin: AdminUser): Promise<string> {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  
  if (!secret) {
    throw new Error(
      'ADMIN_JWT_SECRET or NEXTAUTH_SECRET is not configured. ' +
      'Please set ADMIN_JWT_SECRET in your .env.local file. ' +
      'Generate one with: node scripts/generate-secrets.js'
    );
  }
  
  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    type: 'admin',
    userId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: admin.permissions,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(secretKey);

  return token;
}

// Verify admin JWT token
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET;
    
    if (!secret) {
      console.error('ADMIN_JWT_SECRET or NEXTAUTH_SECRET is not configured');
      return null;
    }
    
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey);

    if (payload.type !== 'admin') {
      return null;
    }

    return {
      type: 'admin',
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      permissions: (payload.permissions as string[]) || [],
    };
  } catch (error) {
    return null;
  }
}

// Get admin session from request
export async function getAdminSession(
  request: NextRequest
): Promise<AdminSession | null> {
  const token = request.cookies.get('admin_session')?.value;
  if (!token) return null;

  return await verifyAdminToken(token);
}

// Require admin middleware
export async function requireAdmin(
  request: NextRequest
): Promise<AdminSession> {
  const session = await getAdminSession(request);
  if (!session) {
    throw new Error('Admin authentication required');
  }
  return session;
}

// Log admin action to audit trail
export async function logAdminAction(
  adminId: string,
  action: string,
  details: Record<string, any>,
  ipAddress: string | null,
  status: 'success' | 'failed' = 'success'
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action,
        details: { ...details, status },
        ipAddress,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw - audit logging shouldn't break the app
  }
}

// Create initial admin (for setup)
export async function createInitialAdmin(
  email: string,
  password: string,
  name: string = 'Super Admin'
): Promise<AdminUser> {
  // Check if admin already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    throw new Error('Admin with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      name,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(),
      lastLogin: null
    }
  });

  const newAdmin: AdminUser = {
    id: newUser.id,
    email: newUser.email,
    password: hashedPassword,
    name: newUser.name,
    role: 'super_admin',
    permissions: ['*'],
    createdAt: newUser.createdAt.toISOString(),
    lastLogin: null,
    status: 'active',
    mfaEnabled: false,
    ipWhitelist: [],
  };

  return newAdmin;
}

