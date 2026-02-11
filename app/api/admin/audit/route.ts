import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import fs from 'fs/promises';
import path from 'path';

const AUDIT_LOGS_FILE = path.join(process.cwd(), 'data', 'admin', 'audit-logs.json');

interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string | null;
  status: 'success' | 'failed';
}

// GET /api/admin/audit - Get audit logs
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = request.nextUrl;
    const adminId = searchParams.get('adminId');
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Read audit logs
    let logs: AuditLog[] = [];
    try {
      const data = await fs.readFile(AUDIT_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      logs = parsed.logs || [];
    } catch {
      // File doesn't exist, return empty array
    }

    // Filter logs
    let filtered = logs;

    if (adminId) {
      filtered = filtered.filter((log) => log.adminId === adminId);
    }

    if (action) {
      filtered = filtered.filter((log) => log.action.includes(action));
    }

    if (status) {
      filtered = filtered.filter((log) => log.status === status);
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((log) => new Date(log.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((log) => new Date(log.timestamp) <= end);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pagination
    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginated = filtered.slice(startIndex, endIndex);

    return NextResponse.json({
      logs: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

