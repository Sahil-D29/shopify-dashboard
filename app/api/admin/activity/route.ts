export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const dataDir = path.join(process.cwd(), 'data');
    const adminDir = path.join(dataDir, 'admin');
    const storesDir = path.join(dataDir, 'stores');

    const activities: Array<{
      type: string;
      message: string;
      timestamp: string;
      status: string;
    }> = [];

    // Get recent audit logs
    try {
      const auditFile = path.join(adminDir, 'audit-logs.json');
      const auditData = await fs.readFile(auditFile, 'utf-8');
      const audit = JSON.parse(auditData);
      
      if (audit.logs && Array.isArray(audit.logs)) {
        // Get last 10 activities
        const recentLogs = audit.logs.slice(0, 10);
        
        recentLogs.forEach((log: any) => {
          const logDate = new Date(log.timestamp);
          const timeAgo = getTimeAgo(logDate);
          
          let message = '';
          let status = 'info';
          
          if (log.action.includes('store_created') || log.action.includes('store_connected')) {
            message = `New store "${log.details?.name || 'Unknown'}" connected`;
            status = 'success';
          } else if (log.action.includes('user_created')) {
            message = `User "${log.details?.email || 'Unknown'}" registered`;
            status = 'info';
          } else if (log.action.includes('api') && log.status === 'failed') {
            message = `API rate limit warning: ${log.details?.store || 'System'}`;
            status = 'warning';
          } else if (log.action.includes('subscription')) {
            message = `Store subscription expired: ${log.details?.store || 'Unknown'}`;
            status = 'error';
          } else {
            message = `${log.action.replace(/_/g, ' ')}`;
            status = log.status === 'failed' ? 'error' : 'success';
          }
          
          activities.push({
            type: log.action,
            message,
            timestamp: `${timeAgo}`,
            status,
          });
        });
      }
    } catch {
      // File doesn't exist, use empty array
    }

    // If no activities from audit logs, get from store registry
    if (activities.length === 0) {
      try {
        const registryFile = path.join(storesDir, 'store-registry.json');
        const registryData = await fs.readFile(registryFile, 'utf-8');
        const registry = JSON.parse(registryData);
        const stores = registry.stores || [];
        
        stores.slice(0, 5).forEach((store: any) => {
          const storeDate = new Date(store.createdAt);
          const timeAgo = getTimeAgo(storeDate);
          
          activities.push({
            type: 'store_created',
            message: `Store "${store.name}" connected`,
            timestamp: timeAgo,
            status: store.status === 'active' ? 'success' : 'warning',
          });
        });
      } catch {
        // Ignore errors
      }
    }

    return NextResponse.json({ activities });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Activity error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

