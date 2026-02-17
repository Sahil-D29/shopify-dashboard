'use client';

import { useEffect, useRef } from 'react';

interface RazorpayCheckoutProps {
  orderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
  planName: string;
  planId: string;
  storeId: string;
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function RazorpayCheckout({
  orderId,
  razorpayKeyId,
  amount,
  currency,
  planName,
  planId,
  storeId,
  onSuccess,
  onFailure,
}: RazorpayCheckoutProps) {
  const scriptLoaded = useRef(false);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;

    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          scriptLoaded.current = true;
          resolve(true);
        };
        script.onerror = () => {
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    const openRazorpayCheckout = async () => {
      const loaded = await loadRazorpayScript();

      if (!loaded) {
        onFailure('Failed to load Razorpay checkout');
        return;
      }

      if (!window.Razorpay) {
        onFailure('Razorpay SDK not available');
        return;
      }

      opened.current = true;

      const options = {
        key: razorpayKeyId,
        order_id: orderId,
        amount,
        currency,
        name: 'DOREC.IN',
        description: `${planName} Plan - Monthly Subscription`,
        theme: {
          color: '#5459AC',
        },
        handler: async function (response: any) {
          // Verify payment on server
          try {
            const verifyRes = await fetch(`/api/billing/verify-payment?storeId=${storeId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId,
              }),
            });
            const data = await verifyRes.json();
            if (data.success) {
              onSuccess();
            } else {
              onFailure(data.error || 'Payment verification failed');
            }
          } catch {
            onFailure('Failed to verify payment with server');
          }
        },
        modal: {
          ondismiss: function () {
            opened.current = false;
            onFailure('Payment cancelled by user');
          },
        },
        prefill: {},
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (response: any) {
        opened.current = false;
        console.error('Payment failed:', response);
        onFailure(response.error?.description || 'Payment failed');
      });

      razorpayInstance.open();
    };

    if (orderId && razorpayKeyId) {
      openRazorpayCheckout();
    }
  }, [orderId, razorpayKeyId, amount, currency, planName, planId, storeId, onSuccess, onFailure]);

  return null;
}
