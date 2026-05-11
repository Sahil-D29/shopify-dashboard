// backend/services/activityLogService.js
import { readFileSafe } from '../utils/fileStorage.js';
import { logActivity } from '../utils/logger.js';

/**
 * Log an activity
 */
export async function logActivityEntry(userId, storeId, action, details, ipAddress = null) {
  return await logActivity({
    userId,
    storeId,
    action,
    details,
    timestamp: new Date().toISOString(),
    ipAddress
  });
}

/**
 * Get activity logs for a store
 */
export async function getActivityLogs(storeId, filters = {}) {
  const data = await readFileSafe('activity-logs.json', { default: [] });
  
  let logs = Array.isArray(data) ? data : [];
  
  // Filter by storeId
  if (storeId) {
    logs = logs.filter(log => log.storeId === storeId);
  }
  
  // Filter by userId if provided
  if (filters.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }
  
  // Filter by action if provided
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  // Filter by date range if provided
  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    logs = logs.filter(log => new Date(log.timestamp) >= startDate);
  }
  
  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    logs = logs.filter(log => new Date(log.timestamp) <= endDate);
  }
  
  // Sort by timestamp (newest first)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Apply pagination
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;
  
  return {
    logs: logs.slice(offset, offset + limit),
    total: logs.length,
    page,
    limit,
    totalPages: Math.ceil(logs.length / limit)
  };
}

/**
 * Get activity logs for a user
 */
export async function getUserActivityLogs(userId, filters = {}) {
  return await getActivityLogs(null, { ...filters, userId });
}

/**
 * Get recent activity logs
 */
export async function getRecentActivityLogs(storeId, limit = 10) {
  const result = await getActivityLogs(storeId, { limit });
  return result.logs;
}

/**
 * Get activity logs by action type
 */
export async function getActivityLogsByAction(storeId, action, filters = {}) {
  return await getActivityLogs(storeId, { ...filters, action });
}

