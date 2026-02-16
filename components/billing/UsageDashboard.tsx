'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageData {
  messagesSent: number;
  messagesLimit: number;
  campaignsUsed: number;
  dailyCosts: Array<{ date: string; cost: number }>;
}

interface Subscription {
  plan: {
    messagesPerMonth: number;
  };
}

interface UsageDashboardProps {
  storeId: string;
}

export default function UsageDashboard({ storeId }: UsageDashboardProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usageRes, subRes] = await Promise.all([
          fetch(`/api/billing/usage?storeId=${storeId}`),
          fetch(`/api/billing/subscription?storeId=${storeId}`),
        ]);

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData);
        }

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
        }
      } catch (error) {
        console.error('Error fetching usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeId]);

  if (loading) {
    return <div>Loading usage data...</div>;
  }

  if (!usage) {
    return <div>Unable to load usage data</div>;
  }

  const messagesLimit = subscription?.plan?.messagesPerMonth || usage.messagesLimit || 1000;
  const messagesSent = usage.messagesSent || 0;
  const usagePercentage = (messagesSent / messagesLimit) * 100;
  const messageMarkupCost = messagesSent * 0.1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Message Usage</CardTitle>
          <CardDescription>
            {messagesSent.toLocaleString()} of {messagesLimit.toLocaleString()} messages used this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={usagePercentage} className="h-2" />
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Messages sent:</span>
              <span className="font-medium">{messagesSent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Message markup cost:</span>
              <span className="font-medium">
                ₹0.10 × {messagesSent.toLocaleString()} = ₹{messageMarkupCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Campaigns used:</span>
              <span className="font-medium">{usage.campaignsUsed}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {usage.dailyCosts && usage.dailyCosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Message Cost Trend</CardTitle>
            <CardDescription>Message costs over the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usage.dailyCosts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${value}`} />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Cost']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line type="monotone" dataKey="cost" stroke="#5459AC" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
