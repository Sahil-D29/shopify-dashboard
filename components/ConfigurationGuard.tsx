'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { StoreConfigManager } from '@/lib/store-config';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfigurationGuardProps {
  children: React.ReactNode;
  requireConfig?: boolean;
  useSetupFlow?: boolean; // New prop to enable enhanced setup flow check
}

/**
 * Configuration Guard Component
 * Checks authentication first, then redirects unconfigured users to settings
 * Uses isMounted to prevent hydration mismatches
 * 
 * Enhanced with optional setup flow check (checks both Shopify AND WhatsApp)
 */
export function ConfigurationGuard({ 
  children, 
  requireConfig = true,
  useSetupFlow = false // Default to false for backward compatibility
}: ConfigurationGuardProps) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();
  
  // Use enhanced setup status hook if enabled
  const setupStatus = useSetupStatus(useSetupFlow);
  const isConfiguredEnhanced = useSetupFlow ? setupStatus.setupCompleted : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;

    // Wait for session to be determined
    if (status === 'loading') return;

    // If user is NOT authenticated, don't do anything - let middleware handle redirect
    // This prevents the settings redirect from interfering with sign-out
    if (status === 'unauthenticated') {
      // User is not logged in - middleware will redirect to sign-in
      return;
    }

    if (!requireConfig) {
      const frame = requestAnimationFrame(() => setIsConfigured(true));
      return () => cancelAnimationFrame(frame);
    }

    // If using enhanced setup flow, let useSetupStatus handle the check
    if (useSetupFlow) {
      // The hook handles redirects automatically, just track the status
      if (!setupStatus.loading) {
        setIsConfigured(setupStatus.setupCompleted);
      }
      return;
    }

    // Original logic: Check only Shopify config
    const frame = requestAnimationFrame(() => {
      const config = StoreConfigManager.getConfig();
      const configured = !!(config?.shopUrl && config?.accessToken);
      setIsConfigured(configured);
    });

    return () => cancelAnimationFrame(frame);
  }, [isMounted, pathname, router, searchParams, requireConfig, status, useSetupFlow, setupStatus]);

  // Show loading during initial check or while session is loading
  if (!isMounted || isConfigured === null || status === 'loading' || (useSetupFlow && setupStatus.loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show nothing (middleware will redirect)
  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // If config not required, always render children
  if (!requireConfig) {
    return <>{children}</>;
  }

  // Show setup prompt if not configured
  if (!isConfigured && pathname !== '/settings') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <CardTitle>Connect Your Shopify Store</CardTitle>
            </div>
            <CardDescription>
              You need to connect your Shopify store before you can use the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Head over to Settings to connect your Shopify store and configure WhatsApp.
              Once connected, your dashboard will be ready to use.
            </p>
            <Link href="/settings?setup=true">
              <Button className="w-full">
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render children only when configured and mounted
  return <>{children}</>;
}
