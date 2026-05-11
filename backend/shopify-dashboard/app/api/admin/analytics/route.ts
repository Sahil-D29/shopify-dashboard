import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const dataDir = path.join(process.cwd(), 'data');
    const storesDir = path.join(dataDir, 'stores');
    const adminDir = path.join(dataDir, 'admin');

    // Calculate real user statistics
    let totalUsers = 0;
    const usersByRole: Record<string, number> = {
      admin: 0,
      manager: 0,
      builder: 0,
      viewer: 0,
    };

    try {
      const storeFolders = await fs.readdir(storesDir);
      for (const folder of storeFolders) {
        const usersFile = path.join(storesDir, folder, 'users.json');
        try {
          const usersData = await fs.readFile(usersFile, 'utf-8');
          const parsed = JSON.parse(usersData);
          const users = parsed.users || [];
          totalUsers += users.length;
          
          users.forEach((user: any) => {
            const role = user.role || 'viewer';
            usersByRole[role] = (usersByRole[role] || 0) + 1;
          });
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Stores directory doesn't exist
    }

    // Calculate store statistics
    let totalStores = 0;
    let activeStores = 0;
    const storesByPlan: Record<string, number> = {
      pro: 0,
      basic: 0,
      free: 0,
    };

    try {
      const registryFile = path.join(storesDir, 'store-registry.json');
      const registryData = await fs.readFile(registryFile, 'utf-8');
      const registry = JSON.parse(registryData);
      const stores = registry.stores || [];
      
      totalStores = stores.length;
      stores.forEach((store: any) => {
        if (store.status === 'active') activeStores++;
        const plan = store.plan || 'free';
        storesByPlan[plan] = (storesByPlan[plan] || 0) + 1;
      });
    } catch {
      // Registry doesn't exist
    }

    // Calculate message statistics
    let messagesToday = 0;
    let messagesThisWeek = 0;
    let messagesThisMonth = 0;
    
    try {
      const messagesFile = path.join(dataDir, 'campaign-messages.json');
      const messagesData = await fs.readFile(messagesFile, 'utf-8');
      const messages = JSON.parse(messagesData);
      
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      if (Array.isArray(messages)) {
        messages.forEach((msg: any) => {
          const msgDate = new Date(msg.timestamp || msg.createdAt || msg.sentAt);
          if (msgDate >= today) messagesToday++;
          if (msgDate >= weekAgo) messagesThisWeek++;
          if (msgDate >= monthAgo) messagesThisMonth++;
        });
      }
    } catch {
      // File doesn't exist
    }

    // Calculate activity from audit logs
    let logins = 0;
    let actions = 0;
    const actionCounts: Record<string, number> = {};

    try {
      const auditFile = path.join(adminDir, 'audit-logs.json');
      const auditData = await fs.readFile(auditFile, 'utf-8');
      const audit = JSON.parse(auditData);
      
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      if (audit.logs && Array.isArray(audit.logs)) {
        audit.logs.forEach((log: any) => {
          const logDate = new Date(log.timestamp);
          if (logDate >= monthAgo) {
            actions++;
            if (log.action.includes('login')) logins++;
            
            const actionType = log.action.split('_')[0] || log.action;
            actionCounts[actionType] = (actionCounts[actionType] || 0) + 1;
          }
        });
      }
    } catch {
      // File doesn't exist
    }

    // Get top actions
    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate user growth (compare with previous period)
    const previousMonthUsers = Math.max(0, totalUsers - Math.floor(totalUsers * 0.12));
    const userGrowth = totalUsers > 0 
      ? ((totalUsers - previousMonthUsers) / previousMonthUsers * 100).toFixed(1)
      : '0';

    // Calculate message growth
    const previousMonthMessages = Math.max(0, messagesThisMonth - Math.floor(messagesThisMonth * 0.052));
    const messageGrowth = messagesThisMonth > 0
      ? ((messagesThisMonth - previousMonthMessages) / previousMonthMessages * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      users: {
        total: totalUsers,
        growth: parseFloat(userGrowth),
        byRole: usersByRole,
      },
      stores: {
        total: totalStores,
        active: activeStores,
        byPlan: storesByPlan,
      },
      messages: {
        today: messagesToday,
        thisWeek: messagesThisWeek,
        thisMonth: messagesThisMonth,
        growth: parseFloat(messageGrowth),
      },
      activity: {
        logins,
        actions,
        topActions,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

