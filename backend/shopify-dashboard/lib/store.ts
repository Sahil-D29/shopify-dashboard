import { promises as fs } from 'fs';
import path from 'path';
import type { ShopifyConfig } from './shopify';

/**
 * Simple file-based token store
 * 
 * SECURITY WARNING: This is for development/testing only!
 * In production, replace with a proper database (PostgreSQL, MongoDB, etc.)
 * 
 * Store location: ./data/shops.json
 */

const STORE_PATH = path.join(process.cwd(), 'data', 'shops.json');

export interface StoreEntry {
  shop: string;
  accessToken: string;
  scope?: string;
  installedAt: number;
  lastUpdated: number;
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  const dataDir = path.dirname(STORE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Read all store entries from file
 */
export async function readStores(): Promise<Record<string, StoreEntry>> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('Error reading stores:', error);
    return {};
  }
}

/**
 * Write store entries to file
 */
export async function writeStores(stores: Record<string, StoreEntry>): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(stores, null, 2), 'utf-8');
}

/**
 * Get store configuration by shop domain
 */
export async function getStore(shop: string): Promise<StoreEntry | null> {
  const stores = await readStores();
  const normalized = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
  const key = `${normalized}.myshopify.com`;
  return stores[key] || null;
}

/**
 * Save store configuration
 */
export async function saveStore(config: ShopifyConfig): Promise<void> {
  const stores = await readStores();
  const normalized = config.shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
  const key = `${normalized}.myshopify.com`;
  
  stores[key] = {
    shop: key,
    accessToken: config.accessToken,
    scope: config.scope,
    installedAt: config.installedAt || Date.now(),
    lastUpdated: Date.now(),
  };
  
  await writeStores(stores);
}

/**
 * Delete store configuration
 */
export async function deleteStore(shop: string): Promise<void> {
  const stores = await readStores();
  const normalized = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
  const key = `${normalized}.myshopify.com`;
  delete stores[key];
  await writeStores(stores);
}

/**
 * List all installed stores
 */
export async function listStores(): Promise<StoreEntry[]> {
  const stores = await readStores();
  return Object.values(stores);
}


