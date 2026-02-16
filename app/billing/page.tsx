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
  plan: {
    name: string;
  };
  status: string;
  currentPeriodEnd: string;
}

interface CheckoutResponse {
  gateway: 'razorpay' | 'stripe';
  subscriptionId?: string;
  razorpayKeyId?: string;
  sessionUrl?: string;
}

export default function BillingPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<{ discountType: string; value: number } | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);

  useEffect(() => {
    const fetchStoreId = async () => {
      try {
        const response = await fetch('/api/store/current');
        if (response.ok) {
          const data = await response.json();
          setStoreId(data.storeId);
        }
      } catch (error) {
        console.error('Error fetching store ID:', error);
      }
    };

    fetchStoreId();
  }, []);

  useEffect(() => {
    if (!storeId) return;

    const fetchData = async () => {
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch('/api/billing/plans'),
          fetch(`/api/billing/subscription?storeId=${storeId}`),
        ]);

        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans(plansData);
        }

        if (subRes.ok) {
          const subData = await subRes.json();
          setCurrentSubscription(subData);
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeId]);

  const handleSubscribe = async (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleCheckout = async () => {
    if (!selectedPlanId || !storeId) return;

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanId,
          currency,
          storeId,
          couponCode: discount ? discount.discountType : null,
        }),
      });

      if (response.ok) {
        const data: CheckoutResponse = await response.json();
        setCheckoutData(data);

        if (data.gateway === 'stripe' && data.sessionUrl) {
          window.location.href = data.sessionUrl;
        }
      } else {
        console.error('Checkout failed');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
    }
  };

  const handlePaymentSuccess = () => {
    setCheckoutData(null);
    setSelectedPlanId(null);
    setDiscount(null);
    alert('Payment successful! Your subscription has been activated.');
    window.location.reload();
  };

  const handlePaymentFailure = (error: string) => {
    setCheckoutData(null);
    alert(`Payment failed: ${error}`);
  };

  if (loading) {
    return <div className="p-8">Loading billing information...</div>;
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

      {currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">{currentSubscription.plan.name}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.planId}
                plan={plan}
                isCurrentPlan={currentSubscription?.plan?.name === plan.name}
                currency={currency}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>

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
                <Button onClick={handleCheckout} className="w-full">
                  Proceed to Checkout
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage">
          {storeId && <UsageDashboard storeId={storeId} />}
        </TabsContent>

        <TabsContent value="payments">
          {storeId && <PaymentHistory storeId={storeId} />}
        </TabsContent>
      </Tabs>

      {checkoutData?.gateway === 'razorpay' && checkoutData.subscriptionId && checkoutData.razorpayKeyId && (
        <RazorpayCheckout
          subscriptionId={checkoutData.subscriptionId}
          razorpayKeyId={checkoutData.razorpayKeyId}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
        />
      )}
    </div>
  );
}
