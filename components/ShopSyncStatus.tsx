'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SyncStatusProps {
  shop?: string;
}

export function ShopSyncStatus({ shop }: SyncStatusProps) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'syncing' | 'error'>('disconnected');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!shop) {
      setStatus('disconnected');
      return;
    }

    // Check connection status
    checkStatus();
    
    // Poll every 30 seconds as fallback
    const interval = setInterval(() => {
      checkStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [shop]);

  const checkStatus = async () => {
    if (!shop) return;

    try {
      const res = await fetch(`/api/health`);
      if (res.ok) {
        setStatus('connected');
        // Try to get last sync time from cache metadata
        try {
          const cacheRes = await fetch(`/api/cache/metadata?shop=${encodeURIComponent(shop)}`);
          if (cacheRes.ok) {
            const data = await cacheRes.json();
            if (data.lastUpdated) {
              setLastSync(data.lastUpdated);
            }
          }
        } catch {
          // Ignore cache metadata errors
        }
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const handleRefresh = async () => {
    if (!shop || isRefreshing) return;

    setIsRefreshing(true);
    setStatus('syncing');

    try {
      const res = await fetch(`/api/refresh?shop=${encodeURIComponent(shop)}`, {
        method: 'POST',
      });

      if (res.ok) {
        setStatus('connected');
        setLastSync(Date.now());
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'connected' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {status === 'disconnected' && <AlertCircle className="h-5 w-5 text-gray-400" />}
          {status === 'syncing' && <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
          Sync Status
        </CardTitle>
        <CardDescription>
          {shop ? `Connected to ${shop}` : 'No store connected'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Last synced: {formatLastSync(lastSync)}
            </span>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={!shop || isRefreshing || status === 'syncing'}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


