'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

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

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  // Recharge state
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);

  // Manual payment state
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [countdown, setCountdown] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      if (data.success) {
        setBalance(data.data.balance);
        setTransactions(data.data.transactions);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await fetch(`/api/wallet/transactions?page=${page}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setAllTransactions(data.data.transactions);
        setTxTotal(data.data.total);
        setTxPage(page);
      }
    } catch {
      // non-fatal
    } finally {
      setTxLoading(false);
    }
  }, []);

  // Check for existing pending payment on mount
  const checkPendingPayment = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/manual-recharge');
      const data = await res.json();
      if (data.success && data.data.payment) {
        const payment = data.data.payment;
        if (payment.status === 'PENDING') {
          setPendingPayment(payment);
          setPaymentConfirmed(true);
          setShowRecharge(true);
        } else if (payment.status === 'APPROVED' && payment.resolvedAt) {
          // Recently approved — refresh wallet
          setPendingPayment(payment);
          fetchWallet();
        } else if (payment.status === 'REJECTED') {
          setPendingPayment(payment);
        }
      }
    } catch {
      // non-fatal
    }
  }, [fetchWallet]);

  useEffect(() => {
    fetchWallet();
    checkPendingPayment();
  }, [fetchWallet, checkPendingPayment]);

  // Countdown timer
  useEffect(() => {
    if (!pendingPayment || pendingPayment.status !== 'PENDING') {
      setCountdown('');
      return;
    }

    const update = () => {
      const remaining = new Date(pendingPayment.expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('00:00');
        setPendingPayment((prev) => prev ? { ...prev, status: 'EXPIRED' } : null);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pendingPayment]);

  // Poll for payment status every 15 seconds when waiting
  useEffect(() => {
    if (!paymentConfirmed || !pendingPayment || pendingPayment.status !== 'PENDING') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch('/api/wallet/manual-recharge');
        const data = await res.json();
        if (data.success && data.data.payment) {
          const p = data.data.payment;
          if (p.status !== 'PENDING') {
            setPendingPayment(p);
            if (p.status === 'APPROVED') {
              fetchWallet();
            }
          }
        }
      } catch {
        // non-fatal
      }
    };

    pollRef.current = setInterval(poll, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentConfirmed, pendingPayment, fetchWallet]);

  const handleRecharge = async () => {
    const amountRupees = parseInt(rechargeAmount);
    if (!amountRupees || amountRupees < 100) {
      setRechargeError('Minimum recharge is ₹100');
      return;
    }
    if (amountRupees > 50000) {
      setRechargeError('Maximum recharge is ₹50,000');
      return;
    }

    setRecharging(true);
    setRechargeError('');

    try {
      const res = await fetch('/api/wallet/manual-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountRupees * 100 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRechargeError(data.error ?? 'Failed to create payment request');
        return;
      }
      setPendingPayment(data.data);
      setPaymentConfirmed(false);
    } catch {
      setRechargeError('Something went wrong. Please try again.');
    } finally {
      setRecharging(false);
    }
  };

  const handleIvePaid = () => {
    setPaymentConfirmed(true);
  };

  const handleDismiss = () => {
    setPendingPayment(null);
    setPaymentConfirmed(false);
    setShowRecharge(false);
    setRechargeAmount('');
    fetchWallet();
  };

  const formatAmount = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const formatAmountExact = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return `Today, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined }) +
      `, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const txIcon = (type: string) => {
    switch (type) {
      case 'RECHARGE':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        );
      case 'DEBIT':
        return (
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </div>
        );
      case 'REFUND':
        return (
          <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const isCredit = (type: string) => type === 'RECHARGE' || type === 'REFUND' || type === 'HOLD_RELEASE';
  const displayTx = allTransactions.length > 0 ? allTransactions : transactions;
  const txPages = Math.ceil(txTotal / 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A96E] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-4">
      {/* Back link */}
      <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#111] border border-white/5 p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A96E]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-white/40 text-xs uppercase tracking-wider font-medium">Available Balance</p>
          <p className="text-3xl font-bold text-white mt-2">
            {formatAmount(balance ?? 0)}
          </p>
          <button
            onClick={() => { setShowRecharge(true); setPendingPayment(null); setPaymentConfirmed(false); setRechargeError(''); }}
            className="mt-4 w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Money
          </button>
        </div>
      </div>

      {/* Recently approved banner */}
      {pendingPayment && pendingPayment.status === 'APPROVED' && !showRecharge && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400">Payment Approved!</p>
            <p className="text-xs text-white/40 mt-0.5">{formatAmountExact(pendingPayment.uniqueAmount)} added to your wallet</p>
          </div>
          <button onClick={() => setPendingPayment(null)} className="text-white/30 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Recently rejected banner */}
      {pendingPayment && pendingPayment.status === 'REJECTED' && !showRecharge && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Payment Rejected</p>
            <p className="text-xs text-white/40 mt-0.5">
              {pendingPayment.adminNote || 'Your payment could not be verified. Please try again.'}
            </p>
          </div>
          <button onClick={() => setPendingPayment(null)} className="text-white/30 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Recharge Panel */}
      {showRecharge && (
        <div className="rounded-2xl bg-[#141414] border border-white/5 p-5 space-y-4 animate-fade-in">
          {/* Step 1: Amount selection (no pending payment yet) */}
          {!pendingPayment && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Add Money</h3>
                <button onClick={() => setShowRecharge(false)} className="text-white/30 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setRechargeAmount(String(amt)); setRechargeError(''); }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      rechargeAmount === String(amt)
                        ? 'bg-[#C9A96E]/15 border-[#C9A96E]/40 text-[#C9A96E]'
                        : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Or enter custom amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">₹</span>
                  <input
                    type="number"
                    value={rechargeAmount}
                    onChange={(e) => { setRechargeAmount(e.target.value); setRechargeError(''); }}
                    placeholder="100 - 50,000"
                    min={100}
                    max={50000}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-8 pr-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-transparent"
                  />
                </div>
              </div>

              {rechargeError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {rechargeError}
                </p>
              )}

              <button
                onClick={handleRecharge}
                disabled={recharging || !rechargeAmount}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {recharging ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                    Processing...
                  </>
                ) : (
                  `Proceed to Pay ₹${parseInt(rechargeAmount) || 0}`
                )}
              </button>
            </>
          )}

          {/* Step 2: Payment created — show UPI details (before "I've Paid") */}
          {pendingPayment && pendingPayment.status === 'PENDING' && !paymentConfirmed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Pay via UPI</h3>
                <button onClick={handleDismiss} className="text-white/30 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Unique amount highlight */}
              <div className="bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-xl p-4 text-center">
                <p className="text-xs text-white/50 mb-1">Pay exactly this amount</p>
                <p className="text-3xl font-bold text-[#C9A96E]">
                  {formatAmountExact(pendingPayment.uniqueAmount)}
                </p>
                <p className="text-xs text-white/30 mt-2">
                  The unique amount helps us identify your payment
                </p>
              </div>

              {/* UPI ID */}
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40">Pay to UPI ID</p>
                  <p className="text-sm text-white font-mono mt-0.5">{pendingPayment.upiId}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(pendingPayment.upiId)}
                  className="text-[#C9A96E] text-xs font-medium hover:underline"
                >
                  Copy
                </button>
              </div>

              {/* Open UPI App */}
              <a
                href={pendingPayment.upiUrl}
                className="block w-full bg-[#C9A96E] text-black text-sm font-semibold py-3.5 rounded-xl hover:bg-[#d4b87a] transition-colors text-center"
              >
                Open UPI App to Pay
              </a>

              <button
                onClick={handleIvePaid}
                className="w-full border border-white/10 text-white/60 text-sm py-3 rounded-xl hover:border-white/20 hover:text-white transition-colors"
              >
                I&apos;ve completed the payment
              </button>

              <p className="text-center text-xs text-white/20">
                Payment window expires in {countdown}
              </p>
            </div>
          )}

          {/* Step 3: Waiting for admin verification (after "I've Paid") */}
          {pendingPayment && pendingPayment.status === 'PENDING' && paymentConfirmed && (
            <div className="space-y-5 text-center py-2">
              {/* Timer circle */}
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
                      const remaining = Math.max(0, new Date(pendingPayment.expiresAt).getTime() - Date.now());
                      const ratio = remaining / total;
                      return (1 - ratio) * 2 * Math.PI * 44;
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
                  Please wait while we verify your payment of{' '}
                  <span className="text-[#C9A96E] font-medium">{formatAmountExact(pendingPayment.uniqueAmount)}</span>.
                  This usually takes a few minutes.
                </p>
              </div>

              {/* Pulsing dots */}
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" style={{ animationDelay: '600ms' }} />
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/30">
                  If your payment is not verified within 15 minutes, please contact support.
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel and go back
              </button>
            </div>
          )}

          {/* Expired state */}
          {pendingPayment && pendingPayment.status === 'EXPIRED' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Payment window expired</p>
                <p className="text-white/40 text-xs mt-1">
                  The 15-minute verification window has ended. Please create a new payment request.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Approved state (in recharge panel) */}
          {pendingPayment && pendingPayment.status === 'APPROVED' && showRecharge && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Payment Verified!</p>
                <p className="text-white/40 text-xs mt-1">
                  {formatAmountExact(pendingPayment.uniqueAmount)} has been added to your wallet.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Rejected state (in recharge panel) */}
          {pendingPayment && pendingPayment.status === 'REJECTED' && showRecharge && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Payment Not Verified</p>
                <p className="text-white/40 text-xs mt-1">
                  {pendingPayment.adminNote || 'We could not verify your payment. If you made the payment, please contact support.'}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Recent Transactions</h3>
          {transactions.length > 0 && allTransactions.length === 0 && (
            <button
              onClick={() => fetchTransactions(1)}
              className="text-[#C9A96E] text-xs font-medium hover:underline"
            >
              View all
            </button>
          )}
        </div>

        {displayTx.length === 0 ? (
          <div className="rounded-2xl bg-[#141414] border border-white/5 py-12 text-center">
            <svg className="w-10 h-10 text-white/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-white/30 text-sm">No transactions yet</p>
            <p className="text-white/20 text-xs mt-1">Add money to get started</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#141414] border border-white/5 divide-y divide-white/5 overflow-hidden">
            {displayTx.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                {txIcon(tx.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{tx.description}</p>
                  <p className="text-xs text-white/30 mt-0.5">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${isCredit(tx.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCredit(tx.type) ? '+' : '-'}{formatAmount(tx.amount)}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">
                    Bal: {formatAmount(tx.balanceAfter)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {txPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => fetchTransactions(txPage - 1)}
              disabled={txPage <= 1 || txLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-white/30">
              {txPage} of {txPages}
            </span>
            <button
              onClick={() => fetchTransactions(txPage + 1)}
              disabled={txPage >= txPages || txLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
