'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Store, MessageSquare, TrendingUp, Activity } from 'lucide-react';

interface AnalyticsData {
  users: {
    total: number;
    growth: number;
    byRole: Record<string, number>;
  };
  stores: {
    total: number;
    active: number;
    byPlan: Record<string, number>;
  };
  messages: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number;
  };
  activity: {
    logins: number;
    actions: number;
    topActions: Array<{ action: string; count: number }>;
  };
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch real data from API
      const response = await fetch('/api/admin/analytics');
      if (response.ok) {
        const realData = await response.json();
        setData(realData);
      } else {
        // Fallback to empty data if API fails
        setData({
          users: { total: 0, growth: 0, byRole: {} },
          stores: { total: 0, active: 0, byPlan: {} },
          messages: { today: 0, thisWeek: 0, thisMonth: 0, growth: 0 },
          activity: { logins: 0, actions: 0, topActions: [] },
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div 
            className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
            style={{ borderColor: '#5459AC' }}
          ></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          System-wide analytics and insights
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-5 w-5" style={{ color: '#5459AC' }} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.users.total}</div>
                <p className="text-xs text-green-600 mt-1">+{data.users.growth}% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
                <Store className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stores.active}</div>
                <p className="text-xs text-gray-500 mt-1">of {data.stores.total} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
                <MessageSquare className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.messages.today.toLocaleString()}</div>
                <p className="text-xs text-green-600 mt-1">+{data.messages.growth}% growth</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
                <Activity className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.activity.actions.toLocaleString()}</div>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Distribution by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.users.byRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="capitalize font-medium">{role}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-48 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${(count / data.users.total) * 100}%`,
                            backgroundColor: '#5459AC'
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Store Distribution by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.stores.byPlan).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="capitalize font-medium">{plan}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-48 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(count / data.stores.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Login Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.activity.logins}</div>
                <p className="text-sm text-gray-500 mt-1">Total logins this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.activity.actions}</div>
                <p className="text-sm text-gray-500 mt-1">Total actions this month</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.activity.topActions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {item.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="text-sm text-gray-600">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

