'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import PlanCard from '@/components/billing/PlanCard';
import UsageDashboard from '@/components/billing/UsageDashboard';
import PaymentHistory from '@/components/billing/PaymentHistory';
import CouponInput from '@/components/billing/CouponInput';
import RazorpayCheckout from '@/components/billing/RazorpayCheckout';
import { useTenant } from '@/lib/tenant/tenant-context';
import { Loader2, AlertTriangle, XCircle } from 'lucide-react';

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
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [discount, setDiscount] = useState<{ discountType: string; value: number; code: string } | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate days until expiry
  const daysUntilExpiry = currentSubscription?.currentPeriodEnd
    ? Math.ceil(
        (new Date(currentSubscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
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
    setDiscount(null);
    setError(null);
    setCheckoutDialogOpen(true);
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
          couponCode: discount ? discount.code : undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.error || `Checkout failed (HTTP ${response.status})`;
        const step = data?.step ? ` [step: ${data.step}]` : '';
        setError(`${errorMsg}${step}`);
        return;
      }

      if (data?.gateway === 'free') {
        setCheckoutDialogOpen(false);
        alert(data.message || 'Free plan activated!');
        window.location.reload();
        return;
      }

      if (data?.gateway === 'razorpay' && data.razorpayOrderId) {
        setCheckoutDialogOpen(false);
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

  const selectedPlan = selectedPlanId ? plans.find((p) => p.planId === selectedPlanId) : null;
  const originalPrice = selectedPlan
    ? Number(currency === 'INR' ? (selectedPlan.priceINR || 0) : (selectedPlan.price || 0))
    : 0;
  const discountAmt = discount
    ? discount.discountType === 'PERCENTAGE'
      ? (originalPrice * Number(discount.value) / 100)
      : Number(discount.value)
    : 0;
  const finalPrice = Math.max(0, originalPrice - discountAmt);
  const currSymbol = currency === 'INR' ? '₹' : '$';

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
        <Badge variant="outline" className="text-sm px-3 py-1">₹ INR</Badge>
      </div>

      {/* Expiry Warning Banners */}
      {isExpired && currentSubscription && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-5 py-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Your plan has expired</p>
            <p className="text-sm text-red-700 mt-1">
              Your <strong>{currentSubscription.planName}</strong> plan expired on{' '}
              {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}.
              Renew now to continue using all features.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white shrink-0"
            onClick={() => {
              if (currentSubscription.planId) handleSubscribe(currentSubscription.planId);
            }}
          >
            Renew Now
          </Button>
        </div>
      )}

      {isExpiringSoon && !isExpired && currentSubscription && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Your plan expires soon</p>
            <p className="text-sm text-amber-700 mt-1">
              Your <strong>{currentSubscription.planName}</strong> plan expires in{' '}
              <strong>{daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</strong> (on{' '}
              {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}).
              Renew to avoid interruption.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            onClick={() => {
              if (currentSubscription.planId) handleSubscribe(currentSubscription.planId);
            }}
          >
            Renew Now
          </Button>
        </div>
      )}

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
                    currentSubscription.status === 'ACTIVE'
                      ? 'bg-green-500'
                      : currentSubscription.status === 'PAST_DUE'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
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

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>Review your plan and complete checkout</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Plan Summary */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedPlan?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing Cycle</span>
                <span className="font-medium capitalize">{selectedPlan?.billingCycle || 'Monthly'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">{currSymbol}{originalPrice.toFixed(2)}</span>
              </div>
              {selectedPlan && (
                <>
                  <div className="border-t pt-2 mt-2 text-xs text-muted-foreground space-y-1">
                    <p>{selectedPlan.messagesPerMonth?.toLocaleString() || '0'} messages/month</p>
                    <p>{selectedPlan.campaignsPerMonth || '0'} campaigns/month</p>
                    {selectedPlan.whatsappAutomation && <p>WhatsApp Automation</p>}
                    {selectedPlan.advancedSegmentation && <p>Advanced Segmentation</p>}
                  </div>
                </>
              )}
            </div>

            {/* Coupon */}
            <CouponInput onApply={setDiscount} planId={selectedPlanId || ''} />

            {/* Discount Summary */}
            {discount && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Price:</span>
                  <span className="line-through text-gray-400">{currSymbol}{originalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Discount ({discount.code}):</span>
                  <span className="text-green-700">-{currSymbol}{discountAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-green-200 pt-1 mt-1">
                  <span>You Pay:</span>
                  <span className="text-green-700">{currSymbol}{finalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${currSymbol}${(discount ? finalPrice : originalPrice).toFixed(2)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Razorpay Checkout (renders hidden, auto-opens modal) */}
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
