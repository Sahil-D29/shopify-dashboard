'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Discount {
  discountType: string;
  value: number;
}

interface CouponInputProps {
  onApply: (discount: Discount) => void;
  planId: string;
}

export default function CouponInput({ onApply, planId }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Please enter a coupon code' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/billing/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), planId }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        const discountText =
          data.discountType === 'PERCENTAGE'
            ? `${data.value}% discount applied`
            : `₹${data.value} discount applied`;
        setMessage({ type: 'success', text: discountText });
        onApply({ discountType: data.discountType, value: data.value });
      } else {
        setMessage({ type: 'error', text: data.message || 'Invalid coupon code' });
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setMessage({ type: 'error', text: 'Failed to validate coupon code' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="coupon">Coupon Code</Label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          type="text"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleApply} disabled={loading || !code.trim()}>
          {loading ? 'Applying...' : 'Apply'}
        </Button>
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
