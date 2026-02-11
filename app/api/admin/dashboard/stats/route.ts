import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdmin(request);

    const dataDir = path.join(process.cwd(), 'data');
    const storesDir = path.join(dataDir, 'stores');

    // Count total users across all stores
    let totalUsers = 0;
    let totalStores = 0;
    let activeStores = 0;

    try {
      const storeFolders = await fs.readdir(storesDir);
      totalStores = storeFolders.length;

      for (const folder of storeFolders) {
        const usersFile = path.join(storesDir, folder, 'users.json');
        try {
          const usersData = await fs.readFile(usersFile, 'utf-8');
          const parsed = JSON.parse(usersData);
          totalUsers += (parsed.users || []).length;
        } catch {
          // File doesn't exist or invalid, skip
        }

        // Check if store is active (simplified - you can enhance this)
        activeStores++;
      }
    } catch {
      // Stores directory doesn't exist yet
    }

    // Calculate real messages from campaign-messages.json
    let messagesToday = 0;
    let messagesThisWeek = 0;
    try {
      const messagesFile = path.join(dataDir, 'campaign-messages.json');
      const messagesData = await fs.readFile(messagesFile, 'utf-8');
      const messages = JSON.parse(messagesData);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      if (Array.isArray(messages)) {
        messages.forEach((msg: any) => {
          const msgDate = new Date(msg.timestamp || msg.createdAt || msg.sentAt);
          if (msgDate >= today) {
            messagesToday++;
          }
          if (msgDate >= weekAgo) {
            messagesThisWeek++;
          }
        });
      }
    } catch {
      // File doesn't exist or invalid, use 0
      messagesToday = 0;
      messagesThisWeek = 0;
    }

    // Calculate storage used (approximate from file sizes)
    let storageBytes = 0;
    try {
      const calculateDirSize = async (dir: string): Promise<number> => {
        let size = 0;
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              size += await calculateDirSize(fullPath);
            } else {
              const stats = await fs.stat(fullPath);
              size += stats.size;
            }
          }
        } catch {
          // Ignore errors
        }
        return size;
      };
      
      storageBytes = await calculateDirSize(dataDir);
    } catch {
      // Ignore errors
    }

    const storageUsedMB = storageBytes / (1024 * 1024);
    const storageUsed = storageUsedMB > 1024
      ? `${(storageUsedMB / 1024).toFixed(2)} GB`
      : `${storageUsedMB.toFixed(2)} MB`;

    // API calls - count from audit logs
    let apiCallsToday = 0;
    try {
      const auditFile = path.join(dataDir, 'admin', 'audit-logs.json');
      const auditData = await fs.readFile(auditFile, 'utf-8');
      const audit = JSON.parse(auditData);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (audit.logs && Array.isArray(audit.logs)) {
        apiCallsToday = audit.logs.filter((log: any) => {
          const logDate = new Date(log.timestamp);
          return logDate >= today && log.action.includes('api');
        }).length;
      }
    } catch {
      // File doesn't exist, use 0
      apiCallsToday = 0;
    }

    return NextResponse.json({
      totalUsers,
      totalStores,
      activeStores,
      messagesToday,
      apiCallsToday,
      storageUsed,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

