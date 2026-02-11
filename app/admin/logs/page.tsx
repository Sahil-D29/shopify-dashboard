'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Shield, CheckCircle, XCircle } from 'lucide-react';

interface AccessLog {
  id: string;
  adminId: string;
  email: string;
  action: 'login' | 'logout' | 'failed_login';
  timestamp: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: 'success' | 'failed';
}

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Fetch from audit logs, filter for auth-related actions
      const response = await fetch('/api/admin/audit?action=login&limit=100');
      if (response.ok) {
        const data = await response.json();
        // Transform audit logs to access logs format
        const accessLogs: AccessLog[] = data.logs
          .filter((log: any) => 
            log.action.includes('login') || log.action.includes('logout')
          )
          .map((log: any) => ({
            id: log.id,
            adminId: log.adminId,
            email: log.details?.email || 'Unknown',
            action: log.action.includes('logout') ? 'logout' : 
                   log.action.includes('failed') ? 'failed_login' : 'login',
            timestamp: log.timestamp,
            ipAddress: log.ipAddress,
            userAgent: null,
            status: log.status,
          }));
        setLogs(accessLogs);
      }
    } catch (error) {
      console.error('Error fetching access logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.email.toLowerCase().includes(query) ||
        log.adminId.toLowerCase().includes(query) ||
        log.ipAddress?.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    return status === 'success' ? (
      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Success
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  };

  const getActionBadge = (action: string) => {
    if (action === 'login') {
      return (
        <Badge 
          className="text-white"
          style={{ 
            backgroundColor: 'rgba(84, 89, 172, 0.15)',
            color: '#5459AC',
            border: '1px solid rgba(84, 89, 172, 0.3)'
          }}
        >
          {action.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      );
    }
    const colors: Record<string, string> = {
      logout: 'bg-gray-100 text-gray-800',
      failed_login: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colors[action] || 'bg-gray-100 text-gray-800'}>
        {action.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Access Logs</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor admin login and access attempts
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by email, admin ID, or IP address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recent Access Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No access logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.email}</p>
                        <p className="text-xs text-gray-500 font-mono">{log.adminId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ipAddress || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.action === 'login' && l.status === 'success').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {logs.filter(l => l.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Unique Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(logs.map(l => l.adminId)).size}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

