'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PendingPayment {
  id: string;
  requestedAmount: number;
  uniqueAmount: number;
  status: string;
  upiId: string;
  upiUrl: string;
  expiresAt: string;
  createdAt: string;
  resolvedAt: string | null;
  adminNote: string | null;
}

const BENEFITS = [
  'Browse all companion profiles',
  'View full bios, photos, and rates',
  'Send booking requests to any companion',
  'Priority support',
];

type Step = 'info' | 'pay' | 'waiting' | 'result' | 'active';

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('info');
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState('');
  const [subStatus, setSubStatus] = useState<{ status: string; daysRemaining?: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Check subscription status & pending payment on mount ─────
  const checkStatus = useCallback(async () => {
    try {
      const [statusRes, paymentRes] = await Promise.all([
        fetch('/api/subscription/status'),
        fetch('/api/subscription/manual-payment'),
      ]);

      if (statusRes.ok) {
        const d = await statusRes.json();
        if (d.data?.status === 'ACTIVE') {
          setSubStatus(d.data);
          setStep('active');
          setLoading(false);
          return;
        }
      }

      if (paymentRes.ok) {
        const d = await paymentRes.json();
        if (d.data?.payment) {
          const p: PendingPayment = d.data.payment;
          setPayment(p);
          if (p.status === 'PENDING') {
            setStep('pay');
          } else if (p.status === 'APPROVED') {
            setStep('active');
            // Refresh subscription status
            const freshStatus = await fetch('/api/subscription/status');
            if (freshStatus.ok) {
              const sd = await freshStatus.json();
              setSubStatus(sd.data);
            }
          }
        }
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // ─── Countdown Timer ──────────────────────────────────────────
  useEffect(() => {
    if (!payment || payment.status !== 'PENDING') {
      setCountdown('');
      return;
    }
    const update = () => {
      const remaining = new Date(payment.expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('00:00');
        setPayment(prev => prev ? { ...prev, status: 'EXPIRED' } : null);
        setStep('result');
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [payment]);

  // ─── Poll for status while waiting ────────────────────────────
  useEffect(() => {
    if (step !== 'waiting' || !payment || payment.status !== 'PENDING') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch('/api/subscription/manual-payment');
        const data = await res.json();
        if (data.success && data.data.payment) {
          const p: PendingPayment = data.data.payment;
          if (p.status !== 'PENDING') {
            setPayment(p);
            setStep('result');
            if (p.status === 'APPROVED') {
              const freshStatus = await fetch('/api/subscription/status');
              if (freshStatus.ok) {
                const sd = await freshStatus.json();
                setSubStatus(sd.data);
              }
            }
          }
        }
      } catch { /* non-fatal */ }
    };
    pollRef.current = setInterval(poll, 10000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [step, payment]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleSubscribe = async () => {
    // If there's an active PENDING payment, show it
    if (payment && payment.status === 'PENDING' && new Date(payment.expiresAt) > new Date()) {
      setStep('pay');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/manual-payment', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to create payment. Please try again.');
        return;
      }
      setPayment(data.data);
      setStep('pay');

      // Auto-open UPI intent
      setTimeout(() => {
        try { window.location.href = data.data.upiUrl; } catch { /* ignore */ }
      }, 600);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenUpi = () => {
    if (!payment) return;
    window.location.href = payment.upiUrl;
  };

  const handleIvePaid = () => {
    setStep('waiting');
  };

  const handleDismiss = () => {
    setPayment(null);
    setStep('info');
    setError('');
    checkStatus();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    }).catch(() => {});
  };

  const fmtExact = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── Already Active ───────────────────────────────────────────
  if (step === 'active') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-elevated to-charcoal border border-white/5 p-6 text-center space-y-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mt-4">You&apos;re subscribed!</h2>
            <p className="text-white/50 text-sm mt-2">
              Full access to all companion profiles
              {subStatus?.daysRemaining ? ` · ${subStatus.daysRemaining} days remaining` : ' for 30 days'}.
            </p>
            <button
              onClick={() => router.push('/client/browse')}
              className="mt-5 w-full bg-gold text-charcoal text-sm font-semibold py-3 rounded-xl hover:bg-gold-hover transition-colors"
            >
              Browse All Companions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Payment Step ─────────────────────────────────────────────
  if (step === 'pay' && payment && payment.status === 'PENDING') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Complete Subscription Payment</h3>
            <button onClick={handleDismiss} className="text-white/30 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Unique amount */}
          <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-center">
            <p className="text-xs text-white/50 mb-1">Pay exactly this amount</p>
            <p className="text-3xl font-bold text-gold">{fmtExact(payment.uniqueAmount)}</p>
            <button
              onClick={() => copyToClipboard((payment.uniqueAmount / 100).toFixed(2), 'amount')}
              className="mt-2 text-xs text-gold/70 hover:text-gold transition-colors"
            >
              {copied === 'amount' ? 'Copied!' : 'Tap to copy amount'}
            </button>
          </div>

          {/* Plan info */}
          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
            <p className="text-xs text-white/50">Plus One Premium · 30 days</p>
          </div>

          {/* UPI ID row */}
          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">UPI ID</p>
              <p className="text-sm text-white font-mono mt-0.5">{payment.upiId}</p>
            </div>
            <button
              onClick={() => copyToClipboard(payment.upiId, 'upi')}
              className="text-gold text-xs font-medium px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors"
            >
              {copied === 'upi' ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Pay Now */}
          <button
            onClick={handleOpenUpi}
            className="w-full bg-gold text-black text-sm font-semibold py-3.5 rounded-xl hover:bg-gold-hover transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Pay {fmtExact(payment.uniqueAmount)} via UPI
          </button>

          {/* Manual instructions */}
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Or pay manually</p>
            <p className="text-xs text-white/50">
              Open any UPI app (PhonePe, GPay, Paytm, etc.) → Send Money → Enter UPI ID above → Enter exact amount → Pay
            </p>
          </div>

          {/* I've paid */}
          <button
            onClick={handleIvePaid}
            className="w-full border border-white/10 text-white text-sm py-3 rounded-xl hover:border-gold/30 hover:text-gold transition-colors font-medium"
          >
            I&apos;ve completed the payment
          </button>

          <p className="text-center text-xs text-white/20">
            Payment window: {countdown} remaining
          </p>
        </div>
      </div>
    );
  }

  // ─── Waiting Step ─────────────────────────────────────────────
  if (step === 'waiting' && payment && payment.status === 'PENDING') {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-5 text-center py-8">
          {/* Animated timer ring */}
          <div className="relative w-28 h-28 mx-auto">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="#C9A96E"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={(() => {
                  const total = 15 * 60 * 1000;
                  const remaining = Math.max(0, new Date(payment.expiresAt).getTime() - Date.now());
                  return (1 - remaining / total) * 2 * Math.PI * 44;
                })()}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white font-mono">{countdown}</span>
            </div>
          </div>

          <div>
            <p className="text-white font-semibold">Verifying your payment</p>
            <p className="text-white/40 text-xs mt-1.5 max-w-xs mx-auto">
              We&apos;re checking for your payment of{' '}
              <span className="text-gold font-medium">{fmtExact(payment.uniqueAmount)}</span>.
              This usually takes a few minutes.
            </p>
          </div>

          {/* Pulsing dots */}
          <div className="flex items-center justify-center gap-1.5">
            {[0, 300, 600].map(delay => (
              <div key={delay} className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>

          <button
            onClick={() => setStep('pay')}
            className="text-sm text-gold font-medium hover:underline"
          >
            View payment details again
          </button>

          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-xs text-white/30">
              If not verified within 15 minutes, you can try again. If you already paid, contact support.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Result Step ──────────────────────────────────────────────
  if (step === 'result' && payment) {
    if (payment.status === 'APPROVED') {
      return (
        <div className="max-w-md mx-auto py-8">
          <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-4 text-center py-8">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold">Subscription Activated!</p>
            <p className="text-white/40 text-xs">Your Plus One Premium membership is now active for 30 days.</p>
            <button
              onClick={() => router.push('/client/browse')}
              className="w-full bg-gold text-black text-sm font-semibold py-3 rounded-xl hover:bg-gold-hover transition-colors"
            >
              Browse Companions
            </button>
          </div>
        </div>
      );
    }

    if (payment.status === 'REJECTED') {
      return (
        <div className="max-w-md mx-auto py-8">
          <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-4 text-center py-8">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white font-semibold">Payment Not Verified</p>
            <p className="text-white/40 text-xs">{payment.adminNote || 'We could not verify your payment. If you already paid, please contact support.'}</p>
            <button onClick={handleDismiss} className="w-full bg-gold text-black text-sm font-semibold py-3 rounded-xl hover:bg-gold-hover transition-colors">
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // EXPIRED
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-4 text-center py-8">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold">Payment window expired</p>
          <p className="text-white/40 text-xs">The 15-minute window has ended. Please start a new payment.</p>
          <button onClick={handleDismiss} className="w-full bg-gold text-black text-sm font-semibold py-3 rounded-xl hover:bg-gold-hover transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Handle expired during pay step
  if (step === 'pay' && payment && payment.status === 'EXPIRED') {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-5 space-y-4 text-center py-8">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold">Payment window expired</p>
          <p className="text-white/40 text-xs">The 15-minute window has ended. Please start a new payment.</p>
          <button onClick={handleDismiss} className="w-full bg-gold text-black text-sm font-semibold py-3 rounded-xl hover:bg-gold-hover transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Info / Default ───────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gold-subtle" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-gold/[0.05] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative px-5 pt-8 pb-6 text-center">
          <h1 className="text-[26px] font-bold text-white leading-[1.2]">
            Plus One <span className="text-gold-gradient">Premium</span>
          </h1>
          <p className="text-white/35 text-sm mt-2">Unlock all companion profiles</p>
        </div>
      </div>

      {/* Price card */}
      <div className="rounded-2xl bg-charcoal-surface border border-white/5 p-6 space-y-6">
        <div className="text-center py-3 border-b border-white/[0.06]">
          <p className="text-4xl font-bold text-gold">₹4,999</p>
          <p className="text-white/40 text-sm mt-1">per month</p>
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
              <span className="text-white/70 text-sm">{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="bg-white/[0.03] rounded-xl p-3 text-xs text-white/35">
          Subscription is for profile browsing only. Chat and call time is billed
          separately from your wallet — pay only for what you use.
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSubscribe}
          disabled={creating}
          className="w-full bg-gold text-charcoal text-sm font-bold py-3.5 rounded-xl hover:bg-gold-hover active:scale-[0.97] transition-all shadow-gold-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
              Creating payment...
            </>
          ) : (
            'Subscribe Now — ₹4,999/month'
          )}
        </button>
      </div>
    </div>
  );
}
