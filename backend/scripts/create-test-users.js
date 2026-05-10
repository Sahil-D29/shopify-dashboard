// backend/scripts/create-test-users.js
// Script to create test users for all three roles with granular permissions
// NO HARDCODING - Uses config files and environment variables

import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { generateUUID } from '../utils/validation.js';
import { ROLES } from '../config/roles.config.js';
import { normalizeStoreId } from '../config/stores.config.js';
import { getPresetPermissions, PERMISSION_PRESETS } from '../config/permissionPresets.config.js';
import bcrypt from 'bcrypt';

// Get configuration from environment
const USERS_FILE = process.env.USERS_FILE || 'users.json';
const TEST_STORE_1 = normalizeStoreId(process.env.TEST_STORE_1 || 'test-store-1');
const TEST_STORE_2 = normalizeStoreId(process.env.TEST_STORE_2 || 'test-store-2');

// Test users configuration - NO hardcoded credentials
// Passwords are hashed, store IDs come from env
const testUsersConfig = [
  {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    name: 'System Admin',
    role: ROLES.ADMIN,
    stores: [], // Admin has access to all stores
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin123!@#'
  },
  {
    email: process.env.TEST_STORE_OWNER_1_EMAIL || 'storeowner@test.com',
    name: 'Store Owner',
    role: ROLES.STORE_OWNER,
    stores: [TEST_STORE_1],
    password: process.env.TEST_STORE_OWNER_PASSWORD || 'StoreOwner123!@#'
  },
  {
    email: process.env.TEST_STORE_OWNER_2_EMAIL || 'storeowner2@test.com',
    name: 'Store Owner 2',
    role: ROLES.STORE_OWNER,
    stores: [TEST_STORE_2],
    password: process.env.TEST_STORE_OWNER_PASSWORD || 'StoreOwner123!@#'
  },
  {
    email: process.env.TEST_USER_EMAIL || 'user@test.com',
    name: 'Team Member (View Only)',
    role: ROLES.USER,
    stores: [TEST_STORE_1],
    permissions: getPresetPermissions('View Only'),
    password: process.env.TEST_USER_PASSWORD || 'User123!@#'
  },
  {
    email: process.env.TEST_MARKETING_EMAIL || 'marketing@test.com',
    name: 'Marketing Manager',
    role: ROLES.USER,
    stores: [TEST_STORE_1],
    permissions: getPresetPermissions('Marketing Manager'),
    password: process.env.TEST_USER_PASSWORD || 'User123!@#'
  },
  {
    email: process.env.TEST_SUPPORT_EMAIL || 'support@test.com',
    name: 'Customer Support',
    role: ROLES.USER,
    stores: [TEST_STORE_1],
    permissions: getPresetPermissions('Customer Support'),
    password: process.env.TEST_USER_PASSWORD || 'User123!@#'
  },
  {
    email: process.env.TEST_CONTENT_EMAIL || 'content@test.com',
    name: 'Content Manager',
    role: ROLES.USER,
    stores: [TEST_STORE_1],
    permissions: getPresetPermissions('Content Manager'),
    password: process.env.TEST_USER_PASSWORD || 'User123!@#'
  },
  {
    email: process.env.TEST_POWER_USER_EMAIL || 'poweruser@test.com',
    name: 'Power User',
    role: ROLES.USER,
    stores: [TEST_STORE_1],
    permissions: getPresetPermissions('Power User'),
    password: process.env.TEST_USER_PASSWORD || 'User123!@#'
  }
];

async function createTestUsers() {
  try {
    console.log('📝 Creating test users...');
    console.log(`   Using stores: ${TEST_STORE_1}, ${TEST_STORE_2}`);
    console.log('');
    
    // Read existing users
    const existingData = await readFileSafe(USERS_FILE, { default: { users: [] } });
    const existingUsers = existingData.users || [];
    
    // Filter out test users that already exist
    const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()));
    const newUsersConfig = testUsersConfig.filter(u => !existingEmails.has(u.email?.toLowerCase()));
    
    if (newUsersConfig.length === 0) {
      console.log('✅ All test users already exist');
      return;
    }
    
    // Hash passwords and create user objects
    const newUsers = await Promise.all(
      newUsersConfig.map(async (config) => {
        const hashedPassword = await bcrypt.hash(config.password, 10);
        
        return {
          id: generateUUID(),
          email: config.email.toLowerCase().trim(),
          password: hashedPassword,
          name: config.name,
          role: config.role,
          stores: config.stores || [],
          permissions: config.permissions || (config.role === ROLES.USER ? getPresetPermissions('View Only') : undefined),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: null
        };
      })
    );
    
    // Add new users
    const updatedUsers = [...existingUsers, ...newUsers];
    
    // Write back to file
    await writeFileSafe(USERS_FILE, { users: updatedUsers });
    
    console.log(`✅ Created ${newUsers.length} test users:`);
    newUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`);
    });
    
    console.log('\n📋 Test User Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsersConfig.forEach((config, index) => {
      const user = newUsers[index];
      console.log(`${config.role.toUpperCase()}:`);
      console.log(`  Email: ${config.email}`);
      console.log(`  Password: ${config.password}`);
      if (config.role === ROLES.ADMIN) {
        console.log('  Access: All stores');
      } else {
        console.log(`  Access: ${config.stores.join(', ')} store(s)`);
      }
      if (config.role === ROLES.USER && config.permissions) {
        const presetName = Object.keys(PERMISSION_PRESETS).find(
          name => JSON.stringify(PERMISSION_PRESETS[name]) === JSON.stringify(config.permissions)
        );
        if (presetName) {
          console.log(`  Permission Preset: ${presetName}`);
        } else {
          console.log(`  Permissions: Custom`);
        }
      }
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Tip: Set environment variables to customize test users:');
    console.log('   TEST_STORE_1, TEST_STORE_2');
    console.log('   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD');
    console.log('   TEST_STORE_OWNER_1_EMAIL, TEST_STORE_OWNER_PASSWORD');
    console.log('   TEST_USER_EMAIL, TEST_USER_PASSWORD');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUsers()
    .then(() => {
      console.log('\n✅ Test users created successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to create test users:', error);
      process.exit(1);
    });
}

export { createTestUsers };

