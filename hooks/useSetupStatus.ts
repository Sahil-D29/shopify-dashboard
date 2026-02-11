'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { StoreConfigManager } from '@/lib/store-config';

interface SetupStatus {
  setupCompleted: boolean;
  shopifyConfigured: boolean;
  whatsappConfigured: boolean;
  loading: boolean;
}

/**
 * Hook to check setup completion status and handle redirects
 * Redirects users to settings if setup is not completed
 * Uses localStorage to persist setup completion status
 */
export function useSetupStatus(enabled: boolean = true) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    setupCompleted: false,
    shopifyConfigured: false,
    whatsappConfigured: false,
    loading: true,
  });
  const router = useRouter();
  const pathname = usePathname();
  const { status: sessionStatus } = useSession();

  // Public paths that don't require setup
  const publicPaths = ['/auth', '/signin', '/signup', '/signout', '/login', '/settings'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  useEffect(() => {
    if (!enabled) {
      setSetupStatus(prev => ({ ...prev, loading: false }));
      return;
    }
    checkSetupStatus();
  }, [enabled, sessionStatus, pathname]);

  const checkSetupStatus = async () => {
    if (!enabled) {
      setSetupStatus(prev => ({ ...prev, loading: false }));
      return;
    }
    // Don't check if on public paths or not authenticated
    if (isPublicPath || sessionStatus === 'unauthenticated' || sessionStatus === 'loading') {
      setSetupStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // First check localStorage for setup completion flag
      let isSetupCompletedLocal = StoreConfigManager.isSetupCompleted();

      // Then check server-side configuration status
      const response = await fetch('/api/settings/setup-status', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[useSetupStatus] Failed to fetch setup status');
        // Fall back to localStorage check
        setSetupStatus({
          setupCompleted: isSetupCompletedLocal,
          shopifyConfigured: false,
          whatsappConfigured: false,
          loading: false,
        });
        return;
      }

      const data = await response.json();

      // If server says setup is completed but local flag is missing, auto-sync it.
      if (data.setupCompleted && !isSetupCompletedLocal) {
        StoreConfigManager.markSetupCompleted();
        isSetupCompletedLocal = true;
      }
      
      // Setup is completed if:
      // 1. It's marked as completed in localStorage (persists across sessions), AND
      // 2. Both configurations are actually configured server-side
      // This ensures setup is only considered complete if both the flag exists AND configs are valid
      const setupCompleted = isSetupCompletedLocal && data.setupCompleted;
      
      const status: SetupStatus = {
        setupCompleted,
        shopifyConfigured: data.shopifyConfigured || false,
        whatsappConfigured: data.whatsappConfigured || false,
        loading: false,
      };

      setSetupStatus(status);

      // Redirect to settings if setup not completed and not already on settings page
      if (!setupCompleted && pathname !== '/settings' && sessionStatus === 'authenticated') {
        const setupParam = new URLSearchParams(window.location.search).get('setup');
        if (!setupParam) {
          router.replace('/settings?setup=true');
        }
      }
    } catch (error) {
      console.error('[useSetupStatus] Error checking setup status:', error);
      // Fall back to localStorage check
      const isSetupCompletedLocal = StoreConfigManager.isSetupCompleted();
      setSetupStatus({
        setupCompleted: isSetupCompletedLocal,
        shopifyConfigured: false,
        whatsappConfigured: false,
        loading: false,
      });
    }
  };

  return {
    ...setupStatus,
    refetch: checkSetupStatus,
  };
}


