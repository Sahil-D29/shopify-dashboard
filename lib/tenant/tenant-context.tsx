'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getWindowStorage } from '@/lib/window-storage';
import type { Store } from '@/lib/store-registry';

interface TenantContextType {
  currentStore: Store | null;
  stores: Store[];
  isLoading: boolean;
  switchStore: (storeId: string) => Promise<void>;
  refreshStores: () => Promise<void>;
  hasAccessToStore: (storeId: string) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const CURRENT_STORE_KEY = 'current_store_id';
const STORES_CACHE_KEY = 'stores_cache';

function setCurrentStoreIdEverywhere(storeId: string) {
  if (typeof window === 'undefined') return;
  const storage = getWindowStorage();
  storage.set(CURRENT_STORE_KEY, storeId);
  // Server-side store resolution relies on cookie (tenant middleware reads it)
  // Keep it long-lived for better UX across sessions.
  document.cookie = `current_store_id=${encodeURIComponent(storeId)}; path=/; max-age=31536000; samesite=lax`;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load stores from API
  const loadStores = useCallback(async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
        
        // Cache stores
        if (typeof window !== 'undefined') {
          const storage = getWindowStorage();
          storage.setJSON(STORES_CACHE_KEY, data.stores || []);
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      // Try to load from cache
      if (typeof window !== 'undefined') {
        const storage = getWindowStorage();
        const cached = storage.getJSON<Store[]>(STORES_CACHE_KEY);
        if (cached) {
          setStores(cached);
        }
      }
    }
  }, []);

  // Load current store with role-based default
  const loadCurrentStore = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const storage = getWindowStorage();
    const currentStoreId = storage.get(CURRENT_STORE_KEY);

    // Try to get user role from API to determine default store
    let userRole: string | null = null;
    let userStoreId: string | null = null;
    try {
      const response = await fetch('/api/user/permissions');
      const data = await response.json();
      if (data.success) {
        userRole = data.permissions?.role || null;
        // For STORE_OWNER and USER, get their assigned store
        if (data.user) {
          // This will be handled by the user context helper
        }
      }
    } catch (error) {
      // Silently fail - will use default behavior
      console.warn('[TenantContext] Failed to get user role:', error);
    }

    if (currentStoreId && stores.length > 0) {
      const store = stores.find(s => s.id === currentStoreId);
      if (store && store.status === 'active') {
        // Ensure cookie is in sync for server/API routes
        setCurrentStoreIdEverywhere(store.id);
        setCurrentStore(store);
        return;
      }
    }

    // If no store selected or invalid, use first active store
    // For ADMIN: can use any store, default to first active
    // For STORE_OWNER/USER: should use their assigned store (handled by API)
    const firstActiveStore = stores.find(s => s.status === 'active');
    if (firstActiveStore) {
      setCurrentStoreIdEverywhere(firstActiveStore.id);
      setCurrentStore(firstActiveStore);
    } else if (stores.length > 0) {
      // Use first store even if inactive (for admin purposes)
      setCurrentStoreIdEverywhere(stores[0].id);
      setCurrentStore(stores[0]);
    }
  }, [stores]);

  // Switch to a different store
  const switchStore = useCallback(async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    if (store.status !== 'active') {
      throw new Error('Store is not active');
    }

    // Save to storage
    if (typeof window !== 'undefined') {
      setCurrentStoreIdEverywhere(storeId);
    }

    setCurrentStore(store);

    // Clear caches
    if (typeof window !== 'undefined') {
      const storage = getWindowStorage();
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
    }

    // Refresh the page to reload data with new store context
    router.refresh();
  }, [stores, router]);

  // Refresh stores list
  const refreshStores = useCallback(async () => {
    await loadStores();
  }, [loadStores]);

  // Check if user has access to a store
  const hasAccessToStore = useCallback((storeId: string): boolean => {
    // For now, if store exists in list, user has access
    // Later, this can check user permissions
    return stores.some(s => s.id === storeId);
  }, [stores]);

  // Initial load - skip on auth/admin pages for performance
  useEffect(() => {
    const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/admin');
    if (isAuthPage) {
      // Don't load stores on auth/admin pages
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      await loadStores();
      setIsLoading(false);
    };
    initialize();
  }, [loadStores, pathname]);

  // Load current store when stores are loaded
  useEffect(() => {
    if (stores.length > 0) {
      loadCurrentStore();
    }
  }, [stores, loadCurrentStore]);

  // Always provide context, even on auth/admin pages
  // This ensures useTenant hook works everywhere
  const value: TenantContextType = {
    currentStore,
    stores,
    isLoading,
    switchStore,
    refreshStores,
    hasAccessToStore,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Hook to get current store ID
export function useCurrentStoreId(): string | null {
  const { currentStore } = useTenant();
  return currentStore?.id || null;
}

// Hook to check if store is loaded
export function useStoreReady(): boolean {
  const { currentStore, isLoading } = useTenant();
  return !isLoading && currentStore !== null;
}

