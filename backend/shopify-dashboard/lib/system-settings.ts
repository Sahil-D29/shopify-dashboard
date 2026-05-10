import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'admin', 'system-settings.json');

export interface SystemSettings {
  systemName: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  featureFlags: {
    multiStore: boolean;
    userRoles: boolean;
    rfmSegmentation: boolean;
    predictiveAnalytics: boolean;
  };
  security: {
    sessionTimeout: number;
    require2FA: boolean;
    ipWhitelist: string[];
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumber: boolean;
  };
  api: {
    rateLimit: number;
    rateLimitWindow: number;
  };
  updatedAt: string;
}

const defaultSettings: SystemSettings = {
  systemName: 'Shopify Marketing Dashboard',
  supportEmail: 'support@yourdomain.com',
  supportPhone: '',
  maintenanceMode: false,
  featureFlags: {
    multiStore: true,
    userRoles: true,
    rfmSegmentation: false,
    predictiveAnalytics: false,
  },
  security: {
    sessionTimeout: 30,
    require2FA: false,
    ipWhitelist: [],
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
  },
  api: {
    rateLimit: 1000,
    rateLimitWindow: 3600,
  },
  updatedAt: new Date().toISOString(),
};

// Read system settings
export async function readSystemSettings(): Promise<SystemSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return { ...defaultSettings, ...parsed };
  } catch (error) {
    // File doesn't exist, return defaults
    return defaultSettings;
  }
}

// Write system settings
export async function writeSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await readSystemSettings();
  const updated: SystemSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  const adminDir = path.join(DATA_DIR, 'admin');
  await fs.mkdir(adminDir, { recursive: true });

  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(updated, null, 2),
    'utf-8'
  );

  return updated;
}

