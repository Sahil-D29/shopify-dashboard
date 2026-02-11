// Store configuration management utilities
import { getWindowStorage } from './window-storage';

export interface ShopifyConfig {
  shopUrl: string;
  accessToken: string;
  apiKey: string;
  apiSecret: string;
}

const CONFIG_STORAGE_KEY = 'shopify_store_config';

export class StoreConfigManager {
  /**
   * Get store configuration from window.storage
   */
  static getConfig(): ShopifyConfig | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const storage = getWindowStorage();
      const config = storage.getJSON<ShopifyConfig>(CONFIG_STORAGE_KEY);
      
      // Validate the configuration
      if (this.isValidConfig(config)) {
        return config;
      }
      
      return null;
    } catch (error) {
      console.error('Error reading store config:', error);
      return null;
    }
  }

  /**
   * Save store configuration to window.storage
   */
  static saveConfig(config: ShopifyConfig): void {
    if (typeof window === 'undefined') return;
    
    try {
      if (!this.isValidConfig(config)) {
        throw new Error('Invalid configuration');
      }

      const storage = getWindowStorage();
      storage.setJSON(CONFIG_STORAGE_KEY, config);

      // Clear any cached data
      const keysToRemove = [
        'dashboard_cache',
        'customers_cache',
        'products_cache',
        'orders_cache',
        'analytics_cache',
      ];
      
      keysToRemove.forEach(key => {
        storage.remove(key);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(key);
        }
      });
      
      // Dispatch storage event to notify other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: CONFIG_STORAGE_KEY,
        newValue: JSON.stringify(config),
        url: window.location.href,
      }));

      // Dispatch custom event for same-tab detection
      window.dispatchEvent(new CustomEvent('shopify-config-changed', {
        detail: config,
      }));
      
      console.log('✅ Configuration saved and caches cleared');
    } catch (error) {
      console.error('Error saving store config:', error);
      throw error;
    }
  }

  /**
   * Clear stored configuration
   */
  static clearConfig(): void {
    if (typeof window === 'undefined') return;
    const storage = getWindowStorage();
    storage.remove(CONFIG_STORAGE_KEY);
  }

  /**
   * Validate shop URL format
   */
  static validateShopUrl(shopUrl: string): boolean {
    // Must end with .myshopify.com
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    return pattern.test(shopUrl);
  }

  /**
   * Validate configuration object
   */
  static isValidConfig(config: unknown): config is ShopifyConfig {
    if (!config || typeof config !== 'object') return false;
    const candidate = config as Partial<ShopifyConfig>;
    return (
      typeof candidate.shopUrl === 'string' &&
      typeof candidate.accessToken === 'string' &&
      typeof candidate.apiKey === 'string' &&
      typeof candidate.apiSecret === 'string' &&
      candidate.shopUrl.length > 0 &&
      candidate.accessToken.length > 0 &&
      candidate.apiKey.length > 0 &&
      candidate.apiSecret.length > 0 &&
      this.validateShopUrl(candidate.shopUrl)
    );
  }

  /**
   * Get default configuration from environment variables
   */
  static getDefaultConfig(): ShopifyConfig | null {
    // This would be used as fallback if no custom config is set
    if (typeof window === 'undefined') {
      // Server-side, return null as we can't access env vars from client
      return null;
    }
    
    return null;
  }

  /**
   * Mark setup as completed (stores in localStorage)
   */
  static markSetupCompleted(): void {
    if (typeof window === 'undefined') return;
    try {
      const storage = getWindowStorage();
      storage.set('setup_completed', 'true');
      storage.set('setup_completed_at', new Date().toISOString());
      console.log('✅ Setup marked as completed');
    } catch (error) {
      console.error('Error marking setup as complete:', error);
    }
  }

  /**
   * Check if setup is completed
   */
  static isSetupCompleted(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const storage = getWindowStorage();
      return storage.get('setup_completed') === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear setup completion status
   */
  static clearSetupCompleted(): void {
    if (typeof window === 'undefined') return;
    try {
      const storage = getWindowStorage();
      storage.remove('setup_completed');
      storage.remove('setup_completed_at');
    } catch (error) {
      console.error('Error clearing setup completion:', error);
    }
  }
}

