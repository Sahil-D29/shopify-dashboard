import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const ADMIN_USERS_FILE = path.join(DATA_DIR, 'admin', 'admin-users.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'admin', 'audit-logs.json');

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

// Ensure admin data directory exists
async function ensureAdminDataDir() {
  try {
    await fs.access(path.join(DATA_DIR, 'admin'));
  } catch {
    await fs.mkdir(path.join(DATA_DIR, 'admin'), { recursive: true });
  }
}

// Read admin users
export async function readAdminUsers(): Promise<AdminUser[]> {
  try {
    await ensureAdminDataDir();
    const data = await fs.readFile(ADMIN_USERS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.admins || [];
  } catch (error) {
    console.error('Error reading admin users:', error);
    return [];
  }
}

// Write admin users
export async function writeAdminUsers(admins: AdminUser[]): Promise<void> {
  try {
    await ensureAdminDataDir();
    await fs.writeFile(
      ADMIN_USERS_FILE,
      JSON.stringify({ admins }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Error writing admin users:', error);
    throw error;
  }
}

// Find admin by email
export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const admins = await readAdminUsers();
  return admins.find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
}

// Find admin by ID
export async function findAdminById(id: string): Promise<AdminUser | null> {
  const admins = await readAdminUsers();
  return admins.find((a) => a.id === id) || null;
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

  // Update last login
  admin.lastLogin = new Date().toISOString();
  const admins = await readAdminUsers();
  const index = admins.findIndex((a) => a.id === admin.id);
  if (index !== -1) {
    admins[index].lastLogin = admin.lastLogin;
    await writeAdminUsers(admins);
  }

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
    await ensureAdminDataDir();
    
    let logs: { logs: AuditLog[] } = { logs: [] };
    try {
      const data = await fs.readFile(AUDIT_LOGS_FILE, 'utf-8');
      logs = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty array
    }

    const logEntry: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      adminId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ipAddress,
      status,
    };

    logs.logs.unshift(logEntry);
    
    // Keep only last 10000 logs
    if (logs.logs.length > 10000) {
      logs.logs = logs.logs.slice(0, 10000);
    }

    await fs.writeFile(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
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
  const admins = await readAdminUsers();
  
  // Check if admin already exists
  if (admins.find((a) => a.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Admin with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newAdmin: AdminUser = {
    id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    role: 'super_admin',
    permissions: ['*'],
    createdAt: new Date().toISOString(),
    lastLogin: null,
    status: 'active',
    mfaEnabled: false,
    ipWhitelist: [],
  };

  admins.push(newAdmin);
  await writeAdminUsers(admins);

  return newAdmin;
}

