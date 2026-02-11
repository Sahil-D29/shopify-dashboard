"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, UserMinus, Shield, Key, LogIn, LogOut, Activity, Loader2 } from 'lucide-react';
// Simple date formatter - no external dependency needed
const formatDistanceToNow = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  return 'just now';
};

interface ActivityLog {
  id: string;
  userId: string;
  storeId: string;
  action: string;
  details: any;
  timestamp: string;
  ipAddress?: string;
}

interface ActivityLogViewerProps {
  storeId: string;
}

const ACTION_ICONS: Record<string, any> = {
  user_invited: UserPlus,
  user_removed: UserMinus,
  role_changed: Shield,
  permissions_updated: Key,
  invitation_accepted: LogIn,
  invitation_cancelled: LogOut,
};

const ACTION_LABELS: Record<string, string> = {
  user_invited: 'User Invited',
  user_removed: 'User Removed',
  role_changed: 'Role Changed',
  permissions_updated: 'Permissions Updated',
  invitation_accepted: 'Invitation Accepted',
  invitation_cancelled: 'Invitation Cancelled',
};

export function ActivityLogViewer({ storeId }: ActivityLogViewerProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userIdFilter, setUserIdFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [storeId, page, actionFilter]);

  const loadLogs = async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }
      
      if (userIdFilter) {
        params.append('userId', userIdFilter);
      }

      const res = await fetch(`/api/teams/${storeId}/activity-logs?${params}`);
      if (!res.ok) throw new Error('Failed to load activity logs');
      
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Activity Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by user ID..."
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="w-48"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.keys(ACTION_LABELS).map(action => (
                  <SelectItem key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No activity logs found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const Icon = ACTION_ICONS[log.action] || Activity;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{ACTION_LABELS[log.action] || log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.userId}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {log.details && typeof log.details === 'object' ? (
                            <pre className="text-xs bg-muted p-2 rounded">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          ) : (
                            <span>{String(log.details || '-')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

