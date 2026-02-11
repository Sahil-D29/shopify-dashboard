import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORES_DIR = path.join(DATA_DIR, 'stores');

export interface StoreUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  storeId: string;
  role: 'admin' | 'manager' | 'builder' | 'viewer';
  status: 'active' | 'inactive' | 'deleted';
  createdAt: string;
  lastLogin?: string;
  provider?: 'credentials' | 'google' | 'facebook';
  googleId?: string;
  facebookId?: string;
  image?: string;
}

// Get users file path for a store
function getUsersFilePath(storeId: string): string {
  return path.join(STORES_DIR, storeId, 'users.json');
}

// Read users for a specific store
export async function readStoreUsers(storeId: string): Promise<StoreUser[]> {
  try {
    const filePath = getUsersFilePath(storeId);
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.users || [];
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

// Write users for a specific store
export async function writeStoreUsers(storeId: string, users: StoreUser[]): Promise<void> {
  const filePath = getUsersFilePath(storeId);
  const dir = path.dirname(filePath);
  
  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(
    filePath,
    JSON.stringify({ users }, null, 2),
    'utf-8'
  );
}

// Get all users across all stores
export async function readAllUsers(): Promise<StoreUser[]> {
  try {
    const storeFolders = await fs.readdir(STORES_DIR);
    const allUsers: StoreUser[] = [];

    for (const folder of storeFolders) {
      try {
        const users = await readStoreUsers(folder);
        allUsers.push(...users);
      } catch {
        // Skip stores without users file
      }
    }

    return allUsers;
  } catch {
    return [];
  }
}

// Find user by email across all stores
export async function findUserByEmail(email: string): Promise<StoreUser | null> {
  const allUsers = await readAllUsers();
  return allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

// Find user by ID across all stores
export async function findUserById(userId: string): Promise<StoreUser | null> {
  const allUsers = await readAllUsers();
  return allUsers.find((u) => u.id === userId) || null;
}

// Create a new user
export async function createStoreUser(
  storeId: string,
  userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: 'admin' | 'manager' | 'builder' | 'viewer';
  }
): Promise<StoreUser> {
  const users = await readStoreUsers(storeId);

  // Check if email already exists in this store
  if (users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
    throw new Error('User with this email already exists in this store');
  }

  // Check if email exists in any store
  const existingUser = await findUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('User with this email already exists in another store');
  }

  const hashedPassword = await bcrypt.hash(userData.password, 12);

  const newUser: StoreUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: userData.name,
    email: userData.email.toLowerCase(),
    password: hashedPassword,
    phone: userData.phone,
    storeId,
    role: userData.role,
    status: 'active',
    createdAt: new Date().toISOString(),
    provider: 'credentials',
  };

  users.push(newUser);
  await writeStoreUsers(storeId, users);

  return newUser;
}

// Update user
export async function updateStoreUser(
  userId: string,
  updates: Partial<StoreUser>
): Promise<StoreUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const users = await readStoreUsers(user.storeId);
  const index = users.findIndex((u) => u.id === userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  // If email is being changed, check for duplicates
  if (updates.email && updates.email.toLowerCase() !== user.email.toLowerCase()) {
    const existingUser = await findUserByEmail(updates.email);
    if (existingUser && existingUser.id !== userId) {
      throw new Error('User with this email already exists');
    }
  }

  // If password is being updated, hash it
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 12);
  }

  users[index] = { ...users[index], ...updates };
  await writeStoreUsers(user.storeId, users);

  return users[index];
}

// Delete user (soft delete)
export async function deleteStoreUser(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await updateStoreUser(userId, { status: 'deleted' });
}

