"use client";
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { getKeyId } from '@/lib/payment';
import { RAZORPAY_CONFIG } from '@/lib/constants';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  amount: number;
  type: 'SUBSCRIPTION' | 'BOOKING_DEPOSIT' | 'BOOKING_FULL';
  bookingId?: string;
  metadata?: Record<string, string>;
  onSuccess: () => void;
  onError: (error: string) => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'outline';
}

export function RazorpayButton({
  amount,
  type,
  bookingId,
  metadata,
  onSuccess,
  onError,
  children,
  className,
  variant = 'primary',
}: RazorpayButtonProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    try {
      // Create order
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          type,
          bookingId,
          metadata,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        onError(error.error || 'Failed to create order');
        return;
      }

      const orderData = await res.json();

      // Initialize Razorpay
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: RAZORPAY_CONFIG.name,
        description: RAZORPAY_CONFIG.description,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          if (verifyRes.ok) {
            onSuccess();
          } else {
            onError('Payment verification failed');
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: RAZORPAY_CONFIG.theme,
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', (response: any) => {
        onError(response.error.description || 'Payment failed');
      });
    } catch (error) {
      console.error('Payment error:', error);
      onError('Payment initialization failed');
    }
  };

  return (
    <Button
      onClick={handlePayment}
      variant={variant}
      className={className}
    >
      {children}
    </Button>
  );
}
