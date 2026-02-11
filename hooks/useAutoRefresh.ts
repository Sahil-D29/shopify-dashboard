import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  interval?: number; // Default: 30000ms (30 seconds)
  enabled?: boolean; // Default: true
  onError?: (error: Error) => void;
}

/**
 * Hook for auto-refreshing data with debouncing and rate limiting
 * Prevents concurrent requests and handles errors gracefully
 */
export function useAutoRefresh(
  callback: () => Promise<void>,
  options: UseAutoRefreshOptions = {}
) {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onError,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const callbackRef = useRef(callback);
  const enabledRef = useRef(enabled);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Keep enabled ref updated
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const refresh = useCallback(async () => {
    // Prevent concurrent requests
    if (isLoadingRef.current) {
      return;
    }

    // Don't refresh if disabled
    if (!enabledRef.current) {
      return;
    }

    isLoadingRef.current = true;
    try {
      await callbackRef.current();
    } catch (error) {
      console.error('[useAutoRefresh] Error during refresh:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [onError]);

  useEffect(() => {
    if (!enabled) {
      // Clear interval if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial load
    refresh();

    // Set up interval
    intervalRef.current = setInterval(() => {
      refresh();
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, refresh]);

  // Return manual refresh function
  return {
    refresh,
    isRefreshing: isLoadingRef.current,
  };
}
