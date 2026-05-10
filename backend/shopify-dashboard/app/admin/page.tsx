'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Store, Activity, MessageSquare, TrendingUp, Database, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalStores: number;
  activeStores: number;
  messagesToday: number;
  apiCallsToday: number;
  storageUsed: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalStores: 0,
    activeStores: 0,
    messagesToday: 0,
    apiCallsToday: 0,
    storageUsed: '0 GB',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: '#5459AC',
      bgColor: 'rgba(84, 89, 172, 0.1)',
      isCustom: true,
    },
    {
      title: 'Total Stores',
      value: stats.totalStores,
      change: '+1 this month',
      trend: 'up',
      icon: Store,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      isCustom: false,
    },
    {
      title: 'Active Stores',
      value: stats.activeStores,
      change: `${stats.totalStores - stats.activeStores} inactive`,
      trend: stats.activeStores === stats.totalStores ? 'up' : 'down',
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      isCustom: false,
    },
    {
      title: 'Messages Today',
      value: stats.messagesToday.toLocaleString(),
      change: '+5.2%',
      trend: 'up',
      icon: MessageSquare,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      isCustom: false,
    },
    {
      title: 'API Calls',
      value: stats.apiCallsToday.toLocaleString(),
      change: 'Normal',
      trend: 'neutral',
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      isCustom: false,
    },
    {
      title: 'Storage Used',
      value: stats.storageUsed,
      change: 'of 10 GB',
      trend: 'neutral',
      icon: Database,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      isCustom: false,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div 
            className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
            style={{ borderColor: '#5459AC' }}
          ></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          Monitor your system performance and user activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title}
            className="transition-transform hover:scale-[1.01] cursor-default h-full flex flex-col"
            style={{ 
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderRadius: '12px'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div 
                className={`rounded-full p-2.5 ${stat.isCustom ? '' : stat.bgColor}`}
                style={stat.isCustom ? { 
                  backgroundColor: stat.bgColor,
                  borderRadius: '12px'
                } : {
                  borderRadius: '12px'
                }}
              >
                <stat.icon 
                  className={`h-5 w-5 ${stat.isCustom ? '' : stat.color}`}
                  style={stat.isCustom ? { color: stat.color } : undefined}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1.5">
                <span
                  className={
                    stat.trend === 'up'
                      ? 'text-green-600'
                      : stat.trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }
                >
                  {stat.change}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <RecentActivityCard />
    </div>
  );
}

// Recent Activity Component
function RecentActivityCard() {
  const [activities, setActivities] = useState<Array<{
    type: string;
    message: string;
    timestamp: string;
    status: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/admin/activity');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4" style={{ color: '#5459AC' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return '';
    }
  };

  return (
    <Card style={{ 
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      borderRadius: '12px'
    }}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div 
              className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent mx-auto"
              style={{ borderColor: '#5459AC' }}
            ></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No recent activity
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => (
              <div
                key={index}
                className={`flex items-center justify-between py-4 ${
                  index < activities.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{activity.timestamp}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <span 
                    className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                      activity.status === 'success' 
                        ? 'text-green-700 bg-green-50' 
                        : activity.status === 'error'
                        ? 'text-red-700 bg-red-50'
                        : activity.status === 'warning'
                        ? 'text-yellow-700 bg-yellow-50'
                        : 'text-gray-700 bg-gray-50'
                    }`}
                    style={{ 
                      minWidth: '70px',
                      textAlign: 'right',
                      display: 'inline-block'
                    }}
                  >
                    {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

