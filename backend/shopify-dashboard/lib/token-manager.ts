import fs from 'fs/promises';
import path from 'path';
import { encrypt, decrypt, isEncrypted } from './encryption';

const SHOPS_FILE = path.join(process.cwd(), 'data', 'shops.json');

interface ShopData {
  shop: string;
  accessToken: string;
  scope?: string;
  installedAt?: number;
}

interface ShopsDatabase {
  [shopDomain: string]: ShopData;
}

/**
 * Read shops database
 */
async function readShopsFile(): Promise<ShopsDatabase> {
  try {
    const data = await fs.readFile(SHOPS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
    return {};
  }
}

/**
 * Write shops database
 */
async function writeShopsFile(shops: ShopsDatabase): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(SHOPS_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  
  await fs.writeFile(SHOPS_FILE, JSON.stringify(shops, null, 2), 'utf-8');
}

/**
 * Save shop with encrypted access token
 */
export async function saveShopToken(
  shopDomain: string,
  accessToken: string,
  scope?: string
): Promise<void> {
  const shops = await readShopsFile();
  
  // Encrypt token before saving
  const encryptedToken = encrypt(accessToken);
  
  shops[shopDomain] = {
    shop: shopDomain,
    accessToken: encryptedToken,
    scope,
    installedAt: Date.now(),
  };
  
  await writeShopsFile(shops);
}

/**
 * Get decrypted access token for a shop
 */
export async function getShopToken(shopDomain: string): Promise<string | null> {
  const shops = await readShopsFile();
  const shopData = shops[shopDomain];
  
  if (!shopData || !shopData.accessToken) {
    return null;
  }
  
  try {
    // Check if token is encrypted, if not, it's legacy plaintext
    if (isEncrypted(shopData.accessToken)) {
      // Decrypt token
      return decrypt(shopData.accessToken);
    } else {
      // Legacy plaintext token - return as-is but log warning
      console.warn(`⚠️  Shop ${shopDomain} has unencrypted token. Run migration script to encrypt.`);
      return shopData.accessToken;
    }
  } catch (error) {
    console.error(`Failed to decrypt token for ${shopDomain}:`, error);
    return null;
  }
}

/**
 * Get all shop domains
 */
export async function getAllShops(): Promise<string[]> {
  const shops = await readShopsFile();
  return Object.keys(shops);
}

/**
 * Get shop data (without decrypting token)
 */
export async function getShopData(shopDomain: string): Promise<ShopData | null> {
  const shops = await readShopsFile();
  return shops[shopDomain] || null;
}

/**
 * Delete shop data
 */
export async function deleteShop(shopDomain: string): Promise<void> {
  const shops = await readShopsFile();
  delete shops[shopDomain];
  await writeShopsFile(shops);
}

/**
 * Migrate existing plaintext tokens to encrypted format
 */
export async function migrateTokensToEncrypted(): Promise<number> {
  const shops = await readShopsFile();
  let migrated = 0;
  
  for (const [domain, data] of Object.entries(shops)) {
    // Check if token is already encrypted
    if (!isEncrypted(data.accessToken)) {
      console.log(`Encrypting token for: ${domain}`);
      try {
        shops[domain].accessToken = encrypt(data.accessToken);
        migrated++;
      } catch (error) {
        console.error(`Failed to encrypt token for ${domain}:`, error);
      }
    }
  }
  
  if (migrated > 0) {
    await writeShopsFile(shops);
    console.log(`✅ Migrated ${migrated} tokens to encrypted format`);
  } else {
    console.log('✅ All tokens already encrypted');
  }
  
  return migrated;
}


