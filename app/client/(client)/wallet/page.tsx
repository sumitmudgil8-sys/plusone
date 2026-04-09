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

// Which step of the recharge flow is active
type RechargeStep = 'amount' | 'pay' | 'waiting' | 'result';

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  // Recharge flow
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);
  const [step, setStep] = useState<RechargeStep>('amount');
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      if (data.success) {
        setBalance(data.data.balance);
        setTransactions(data.data.transactions);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
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
    } catch { /* non-fatal */ }
    finally { setTxLoading(false); }
  }, []);

  // Check for existing pending payment on mount
  const checkPendingPayment = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/manual-recharge');
      const data = await res.json();
      if (data.success && data.data.payment) {
        const p: PendingPayment = data.data.payment;
        setPayment(p);
        if (p.status === 'PENDING') {
          setShowRecharge(true);
          setStep('pay'); // show payment details, not jump straight to waiting
        } else if (p.status === 'APPROVED') {
          fetchWallet(); // refresh balance
        }
        // REJECTED / EXPIRED — leave as banners, don't auto-show recharge panel
      }
    } catch { /* non-fatal */ }
  }, [fetchWallet]);

  useEffect(() => {
    fetchWallet();
    checkPendingPayment();
  }, [fetchWallet, checkPendingPayment]);

  // ─── Countdown Timer ───────────────────────────────────────────
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

  // ─── Poll for status while waiting ─────────────────────────────
  useEffect(() => {
    if (step !== 'waiting' || !payment || payment.status !== 'PENDING') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch('/api/wallet/manual-recharge');
        const data = await res.json();
        if (data.success && data.data.payment) {
          const p: PendingPayment = data.data.payment;
          if (p.status !== 'PENDING') {
            setPayment(p);
            setStep('result');
            if (p.status === 'APPROVED') fetchWallet();
          }
        }
      } catch { /* non-fatal */ }
    };
    pollRef.current = setInterval(poll, 10000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [step, payment, fetchWallet]);

  // ─── Handlers ──────────────────────────────────────────────────
  const openAddMoney = () => {
    // If there's an active PENDING payment, show it instead of resetting
    if (payment && payment.status === 'PENDING' && new Date(payment.expiresAt) > new Date()) {
      setShowRecharge(true);
      setStep('pay');
      return;
    }
    setShowRecharge(true);
    setStep('amount');
    setPayment(null);
    setRechargeError('');
  };

  const handleProceedToPay = async () => {
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
        setRechargeError(data.error ?? 'Failed to create payment. Please try again.');
        return;
      }

      const p: PendingPayment = data.data;
      setPayment(p);
      setStep('pay');

      // Auto-open UPI intent after a brief moment so the user sees the screen
      setTimeout(() => {
        try { window.location.href = p.upiUrl; } catch { /* ignore */ }
      }, 600);
    } catch {
      setRechargeError('Network error. Please check your connection and try again.');
    } finally {
      setRecharging(false);
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
    setShowRecharge(false);
    setStep('amount');
    setRechargeAmount('');
    fetchWallet();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    }).catch(() => {});
  };

  // ─── Format Helpers ────────────────────────────────────────────
  const fmt = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const fmtExact = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
  };

  const txIcon = (type: string) => {
    const iconMap: Record<string, { bg: string; color: string; d: string }> = {
      RECHARGE: { bg: 'bg-emerald-500/10', color: 'text-emerald-400', d: 'M12 4v16m8-8H4' },
      DEBIT: { bg: 'bg-red-500/10', color: 'text-red-400', d: 'M20 12H4' },
      REFUND: { bg: 'bg-blue-500/10', color: 'text-blue-400', d: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
    };
    const ic = iconMap[type] || { bg: 'bg-white/5', color: 'text-white/40', d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
    return (
      <div className={`w-9 h-9 rounded-full ${ic.bg} flex items-center justify-center shrink-0`}>
        <svg className={`w-4 h-4 ${ic.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ic.d} />
        </svg>
      </div>
    );
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

  // ─── Render ────────────────────────────────────────────────────
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
          <p className="text-3xl font-bold text-white mt-2">{fmt(balance ?? 0)}</p>
          <button
            onClick={openAddMoney}
            className="mt-4 w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Money
          </button>
        </div>
      </div>

      {/* Status banners (when panel is closed) */}
      {!showRecharge && payment && payment.status === 'APPROVED' && (
        <Banner
          color="emerald"
          icon="M5 13l4 4L19 7"
          title="Payment Approved!"
          subtitle={`${fmtExact(payment.uniqueAmount)} added to your wallet`}
          onDismiss={() => setPayment(null)}
        />
      )}
      {!showRecharge && payment && payment.status === 'REJECTED' && (
        <Banner
          color="red"
          icon="M6 18L18 6M6 6l12 12"
          title="Payment Rejected"
          subtitle={payment.adminNote || 'Your payment could not be verified. Please try again.'}
          onDismiss={() => setPayment(null)}
        />
      )}

      {/* ─── Recharge Panel ─────────────────────────────────────── */}
      {showRecharge && (
        <div className="rounded-2xl bg-[#141414] border border-white/5 p-5 space-y-4">

          {/* STEP: Amount Selection */}
          {step === 'amount' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Add Money</h3>
                <CloseBtn onClick={() => setShowRecharge(false)} />
              </div>

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

              <div>
                <label className="block text-xs text-white/40 mb-1.5">Or enter custom amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
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
                onClick={handleProceedToPay}
                disabled={recharging || !rechargeAmount}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {recharging ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                    Creating payment...
                  </>
                ) : (
                  `Proceed to Pay ₹${parseInt(rechargeAmount) || 0}`
                )}
              </button>
            </>
          )}

          {/* STEP: Pay — show UPI details + open UPI app */}
          {step === 'pay' && payment && payment.status === 'PENDING' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Complete Payment</h3>
                <CloseBtn onClick={handleDismiss} />
              </div>

              {/* Unique amount — prominent */}
              <div className="bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-xl p-4 text-center">
                <p className="text-xs text-white/50 mb-1">Pay exactly this amount</p>
                <p className="text-3xl font-bold text-[#C9A96E]">{fmtExact(payment.uniqueAmount)}</p>
                <button
                  onClick={() => copyToClipboard((payment.uniqueAmount / 100).toFixed(2), 'amount')}
                  className="mt-2 text-xs text-[#C9A96E]/70 hover:text-[#C9A96E] transition-colors"
                >
                  {copied === 'amount' ? 'Copied!' : 'Tap to copy amount'}
                </button>
              </div>

              {/* UPI ID row */}
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">UPI ID</p>
                  <p className="text-sm text-white font-mono mt-0.5">{payment.upiId}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(payment.upiId, 'upi')}
                  className="text-[#C9A96E] text-xs font-medium px-3 py-1.5 rounded-lg bg-[#C9A96E]/10 hover:bg-[#C9A96E]/20 transition-colors"
                >
                  {copied === 'upi' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Pay Now button — opens UPI intent */}
              <button
                onClick={handleOpenUpi}
                className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3.5 rounded-xl hover:bg-[#d4b87a] transition-colors flex items-center justify-center gap-2"
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
                className="w-full border border-white/10 text-white text-sm py-3 rounded-xl hover:border-[#C9A96E]/30 hover:text-[#C9A96E] transition-colors font-medium"
              >
                I&apos;ve completed the payment
              </button>

              <p className="text-center text-xs text-white/20">
                Payment window: {countdown} remaining
              </p>
            </div>
          )}

          {/* STEP: Waiting for verification */}
          {step === 'waiting' && payment && payment.status === 'PENDING' && (
            <div className="space-y-5 text-center py-2">
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
                  <span className="text-[#C9A96E] font-medium">{fmtExact(payment.uniqueAmount)}</span>.
                  This usually takes a few minutes.
                </p>
              </div>

              {/* Pulsing dots */}
              <div className="flex items-center justify-center gap-1.5">
                {[0, 300, 600].map(delay => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>

              {/* Go back to payment details */}
              <button
                onClick={() => setStep('pay')}
                className="text-sm text-[#C9A96E] font-medium hover:underline"
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
          )}

          {/* STEP: Result — Expired / Approved / Rejected */}
          {step === 'result' && payment && (
            <ResultScreen payment={payment} fmtExact={fmtExact} onDismiss={handleDismiss} />
          )}

          {/* Handle expired during pay step */}
          {step === 'pay' && payment && payment.status === 'EXPIRED' && (
            <ResultScreen payment={payment} fmtExact={fmtExact} onDismiss={handleDismiss} />
          )}
        </div>
      )}

      {/* ─── Transaction History ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Recent Transactions</h3>
          {transactions.length > 0 && allTransactions.length === 0 && (
            <button onClick={() => fetchTransactions(1)} className="text-[#C9A96E] text-xs font-medium hover:underline">
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
                  <p className="text-xs text-white/30 mt-0.5">{fmtDate(tx.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${isCredit(tx.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCredit(tx.type) ? '+' : '-'}{fmt(tx.amount)}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">Bal: {fmt(tx.balanceAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {txPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => fetchTransactions(txPage - 1)}
              disabled={txPage <= 1 || txLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-white/30">{txPage} of {txPages}</span>
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

// ─── Small Components ────────────────────────────────────────────

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-white/30 hover:text-white transition-colors p-1">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function Banner({ color, icon, title, subtitle, onDismiss }: {
  color: 'emerald' | 'red';
  icon: string;
  title: string;
  subtitle: string;
  onDismiss: () => void;
}) {
  const colors = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', iconBg: 'bg-red-500/20', text: 'text-red-400' },
  }[color];

  return (
    <div className={`rounded-2xl ${colors.bg} border ${colors.border} p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-full ${colors.iconBg} flex items-center justify-center shrink-0`}>
        <svg className={`w-5 h-5 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${colors.text}`}>{title}</p>
        <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onDismiss} className="text-white/30 hover:text-white">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ResultScreen({ payment, fmtExact, onDismiss }: {
  payment: PendingPayment;
  fmtExact: (paise: number) => string;
  onDismiss: () => void;
}) {
  if (payment.status === 'APPROVED') {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white font-semibold">Payment Verified!</p>
        <p className="text-white/40 text-xs">{fmtExact(payment.uniqueAmount)} has been added to your wallet.</p>
        <button onClick={onDismiss} className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors">
          Done
        </button>
      </div>
    );
  }

  if (payment.status === 'REJECTED') {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white font-semibold">Payment Not Verified</p>
        <p className="text-white/40 text-xs">{payment.adminNote || 'We could not verify your payment. If you already paid, please contact support.'}</p>
        <button onClick={onDismiss} className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // EXPIRED
  return (
    <div className="space-y-4 text-center py-4">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-white font-semibold">Payment window expired</p>
      <p className="text-white/40 text-xs">The 15-minute window has ended. Please start a new payment.</p>
      <button onClick={onDismiss} className="w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors">
        Try Again
      </button>
    </div>
  );
}
