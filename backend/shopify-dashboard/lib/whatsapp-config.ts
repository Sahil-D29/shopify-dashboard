'use client';

import { getWindowStorage } from './window-storage';

export interface WhatsAppConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  connectedPhoneNumber?: string;
  isVerified: boolean;
  configuredAt: number;
}

export class WhatsAppConfigManager {
  private static STORAGE_KEY = 'whatsapp_config';

  static getConfig(): WhatsAppConfig | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const storage = getWindowStorage();
      return storage.getJSON<WhatsAppConfig>(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to get WhatsApp config:', error);
      return null;
    }
  }

  static saveConfig(config: WhatsAppConfig): void {
    if (typeof window === 'undefined') return;
    
    try {
      const configWithTimestamp = {
        ...config,
        configuredAt: Date.now(),
      };
      const storage = getWindowStorage();
      storage.setJSON(this.STORAGE_KEY, configWithTimestamp);
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: this.STORAGE_KEY,
        newValue: JSON.stringify(configWithTimestamp),
      }));
      
      console.log('✅ WhatsApp config saved successfully');
    } catch (error) {
      console.error('Failed to save WhatsApp config:', error);
      throw error;
    }
  }

  static clearConfig(): void {
    if (typeof window === 'undefined') return;
    const storage = getWindowStorage();
    storage.remove(this.STORAGE_KEY);
    console.log('WhatsApp config cleared');
  }

  static isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config?.wabaId && config?.phoneNumberId && config?.accessToken);
  }

  // Initialize with environment variables (for development)
  static initializeFromEnv(): void {
    if (typeof window === 'undefined') return;
    
    // Check if already configured
    if (this.isConfigured()) {
      console.log('WhatsApp already configured');
      return;
    }

    // For development: auto-configure from env (frontend can't access process.env directly)
    // This will be set via API call
    console.log('WhatsApp needs configuration - use Settings page');
  }
}

