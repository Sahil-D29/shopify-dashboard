'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

export interface AppSettingsValue {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportPhone: string;
  supportUrl: string;
  helpDocsUrl: string;
  primaryColor: string;
  accentColor: string;
  couponsEnabled: boolean;
}

export interface StoreFeatureFlagsValue {
  storeId: string | null;
  disabledItems: string[];
  notes: string;
}

interface AppConfigContextValue {
  settings: AppSettingsValue;
  featureFlags: StoreFeatureFlagsValue;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettingsValue = {
  appName: 'dorza.io',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  supportEmail: '',
  supportPhone: '',
  supportUrl: '',
  helpDocsUrl: '',
  primaryColor: '#1a1a2e',
  accentColor: '#e94560',
  couponsEnabled: true,
};

const DEFAULT_FLAGS: StoreFeatureFlagsValue = {
  storeId: null,
  disabledItems: [],
  notes: '',
};

const AppConfigContext = createContext<AppConfigContextValue>({
  settings: DEFAULT_SETTINGS,
  featureFlags: DEFAULT_FLAGS,
  isLoading: true,
  refresh: async () => {},
});

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsValue>(DEFAULT_SETTINGS);
  const [featureFlags, setFeatureFlags] = useState<StoreFeatureFlagsValue>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/app-config', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (data?.featureFlags)
        setFeatureFlags({
          storeId: data.featureFlags.storeId ?? null,
          disabledItems: Array.isArray(data.featureFlags.disabledItems)
            ? data.featureFlags.disabledItems
            : [],
          notes: data.featureFlags.notes ?? '',
        });
    } catch (error) {
      console.warn('[AppConfigProvider] Failed to load config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the visible storeId in localStorage / cookie changes
  // (StoreSwitcher writes to current_store_id cookie + reloads); a short
  // poll is the simplest cross-tab refresh and is cheap.
  useEffect(() => {
    const handler = () => {
      void load();
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [load]);

  const value = useMemo<AppConfigContextValue>(
    () => ({ settings, featureFlags, isLoading, refresh: load }),
    [settings, featureFlags, isLoading, load],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  return useContext(AppConfigContext);
}

/** Convenience hook: is this sidebar item enabled for the current store? */
export function useSidebarItemEnabled(itemKey: string): boolean {
  const { featureFlags } = useAppConfig();
  return !featureFlags.disabledItems.includes(itemKey);
}
