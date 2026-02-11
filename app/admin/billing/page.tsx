"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  DollarSign, 
  Users, 
  TrendingDown, 
  TrendingUp,
  MoreVertical,
  Download,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Subscription {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  planType: 'basic' | 'pro';
  status: string;
  startDate: string;
  endDate: string;
  price: number;
  billingCycle?: 'monthly' | 'yearly';
  currency: string;
  nextBilling?: string;
}

interface BillingStats {
  totalMRR: number;
  activeSubscriptions: number;
  churnRate: number;
  revenueThisMonth: number;
}

export default function AdminBillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<BillingStats>({
    totalMRR: 0,
    activeSubscriptions: 0,
    churnRate: 0,
    revenueThisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load subscriptions
      const subsRes = await fetch('/api/subscriptions');
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        const subs = subsData.subscriptions || [];
        
        // Load user details for each subscription
        const subsWithUsers = await Promise.all(
          subs.map(async (sub: Subscription) => {
            try {
              const userRes = await fetch(`/api/admin/users/${sub.userId}`);
              if (userRes.ok) {
                const userData = await userRes.json();
                return {
                  ...sub,
                  userName: userData.user?.name || 'Unknown',
                  userEmail: userData.user?.email || 'Unknown'
                };
              }
              return sub;
            } catch {
              return sub;
            }
          })
        );
        
        setSubscriptions(subsWithUsers);
        
        // Calculate stats
        const active = subs.filter((s: Subscription) => s.status === 'active');
        const totalMRR = active.reduce((sum: number, s: Subscription) => {
          const cycle = s.billingCycle ?? 'monthly';
          return sum + (cycle === 'monthly' ? s.price : s.price / 12);
        }, 0);
        
        const cancelled = subs.filter((s: Subscription) => s.status === 'cancelled').length;
        const churnRate = subs.length > 0 ? (cancelled / subs.length) * 100 : 0;
        
        // Calculate revenue this month
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const paymentsRes = await fetch('/api/admin/payments');
        let revenueThisMonth = 0;
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          const payments = paymentsData.payments || [];
          revenueThisMonth = payments
            .filter((p: any) => {
              const paymentDate = new Date(p.createdAt);
              return paymentDate.getMonth() === thisMonth && 
                     paymentDate.getFullYear() === thisYear &&
                     p.status === 'succeeded';
            })
            .reduce((sum: number, p: any) => sum + p.amount, 0);
        }
        
        setStats({
          totalMRR,
          activeSubscriptions: active.length,
          churnRate,
          revenueThisMonth
        });
        
        // Generate revenue chart data (last 6 months)
        const revenueChartData = generateRevenueChartData(subs, paymentsRes.ok ? await paymentsRes.json() : { payments: [] });
        setRevenueData(revenueChartData);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const generateRevenueChartData = (subs: Subscription[], paymentsData: any) => {
    const months: string[] = [];
    const revenue: number[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.push(monthStr);
      
      const monthRevenue = (paymentsData.payments || [])
        .filter((p: any) => {
          const paymentDate = new Date(p.createdAt);
          return paymentDate.getMonth() === date.getMonth() &&
                 paymentDate.getFullYear() === date.getFullYear() &&
                 p.status === 'succeeded';
        })
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      
      revenue.push(monthRevenue);
    }
    
    return months.map((month, i) => ({ month, revenue: revenue[i] }));
  };

  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s => 
          s.userEmail?.toLowerCase().includes(query) ||
          s.userName?.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );
    }
    
    if (planFilter !== 'all') {
      filtered = filtered.filter(s => s.planType === planFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    return filtered;
  }, [subscriptions, searchQuery, planFilter, statusFilter]);

  const paginatedSubscriptions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSubscriptions.slice(start, start + itemsPerPage);
  }, [filteredSubscriptions, currentPage]);

  const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);

  const handleAction = async (action: string, subscriptionId: string) => {
    try {
      if (action === 'upgrade') {
        const res = await fetch(`/api/subscriptions/${subscriptionId}/upgrade`, {
          method: 'PUT'
        });
        if (res.ok) {
          toast.success('Subscription upgraded successfully');
          loadData();
        } else {
          throw new Error('Failed to upgrade');
        }
      } else if (action === 'downgrade') {
        const res = await fetch(`/api/subscriptions/${subscriptionId}/downgrade`, {
          method: 'PUT'
        });
        if (res.ok) {
          toast.success('Subscription downgrade scheduled');
          loadData();
        } else {
          throw new Error('Failed to downgrade');
        }
      } else if (action === 'pause') {
        // Implement pause logic
        toast.info('Pause functionality coming soon');
      } else if (action === 'cancel') {
        const res = await fetch(`/api/stripe/cancel-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId })
        });
        if (res.ok) {
          toast.success('Subscription cancelled');
          loadData();
        } else {
          throw new Error('Failed to cancel');
        }
      }
    } catch (error) {
      toast.error(`Failed to ${action} subscription`);
    }
  };

  const exportToCSV = () => {
    const headers = ['User Email', 'Plan', 'Status', 'Start Date', 'End Date', 'Price', 'Next Billing'];
    const rows = filteredSubscriptions.map(s => [
      s.userEmail || '',
      s.planType,
      s.status,
      new Date(s.startDate).toLocaleDateString(),
      new Date(s.endDate).toLocaleDateString(),
      `$${s.price.toFixed(2)}`,
      s.nextBilling ? new Date(s.nextBilling).toLocaleDateString() : 'N/A'
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Data exported to CSV');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      cancelled: 'destructive',
      past_due: 'destructive',
      downgrade_scheduled: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Management</h1>
          <p className="text-muted-foreground">Manage subscriptions and revenue</p>
        </div>
        <Button onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalMRR.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Cancelled subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.revenueThisMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Current month revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>Monthly revenue over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No subscriptions found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sub.userName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{sub.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sub.planType === 'pro' ? 'default' : 'secondary'}>
                          {sub.planType.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        {sub.nextBilling 
                          ? new Date(sub.nextBilling).toLocaleDateString()
                          : new Date(sub.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>${sub.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {sub.planType === 'basic' && (
                              <DropdownMenuItem onClick={() => handleAction('upgrade', sub.id)}>
                                Upgrade to Pro
                              </DropdownMenuItem>
                            )}
                            {sub.planType === 'pro' && (
                              <DropdownMenuItem onClick={() => handleAction('downgrade', sub.id)}>
                                Downgrade to Basic
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAction('pause', sub.id)}>
                              Pause
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleAction('cancel', sub.id)}
                              className="text-destructive"
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredSubscriptions.length)} of{' '}
                {filteredSubscriptions.length} subscriptions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

