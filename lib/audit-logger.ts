import fs from 'fs/promises';
import path from 'path';

const AUDIT_LOG_FILE = path.join(process.cwd(), 'data', 'audit.log');

export interface AuditLogEntry {
  timestamp: string;
  userId: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
}

/**
 * Log an audit event
 */
export async function logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  const logEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    // Ensure directory exists
    const dataDir = path.dirname(AUDIT_LOG_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Append to log file
    await fs.appendFile(AUDIT_LOG_FILE, logLine, 'utf-8');
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - audit logging shouldn't break the app
  }
}

/**
 * Read recent audit logs
 */
export async function getRecentAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  try {
    const content = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    return lines
      .slice(-limit)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AuditLogEntry => entry !== null)
      .reverse();
  } catch (error) {
    // File doesn't exist yet
    return [];
  }
}

/**
 * Search audit logs by criteria
 */
export async function searchAuditLogs(criteria: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const logs = await getRecentAuditLogs(criteria.limit || 1000);
  
  return logs.filter(log => {
    if (criteria.userId && log.userId !== criteria.userId) return false;
    if (criteria.action && log.action !== criteria.action) return false;
    if (criteria.resource && log.resource !== criteria.resource) return false;
    
    if (criteria.startDate || criteria.endDate) {
      const logDate = new Date(log.timestamp);
      if (criteria.startDate && logDate < criteria.startDate) return false;
      if (criteria.endDate && logDate > criteria.endDate) return false;
    }
    
    return true;
  });
}


