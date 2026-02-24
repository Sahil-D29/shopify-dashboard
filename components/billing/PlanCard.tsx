'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

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

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  currency: 'INR' | 'USD';
  onSubscribe: (planId: string) => void;
}

export default function PlanCard({ plan, isCurrentPlan, currency, onSubscribe }: PlanCardProps) {
  const displayPrice = plan.priceINR || plan.price;
  const currencySymbol = '₹';

  const features = [
    { label: `${plan.messagesPerMonth.toLocaleString()} messages/month`, included: true },
    { label: `${plan.campaignsPerMonth} campaigns/month`, included: true },
    { label: 'Analytics', included: plan.analytics },
    { label: `${plan.support} support`, included: true },
    { label: 'WhatsApp Automation', included: plan.whatsappAutomation },
    { label: 'Custom Templates', included: plan.customTemplates },
    { label: 'Advanced Segmentation', included: plan.advancedSegmentation },
  ];

  return (
    <Card className={isCurrentPlan ? 'border-green-500 border-2' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {isCurrentPlan && (
            <Badge variant="default" className="bg-green-500">
              Current Plan
            </Badge>
          )}
        </div>
        <CardDescription>
          <span className="text-3xl font-bold text-foreground">
            {currencySymbol}
            {displayPrice.toLocaleString()}
          </span>
          <span className="text-muted-foreground">/{plan.billingCycle}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              {feature.included ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className={feature.included ? '' : 'text-muted-foreground line-through'}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          onClick={() => onSubscribe(plan.planId)}
          disabled={isCurrentPlan}
          variant={isCurrentPlan ? 'outline' : 'default'}
        >
          {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
        </Button>
      </CardContent>
    </Card>
  );
}
