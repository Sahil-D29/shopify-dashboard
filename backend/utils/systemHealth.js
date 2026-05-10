// backend/utils/systemHealth.js
import { readFileSafe, writeFileSafe } from './safeFileStore.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const healthFile = path.join(process.cwd(), 'backend', 'data', 'system-health.json');

const DEFAULT_HEALTH = {
  server: {
    startedAt: null,
    uptimeSeconds: 0
  },
  workers: {
    campaign: 'stopped',
    journey: 'stopped'
  },
  shopify: {
    lastTokenCheck: null,
    tokenValid: false,
    lastSuccessfulSync: null
  },
  lastUpdated: null
};

/**
 * Ensures system-health.json exists with valid structure
 * Auto-creates if missing, auto-recovers if corrupted
 */
export async function ensureSystemHealthFileExists() {
  try {
    const existing = await readFileSafe(healthFile, { default: null });
    
    // If file doesn't exist or is invalid, create default
    if (!existing || typeof existing !== 'object') {
      await writeFileSafe(healthFile, DEFAULT_HEALTH);
      return DEFAULT_HEALTH;
    }
    
    // Validate structure - ensure all required fields exist
    const validated = {
      server: {
        startedAt: existing.server?.startedAt ?? null,
        uptimeSeconds: existing.server?.uptimeSeconds ?? 0
      },
      workers: {
        campaign: existing.workers?.campaign ?? 'stopped',
        journey: existing.workers?.journey ?? 'stopped'
      },
      shopify: {
        lastTokenCheck: existing.shopify?.lastTokenCheck ?? null,
        tokenValid: existing.shopify?.tokenValid ?? false,
        lastSuccessfulSync: existing.shopify?.lastSuccessfulSync ?? null
      },
      lastUpdated: existing.lastUpdated ?? null
    };
    
    // If structure was invalid, write corrected version
    if (JSON.stringify(existing) !== JSON.stringify(validated)) {
      await writeFileSafe(healthFile, validated);
    }
    
    return validated;
  } catch (error) {
    console.error('ensureSystemHealthFileExists error:', error.message);
    // Last resort: create default file
    try {
      await writeFileSafe(healthFile, DEFAULT_HEALTH);
    } catch (writeError) {
      console.error('Failed to create default health file:', writeError.message);
    }
    return DEFAULT_HEALTH;
  }
}

/**
 * Get system health - ALWAYS returns valid object structure
 * Never throws, never returns undefined
 */
export async function getSystemHealth() {
  try {
    // Ensure file exists first
    await ensureSystemHealthFileExists();
    
    const health = await readFileSafe(healthFile, { default: DEFAULT_HEALTH });
    
    // Ensure all required fields exist with proper types
    const merged = {
      server: {
        startedAt: health.server?.startedAt ?? null,
        uptimeSeconds: typeof health.server?.uptimeSeconds === 'number' ? health.server.uptimeSeconds : 0
      },
      workers: {
        campaign: health.workers?.campaign ?? 'stopped',
        journey: health.workers?.journey ?? 'stopped'
      },
      shopify: {
        lastTokenCheck: health.shopify?.lastTokenCheck ?? null,
        tokenValid: health.shopify?.tokenValid === true,
        lastSuccessfulSync: health.shopify?.lastSuccessfulSync ?? null
      },
      lastUpdated: health.lastUpdated ?? null
    };
    
    // Calculate uptime if server started
    if (merged.server.startedAt) {
      try {
        const startedAt = new Date(merged.server.startedAt);
        const now = new Date();
        if (!isNaN(startedAt.getTime())) {
          merged.server.uptimeSeconds = Math.floor((now - startedAt) / 1000);
        }
      } catch (dateError) {
        // Invalid date, keep existing uptimeSeconds
      }
    }
    
    return merged;
  } catch (error) {
    console.error('getSystemHealth error:', error.message);
    // ALWAYS return default on any error - never throw
    return DEFAULT_HEALTH;
  }
}

export async function updateSystemHealth(updates) {
  try {
    const current = await getSystemHealth();
    const updated = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    await writeFileSafe(healthFile, updated);
    return updated;
  } catch (error) {
    console.error('updateSystemHealth error:', error.message);
    // Return current state on error, never throw
    return await getSystemHealth();
  }
}

export async function updateWorkerStatus(workerName, status) {
  try {
    const current = await getSystemHealth();
    const updated = {
      ...current,
      workers: {
        ...current.workers,
        [workerName]: status
      },
      lastUpdated: new Date().toISOString()
    };
    
    await writeFileSafe(healthFile, updated);
    return updated;
  } catch (error) {
    console.error(`updateWorkerStatus error for ${workerName}:`, error.message);
    // Return current state on error
    return await getSystemHealth();
  }
}

export async function updateShopifyHealth({ tokenValid, lastSuccessfulSync }) {
  try {
    const current = await getSystemHealth();
    const updated = {
      ...current,
      shopify: {
        lastTokenCheck: new Date().toISOString(),
        tokenValid: tokenValid !== undefined ? (tokenValid === true) : (current.shopify?.tokenValid === true),
        lastSuccessfulSync: lastSuccessfulSync || current.shopify?.lastSuccessfulSync || null
      },
      lastUpdated: new Date().toISOString()
    };
    
    await writeFileSafe(healthFile, updated);
    return updated;
  } catch (error) {
    console.error('updateShopifyHealth error:', error.message);
    // Return current state on error
    return await getSystemHealth();
  }
}

export async function initializeSystemHealth(serverStartedAt) {
  try {
    const health = {
      server: {
        startedAt: serverStartedAt || new Date().toISOString(),
        uptimeSeconds: 0
      },
      workers: {
        campaign: 'stopped',
        journey: 'stopped'
      },
      shopify: {
        lastTokenCheck: null,
        tokenValid: false,
        lastSuccessfulSync: null
      },
      lastUpdated: new Date().toISOString()
    };
    
    await writeFileSafe(healthFile, health);
    return health;
  } catch (error) {
    console.error('initializeSystemHealth error:', error.message);
    // Return default on error, never throw
    return DEFAULT_HEALTH;
  }
}

export async function checkShopifyToken() {
  try {
    const { createShopifyClient } = await import('../config/shopify.js');
    const { readFileSafe } = await import('./safeFileStore.js');
    const path = await import('path');
    
    const shopsFile = path.join(process.cwd(), 'backend', 'shopify-dashboard', 'data', 'shops.json');
    const shops = await readFileSafe(shopsFile, { default: {} });
    
    const shopKeys = Object.keys(shops);
    if (shopKeys.length === 0) {
      await updateShopifyHealth({ tokenValid: false, lastSuccessfulSync: null });
      return { valid: false, reason: 'No shops configured' };
    }
    
    // Test first shop
    const firstShop = shops[shopKeys[0]];
    if (!firstShop || !firstShop.accessToken) {
      await updateShopifyHealth({ tokenValid: false, lastSuccessfulSync: null });
      return { valid: false, reason: 'No access token' };
    }
    
    try {
      const client = await createShopifyClient(firstShop.shop || shopKeys[0]);
      const response = await client.query({ data: '{ shop { name } }' });
      
      if (response.body && response.body.data && response.body.data.shop) {
        await updateShopifyHealth({ 
          tokenValid: true, 
          lastSuccessfulSync: new Date().toISOString() 
        });
        return { valid: true, shopName: response.body.data.shop.name };
      } else {
        await updateShopifyHealth({ tokenValid: false, lastSuccessfulSync: null });
        return { valid: false, reason: 'Invalid response' };
      }
    } catch (apiError) {
      await updateShopifyHealth({ tokenValid: false, lastSuccessfulSync: null });
      return { valid: false, reason: apiError.message || 'API call failed' };
    }
  } catch (error) {
    console.error('checkShopifyToken error:', error.message);
    await updateShopifyHealth({ tokenValid: false, lastSuccessfulSync: null }).catch(() => {});
    return { valid: false, reason: error.message || 'Check failed' };
  }
}
