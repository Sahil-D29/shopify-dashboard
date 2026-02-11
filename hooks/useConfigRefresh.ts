'use client';

import { useEffect, useRef, useCallback } from 'react';
import { StoreConfigManager, ShopifyConfig } from '@/lib/store-config';

/**
 * Custom hook to detect configuration changes and trigger refresh callbacks
 * Uses useRef to avoid infinite loops from useState updates
 */
export function useConfigRefresh(onConfigChange: () => void) {
  const currentConfigRef = useRef<string | null>(null);
  const callbackRef = useRef(onConfigChange);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onConfigChange;
  }, [onConfigChange]);

  // Memoize the callback to prevent recreating on every render
  const stableCallback = useCallback(() => {
    callbackRef.current();
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Set initial config reference (no state update to avoid re-render)
    const initialConfig = StoreConfigManager.getConfig();
    currentConfigRef.current = JSON.stringify(initialConfig);

    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'shopify_store_config') {
        console.log('🔔 Config changed (storage event)');
        const newConfig = StoreConfigManager.getConfig();
        const newConfigStr = JSON.stringify(newConfig);
        
        if (currentConfigRef.current !== newConfigStr) {
          currentConfigRef.current = newConfigStr;
          stableCallback();
        }
      }
    };

    // Also listen for custom events (same-tab)
    const handleCustomStorageChange = () => {
      console.log('🔔 Config changed (custom event)');
      const newConfig = StoreConfigManager.getConfig();
      const newConfigStr = JSON.stringify(newConfig);
      
      if (currentConfigRef.current !== newConfigStr) {
        currentConfigRef.current = newConfigStr;
        stableCallback();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('shopify-config-changed', handleCustomStorageChange);

    // Poll for changes in same tab (fallback)
    const interval = setInterval(() => {
      const newConfig = StoreConfigManager.getConfig();
      const newConfigStr = JSON.stringify(newConfig);
      
      if (currentConfigRef.current !== newConfigStr) {
        console.log('🔔 Config changed (polling)');
        currentConfigRef.current = newConfigStr;
        stableCallback();
      }
    }, 2000); // Check every 2 seconds (reduced from 1 second)

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('shopify-config-changed', handleCustomStorageChange);
      clearInterval(interval);
    };
  }, [stableCallback]); // Only depend on stable callback

  // Return the current config (optional, for components that need it)
  return StoreConfigManager.getConfig();
}

