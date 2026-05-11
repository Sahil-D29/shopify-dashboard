import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_REGISTRY_FILE = path.join(DATA_DIR, 'stores', 'store-registry.json');

export interface Store {
  id: string;
  name: string;
  shopDomain: string;
  owner: string;
  status: 'active' | 'suspended' | 'inactive';
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  createdAt: string;
  usersCount?: number;
  messagesCount?: number;
  lastSync?: string;
  settings?: {
    timezone?: string;
    currency?: string;
  };
}

interface StoreRegistry {
  stores: Store[];
}

// Ensure stores directory exists
async function ensureStoresDir() {
  const storesDir = path.join(DATA_DIR, 'stores');
  try {
    await fs.access(storesDir);
  } catch {
    await fs.mkdir(storesDir, { recursive: true });
  }
}

// Read store registry
export async function readStoreRegistry(): Promise<Store[]> {
  try {
    await ensureStoresDir();
    const data = await fs.readFile(STORE_REGISTRY_FILE, 'utf-8');
    const parsed: StoreRegistry = JSON.parse(data);
    return parsed.stores || [];
  } catch (error) {
    // File doesn't exist, return default store
    return [
      {
        id: 'store_default',
        name: 'Default Store',
        shopDomain: 'demo.myshopify.com',
        owner: 'owner@store.com',
        status: 'active',
        plan: 'pro',
        createdAt: new Date().toISOString(),
        usersCount: 0,
        messagesCount: 0,
      },
    ];
  }
}

// Write store registry
export async function writeStoreRegistry(stores: Store[]): Promise<void> {
  try {
    await ensureStoresDir();
    const registry: StoreRegistry = { stores };
    await fs.writeFile(
      STORE_REGISTRY_FILE,
      JSON.stringify(registry, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Error writing store registry:', error);
    throw error;
  }
}

// Find store by ID
export async function findStoreById(storeId: string): Promise<Store | null> {
  const stores = await readStoreRegistry();
  return stores.find((s) => s.id === storeId) || null;
}

// Create new store
export async function createStore(storeData: {
  name: string;
  shopDomain: string;
  owner: string;
  plan?: 'free' | 'basic' | 'pro';
}): Promise<Store> {
  const stores = await readStoreRegistry();

  // Check if store with same domain exists
  if (stores.find((s) => s.shopDomain === storeData.shopDomain)) {
    throw new Error('Store with this domain already exists');
  }

  const newStore: Store = {
    id: `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: storeData.name,
    shopDomain: storeData.shopDomain,
    owner: storeData.owner,
    status: 'active',
    plan: storeData.plan || 'free',
    createdAt: new Date().toISOString(),
    usersCount: 0,
    messagesCount: 0,
  };

  stores.push(newStore);
  await writeStoreRegistry(stores);

  // Create store directory
  const storeDir = path.join(DATA_DIR, 'stores', newStore.id);
  await fs.mkdir(storeDir, { recursive: true });

  // Initialize users.json
  await fs.writeFile(
    path.join(storeDir, 'users.json'),
    JSON.stringify({ users: [] }, null, 2),
    'utf-8'
  );

  return newStore;
}

// Update store
export async function updateStore(
  storeId: string,
  updates: Partial<Store>
): Promise<Store> {
  const stores = await readStoreRegistry();
  const index = stores.findIndex((s) => s.id === storeId);

  if (index === -1) {
    throw new Error('Store not found');
  }

  stores[index] = { ...stores[index], ...updates };
  await writeStoreRegistry(stores);

  return stores[index];
}

// Delete store
export async function deleteStore(storeId: string): Promise<void> {
  const stores = await readStoreRegistry();
  const filtered = stores.filter((s) => s.id !== storeId);

  if (filtered.length === stores.length) {
    throw new Error('Store not found');
  }

  await writeStoreRegistry(filtered);

  // Optionally delete store directory (or keep for audit)
  // const storeDir = path.join(DATA_DIR, 'stores', storeId);
  // await fs.rm(storeDir, { recursive: true });
}

// Get store statistics
export async function getStoreStats(storeId: string): Promise<{
  usersCount: number;
  messagesCount: number;
  lastSync?: string;
}> {
  const storeDir = path.join(DATA_DIR, 'stores', storeId);
  let usersCount = 0;

  try {
    const usersFile = path.join(storeDir, 'users.json');
    const usersData = await fs.readFile(usersFile, 'utf-8');
    const parsed = JSON.parse(usersData);
    usersCount = (parsed.users || []).length;
  } catch {
    // File doesn't exist
  }

  // TODO: Calculate actual message count from campaigns/journeys
  const messagesCount = 0;

  return {
    usersCount,
    messagesCount,
  };
}

