'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
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
  const [paymentLink, setPaymentLink] = useState<{ upiLink: string | null; shortUrl: string | null; qrCode: string | null } | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);

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

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

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
    setPaymentLink(null);

    try {
      const res = await fetch('/api/wallet/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountRupees * 100 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRechargeError(data.error ?? 'Failed to create payment link');
        return;
      }
      setPaymentLink({
        upiLink: data.data.upiLink,
        shortUrl: data.data.shortUrl,
        qrCode: data.data.qrCode,
      });
    } catch {
      setRechargeError('Something went wrong. Please try again.');
    } finally {
      setRecharging(false);
    }
  };

  const handlePaymentDone = () => {
    setPaymentLink(null);
    setShowRecharge(false);
    setRechargeAmount('');
    // Re-fetch wallet after a short delay for webhook processing
    setTimeout(() => fetchWallet(), 3000);
  };

  const formatAmount = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
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
            onClick={() => { setShowRecharge(true); setPaymentLink(null); setRechargeError(''); }}
            className="mt-4 w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Money
          </button>
        </div>
      </div>

      {/* Recharge Panel */}
      {showRecharge && (
        <div className="rounded-2xl bg-[#141414] border border-white/5 p-5 space-y-4 animate-fade-in">
          {!paymentLink ? (
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
                    Creating link…
                  </>
                ) : (
                  `Pay ₹${parseInt(rechargeAmount) || 0}`
                )}
              </button>
            </>
          ) : (
            /* Payment link created — show options */
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Payment link ready</p>
                <p className="text-white/40 text-xs mt-1">Complete payment using UPI</p>
              </div>

              {/* QR Code */}
              {paymentLink.qrCode && (
                <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
                  <img src={paymentLink.qrCode} alt="UPI QR" className="w-44 h-44" />
                </div>
              )}

              {/* UPI Deep Link */}
              {paymentLink.upiLink && (
                <a
                  href={paymentLink.upiLink}
                  className="block w-full bg-[#C9A96E] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#d4b87a] transition-colors"
                >
                  Open UPI App
                </a>
              )}

              {/* Short URL fallback */}
              {paymentLink.shortUrl && (
                <a
                  href={paymentLink.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full border border-white/10 text-white/60 text-sm py-3 rounded-xl hover:border-white/20 hover:text-white transition-colors"
                >
                  Open Payment Link
                </a>
              )}

              <button
                onClick={handlePaymentDone}
                className="text-sm text-[#C9A96E] font-medium hover:underline"
              >
                I&apos;ve completed payment
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
