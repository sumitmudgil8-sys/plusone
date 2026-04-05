'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type PageState = 'info' | 'pending' | 'success';

interface PaymentData {
  setuPaymentId: string;
  upiLink: string | null;
  qrCode: string | null;
  shortUrl: string | null;
  expiresAt: string;
}

const BENEFITS = [
  'Browse all companion profiles',
  'View full bios, photos, and rates',
  'Send booking requests to any companion',
  'Priority support',
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>('info');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLL = 120; // 10 min at 5s intervals

  // Check if already subscribed on mount
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/subscription/status');
        if (res.ok) {
          const data = await res.json();
          if (data.data?.status === 'ACTIVE') setState('success');
        }
      } catch {
        // non-fatal
      }
    };
    check();
  }, []);

  // Start polling when in 'pending' state
  useEffect(() => {
    if (state !== 'pending') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLL) {
        clearInterval(pollRef.current!);
        setError('Payment timed out. If you completed the payment, please refresh this page.');
        return;
      }

      try {
        const res = await fetch('/api/subscription/status');
        if (res.ok) {
          const data = await res.json();
          if (data.data?.status === 'ACTIVE') {
            clearInterval(pollRef.current!);
            setState('success');
          }
        }
      } catch {
        // non-fatal — keep polling
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state]);

  const handleSubscribe = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to create payment. Please try again.');
        return;
      }
      setPaymentData(data.data);
      setState('pending');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <Card className="text-center space-y-6 py-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">You&apos;re subscribed!</h2>
            <p className="text-white/60 text-sm mt-2">
              Full access to all companion profiles for 30 days.
            </p>
          </div>
          <Button onClick={() => router.push('/client/browse')} className="w-full">
            Browse All Companions
          </Button>
        </Card>
      </div>
    );
  }

  // ── Pending payment state ──────────────────────────────────────────────────
  if (state === 'pending' && paymentData) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Complete Payment</h1>
          <p className="text-white/60 text-sm mt-1">Scan the QR code or use the UPI link</p>
        </div>

        <Card className="space-y-5">
          {/* QR code */}
          {paymentData.qrCode && (
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl">
                <img
                  src={paymentData.qrCode}
                  alt="UPI QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
          )}

          <div className="text-center space-y-1">
            <p className="text-2xl font-bold text-gold">₹2,999</p>
            <p className="text-xs text-white/40">Monthly subscription</p>
          </div>

          {/* UPI deep link */}
          {paymentData.upiLink && (
            <a
              href={paymentData.upiLink}
              className="block w-full py-3 rounded-lg bg-gold text-charcoal font-semibold text-center hover:bg-gold/90 transition-colors"
            >
              Open UPI App
            </a>
          )}

          {paymentData.shortUrl && (
            <p className="text-xs text-center text-white/30 break-all">
              {paymentData.shortUrl}
            </p>
          )}

          {/* Polling indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-white/50">
            <div className="animate-spin h-4 w-4 border-2 border-gold border-t-transparent rounded-full" />
            <span>Waiting for payment confirmation…</span>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            onClick={() => { setState('info'); setPaymentData(null); setError(''); pollCountRef.current = 0; }}
            className="w-full text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
        </Card>
      </div>
    );
  }

  // ── Info / default state ───────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Plus One Membership</h1>
        <p className="text-white/60 text-sm mt-1">Unlock all companion profiles</p>
      </div>

      <Card className="space-y-6">
        {/* Price */}
        <div className="text-center py-4 border-b border-charcoal-border">
          <p className="text-4xl font-bold text-gold">₹2,999</p>
          <p className="text-white/50 text-sm mt-1">per month</p>
        </div>

        {/* Benefits */}
        <ul className="space-y-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-white/80 text-sm">{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Note: wallet is separate */}
        <div className="bg-white/5 rounded-lg p-3 text-xs text-white/40">
          Subscription is for profile browsing only. Chat and call time is billed
          separately from your wallet — pay only for what you use.
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button onClick={handleSubscribe} isLoading={creating} className="w-full">
          Subscribe Now — ₹2,999/month
        </Button>
      </Card>
    </div>
  );
}
