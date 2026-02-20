'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlanCard from '@/components/billing/PlanCard';
import UsageDashboard from '@/components/billing/UsageDashboard';
import PaymentHistory from '@/components/billing/PaymentHistory';
import CouponInput from '@/components/billing/CouponInput';
import RazorpayCheckout from '@/components/billing/RazorpayCheckout';
import { useTenant } from '@/lib/tenant/tenant-context';
import { Loader2 } from 'lucide-react';

interface Plan {
  planId: string;
  name: string;
  price: number;
  priceINR: number;
  billingCycle: string;
  messagesPerMonth: number;
  campaignsPerMonth: number;
  analytics: boolean;
  support: string;
  whatsappAutomation: boolean;
  customTemplates: boolean;
  advancedSegmentation: boolean;
}

interface Subscription {
  id: string;
  status: string;
  planId: string;
  planName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface CheckoutResponse {
  gateway: 'razorpay' | 'stripe' | 'free';
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount?: number;
  currency?: string;
  planName?: string;
  planId?: string;
  storeId?: string;
  sessionUrl?: string;
  message?: string;
}

export default function BillingPage() {
  const { currentStore, isLoading: tenantLoading } = useTenant();
  const storeId = currentStore?.id || null;
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<{ discountType: string; value: number } | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch plans (public, no storeId needed)
        const plansRes = await fetch('/api/billing/plans');
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          const rawPlans = plansData.plans || [];
          setPlans(rawPlans.map((p: Record<string, unknown>) => ({
            ...p,
            price: p.priceUSD ?? p.price ?? 0,
            priceINR: p.priceINR ?? 0,
          })));
        }

        // Fetch subscription using storeId from tenant context
        if (storeId) {
          const subRes = await fetch(`/api/billing/subscription?storeId=${storeId}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            if (subData.subscription) {
              setCurrentSubscription(subData.subscription);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching billing data:', err);
        setError('Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    if (!tenantLoading) {
      fetchData();
    }
  }, [storeId, tenantLoading]);

  const handleSubscribe = async (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) return;

    if (!storeId) {
      setError('No store found. Please set up your store in Settings before subscribing.');
      return;
    }

    setError(null);
    setCheckoutLoading(true);

    try {
      const selectedPlan = plans.find((p) => p.planId === selectedPlanId);
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-store-id': storeId,
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle: selectedPlan?.billingCycle || 'monthly',
          currency,
          storeId,
          couponCode: discount ? discount.discountType : undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.error || `Checkout failed (HTTP ${response.status})`;
        const step = data?.step ? ` [step: ${data.step}]` : '';
        console.error('Checkout error:', { status: response.status, data });
        setError(`${errorMsg}${step}`);
        return;
      }

      if (data?.gateway === 'free') {
        alert(data.message || 'Free plan activated!');
        window.location.reload();
        return;
      }

      if (data?.gateway === 'razorpay' && data.razorpayOrderId) {
        setCheckoutData(data);
        return;
      }

      if (data?.gateway === 'stripe' && data.sessionUrl) {
        window.location.href = data.sessionUrl;
        return;
      }

      setError('Unexpected response from checkout. Please try again.');
    } catch (err) {
      console.error('Error during checkout:', err);
      setError(`Checkout request failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setCheckoutData(null);
    setSelectedPlanId(null);
    setDiscount(null);
    alert('Payment successful! Your subscription has been activated.');
    window.location.reload();
  };

  const handlePaymentFailure = (failError: string) => {
    setCheckoutData(null);
    alert(`Payment failed: ${failError}`);
  };

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Loading billing information...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <div className="flex gap-2">
          <Button
            variant={currency === 'INR' ? 'default' : 'outline'}
            onClick={() => setCurrency('INR')}
          >
            ₹ INR
          </Button>
          <Button
            variant={currency === 'USD' ? 'default' : 'outline'}
            onClick={() => setCurrency('USD')}
          >
            $ USD
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">{currentSubscription.planName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  className={
                    currentSubscription.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500'
                  }
                >
                  {currentSubscription.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Billing Date</p>
                <p className="font-medium">
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="usage">Usage & Costs</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          {plans.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No plans available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.planId}
                  plan={plan}
                  isCurrentPlan={currentSubscription?.planId === plan.planId}
                  currency={currency}
                  onSubscribe={handleSubscribe}
                />
              ))}
            </div>
          )}

          {selectedPlanId && (
            <Card>
              <CardHeader>
                <CardTitle>Complete Your Subscription</CardTitle>
                <CardDescription>
                  You selected: {plans.find((p) => p.planId === selectedPlanId)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CouponInput onApply={setDiscount} planId={selectedPlanId} />
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <Button
                  onClick={handleCheckout}
                  className="w-full"
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Checkout'
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage">
          {storeId ? (
            <UsageDashboard storeId={storeId} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Subscribe to a plan to see usage analytics.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {storeId ? (
            <PaymentHistory storeId={storeId} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No payment history yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {checkoutData?.gateway === 'razorpay' && checkoutData.razorpayOrderId && checkoutData.razorpayKeyId && (
        <RazorpayCheckout
          orderId={checkoutData.razorpayOrderId}
          razorpayKeyId={checkoutData.razorpayKeyId}
          amount={checkoutData.amount || 0}
          currency={checkoutData.currency || 'INR'}
          planName={checkoutData.planName || ''}
          planId={checkoutData.planId || ''}
          storeId={checkoutData.storeId || storeId || ''}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
        />
      )}
    </div>
  );
}
