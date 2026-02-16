'use client';

import { useEffect, useRef } from 'react';

interface RazorpayCheckoutProps {
  subscriptionId: string;
  razorpayKeyId: string;
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function RazorpayCheckout({
  subscriptionId,
  razorpayKeyId,
  onSuccess,
  onFailure,
}: RazorpayCheckoutProps) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
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

      const options = {
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: 'DOREC.IN',
        description: 'WhatsApp Marketing Platform',
        theme: {
          color: '#5459AC',
        },
        handler: function (response: any) {
          console.log('Payment successful:', response);
          onSuccess();
        },
        modal: {
          ondismiss: function () {
            onFailure('Payment cancelled by user');
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response);
        onFailure(response.error?.description || 'Payment failed');
      });

      razorpayInstance.open();
    };

    if (subscriptionId && razorpayKeyId) {
      openRazorpayCheckout();
    }
  }, [subscriptionId, razorpayKeyId, onSuccess, onFailure]);

  return null;
}
