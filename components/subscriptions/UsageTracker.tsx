"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, TrendingUp, MessageSquare, Zap, Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface UsageMetrics {
  metrics: {
    usage: {
      messagesSent: number;
      campaignsCreated: number;
      apiCalls: number;
    };
    limits: {
      messagesPerMonth: number;
      campaignsPerMonth: number;
      apiCallsPerMonth: number;
    };
  };
  percentages: {
    messages: number;
    campaigns: number;
    apiCalls: number;
  };
  limitExceeded: {
    exceeded: boolean;
    type?: string;
  };
  planFeatures: any;
  subscription: {
    planType: string;
    status: string;
  };
}

interface UsageTrackerProps {
  storeId: string;
}

export function UsageTracker({ storeId }: UsageTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageMetrics | null>(null);

  useEffect(() => {
    loadUsage();
  }, [storeId]);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/usage?storeId=${storeId}`);
      if (res.ok) {
        const usageData = await res.json();
        setData(usageData);
      } else {
        throw new Error('Failed to load usage data');
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
      toast.error('Failed to load usage metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>No usage data available</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { metrics, percentages, limitExceeded, subscription } = data;
  const isPro = subscription.planType === 'pro';
  const isUnlimited = (limit: number) => limit === -1;

  const UsageBar = ({ 
    label, 
    used, 
    limit, 
    percentage, 
    icon: Icon 
  }: { 
    label: string; 
    used: number; 
    limit: number; 
    percentage: number;
    icon: any;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {isUnlimited(limit) ? (
            <span className="text-green-600">Unlimited</span>
          ) : (
            `${used.toLocaleString()} / ${limit.toLocaleString()}`
          )}
        </span>
      </div>
      {!isUnlimited(limit) && (
        <>
          <Progress value={percentage} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <span className={percentage >= 80 ? 'text-orange-600' : 'text-muted-foreground'}>
              {percentage >= 80 && percentage < 100 && '⚠️ Approaching limit'}
              {percentage >= 100 && '🚫 Limit exceeded'}
            </span>
            <span className="text-muted-foreground">{percentage}% used</span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage & Limits</CardTitle>
              <CardDescription>
                Current usage for {subscription.planType.toUpperCase()} plan
              </CardDescription>
            </div>
            <Badge variant={isPro ? 'default' : 'secondary'}>
              {subscription.planType.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {limitExceeded.exceeded && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You've reached your {limitExceeded.type} limit. 
                {!isPro && (
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-2"
                    onClick={() => window.location.href = '/subscription/upgrade'}
                  >
                    Upgrade to Pro
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <UsageBar
            label="Messages"
            used={metrics.usage.messagesSent}
            limit={metrics.limits.messagesPerMonth}
            percentage={percentages.messages}
            icon={MessageSquare}
          />

          <UsageBar
            label="Campaigns"
            used={metrics.usage.campaignsCreated}
            limit={metrics.limits.campaignsPerMonth}
            percentage={percentages.campaigns}
            icon={Rocket}
          />

          <UsageBar
            label="API Calls"
            used={metrics.usage.apiCalls}
            limit={metrics.limits.apiCallsPerMonth}
            percentage={percentages.apiCalls}
            icon={Zap}
          />

          {!isPro && (
            <div className="pt-4 border-t">
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Upgrade to Pro for unlimited usage</span>
                    <Button
                      size="sm"
                      onClick={() => window.location.href = '/subscription/upgrade'}
                    >
                      Upgrade Now
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

