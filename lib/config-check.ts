import { StoreConfigManager, ShopifyConfig } from './store-config';
import { getWindowStorage } from './window-storage';

/**
 * Check if Shopify store is configured
 * Returns true if all required credentials are present and valid
 */
export function isConfigured(): boolean {
  const config = StoreConfigManager.getConfig();
  return config !== null && StoreConfigManager.isValidConfig(config);
}

/**
 * Get the store configuration if available
 * Returns null if not configured
 */
export function getStoreConfig(): ShopifyConfig | null {
  return StoreConfigManager.getConfig();
}

/**
 * Check if localStorage is available
 * Useful for handling edge cases where localStorage might be disabled
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storage = getWindowStorage();
    const testKey = '__window_storage_healthcheck__';
    storage.set(testKey, '1');
    storage.remove(testKey);
    return true;
  } catch {
    return false;
  }
}

