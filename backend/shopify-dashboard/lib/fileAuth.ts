import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EXCEL_FILE = path.join(DATA_DIR, 'users.xlsx');

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
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Data directory created');
  }
}

// Read users from JSON file
export async function readUsers(): Promise<User[]> {
  try {
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      
      // Validate JSON before parsing
      if (!data || data.trim().length === 0) {
        console.log('📝 Users file is empty, returning empty array');
        return [];
      }
      
      const parsed = JSON.parse(data);
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        console.warn('⚠️ Users file has invalid structure, returning empty array');
        return [];
      }
      
      if (!Array.isArray(parsed.users)) {
        console.warn('⚠️ Users file does not contain users array, returning empty array');
        return [];
      }
      
      return parsed.users || [];
    } catch (error) {
      if (error instanceof Error) {
        if (error.code === 'ENOENT') {
          console.log('📝 Users file not found, returning empty array');
        } else if (error instanceof SyntaxError) {
          console.error('❌ Users file contains invalid JSON:', error.message);
        } else {
          console.error('❌ Error reading users file:', error.message);
        }
      } else {
        console.error('❌ Unknown error reading users:', error);
      }
      return [];
    }
  } catch (error) {
    console.error('❌ Error in readUsers:', error);
    if (error instanceof Error) {
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    return [];
  }
}

// Write users to both JSON and Excel files
export async function writeUsers(users: User[]): Promise<void> {
  try {
    await ensureDataDir();
    
    // Write JSON file with formatted output
    await fs.writeFile(
      USERS_FILE,
      JSON.stringify({ users }, null, 2),
      'utf-8'
    );
    console.log('✅ Users saved to JSON');

    // Write Excel file
    await exportToExcel(users);
    console.log('✅ Users exported to Excel');
  } catch (error) {
    console.error('❌ Error writing users:', error);
    throw error;
  }
}

// Export users to Excel with formatted columns
async function exportToExcel(users: User[]): Promise<void> {
  try {
    // Prepare data for Excel (exclude password, format dates, add provider info)
    const excelData = users.map((user) => ({
      'User ID': user.id,
      'Name': user.name,
      'Email': user.email,
      'Provider': user.provider || 'credentials',
      'Google ID': user.googleId || 'N/A',
      'Profile Image': user.image || 'N/A',
      'Shopify Store ID': user.shopifyStoreId || 'N/A',
      'Created At': new Date(user.createdAt).toLocaleString(),
      'Last Login': user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never',
      'Account Type': user.password ? 'Email/Password' : 'OAuth',
    }));
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 36 }, // User ID
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 12 }, // Provider
      { wch: 25 }, // Google ID
      { wch: 50 }, // Profile Image
      { wch: 20 }, // Shopify Store ID
      { wch: 20 }, // Created At
      { wch: 20 }, // Last Login
      { wch: 15 }, // Account Type
    ];
    
    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    
    // Add metadata sheet
    const metadata = [
      ['Report Generated', new Date().toLocaleString()],
      ['Total Users', users.length],
      ['Google Users', users.filter(u => u.provider === 'google').length],
      ['Credential Users', users.filter(u => u.provider === 'credentials' || !u.provider).length],
    ];
    const metadataSheet = XLSX.utils.aoa_to_sheet(metadata);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    
    // Write to file
    XLSX.writeFile(workbook, EXCEL_FILE);
    console.log('📊 Excel file updated with user statistics');
  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    // Don't throw - Excel export is optional, shouldn't break the app
  }
}

// Legacy function aliases for backwards compatibility
export async function ensureDataDirectory() {
  return ensureDataDir();
}

export async function getUsers(): Promise<User[]> {
  return readUsers();
}

export async function saveUsers(users: User[]) {
  return writeUsers(users);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function createUser(name: string, email: string, password: string): Promise<User> {
  const users = await readUsers();
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    shopifyStoreId: null,
    createdAt: new Date().toISOString(),
    lastLogin: undefined,
    provider: 'credentials',
  };
  
  users.push(newUser);
  await writeUsers(users);
  
  return newUser;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  
  if (!user.password) {
    // OAuth user trying to use password
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  
  if (isValid) {
    await updateLastLogin(user.id);
    return user;
  }
  
  return null;
}

export async function updateLastLogin(userId: string) {
  const users = await readUsers();
  const userIndex = users.findIndex((u) => u.id === userId);
  
  if (userIndex !== -1) {
    users[userIndex].lastLogin = new Date().toISOString();
    await writeUsers(users);
  }
}

// Get user statistics
export async function getUserStats() {
  const users = await readUsers();
  
  return {
    total: users.length,
    googleUsers: users.filter(u => u.provider === 'google').length,
    credentialUsers: users.filter(u => u.provider === 'credentials' || !u.provider).length,
    recentLogins: users
      .filter(u => u.lastLogin)
      .sort((a, b) => new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime())
      .slice(0, 5),
  };
}
