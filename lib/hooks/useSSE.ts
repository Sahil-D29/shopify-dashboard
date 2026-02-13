'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SSEEvent, SSEEventType } from '@/lib/types/chat';

interface UseSSEOptions {
  storeId: string | null;
  enabled?: boolean;
  onMessage?: (event: SSEEvent) => void;
}

interface UseSSEReturn {
  lastEvent: SSEEvent | null;
  isConnected: boolean;
  reconnect: () => void;
}

const MAX_RETRY_DELAY = 30000; // 30 seconds
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function useSSE({ storeId, enabled = true, onMessage }: UseSSEOptions): UseSSEReturn {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref up to date
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!storeId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const url = `/api/chat/sse?storeId=${encodeURIComponent(storeId)}`;
      const es = new EventSource(url);

      es.onopen = () => {
        setIsConnected(true);
        retryDelayRef.current = INITIAL_RETRY_DELAY; // Reset retry delay on successful connection
      };

      es.onmessage = (event) => {
        try {
          const parsed: SSEEvent = JSON.parse(event.data);
          if (parsed.type === 'heartbeat') return; // Ignore heartbeats

          setLastEvent(parsed);
          onMessageRef.current?.(parsed);
        } catch (err) {
          console.warn('[SSE] Failed to parse event:', err);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff retry
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      eventSourceRef.current = es;
    } catch (err) {
      console.error('[SSE] Failed to connect:', err);
      setIsConnected(false);
    }
  }, [storeId, enabled]);

  const reconnect = useCallback(() => {
    retryDelayRef.current = INITIAL_RETRY_DELAY;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect]);

  return { lastEvent, isConnected, reconnect };
}
