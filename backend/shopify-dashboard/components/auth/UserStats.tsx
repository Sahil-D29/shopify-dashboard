'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Mail, Loader2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

interface UserStatsData {
  total: number;
  googleUsers: number;
  credentialUsers: number;
}

export default function UserStats() {
  const [stats, setStats] = useState<UserStatsData>({
    total: 0,
    googleUsers: 0,
    credentialUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/users/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch user stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-4">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border border-gray-200 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <p className="text-xs text-gray-500 mt-1">All registered users</p>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Google Users</CardTitle>
          <div className="p-2 bg-red-50 rounded-lg">
            <FcGoogle className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{stats.googleUsers}</div>
          <p className="text-xs text-gray-500 mt-1">Signed in with Google</p>
          {stats.total > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-400 to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.googleUsers / stats.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {((stats.googleUsers / stats.total) * 100).toFixed(1)}% of total
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Email Users</CardTitle>
          <div className="p-2 bg-blue-100 rounded-lg">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{stats.credentialUsers}</div>
          <p className="text-xs text-gray-500 mt-1">Email/password accounts</p>
          {stats.total > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.credentialUsers / stats.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {((stats.credentialUsers / stats.total) * 100).toFixed(1)}% of total
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

