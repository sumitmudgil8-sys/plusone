'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'thisWeek' | 'thisMonth' | 'allTime';

interface PeriodBreakdown {
  chats: number;
  calls: number;
  bookings: number;
  total: number;
}

interface Transaction {
  type: 'CHAT' | 'CALL' | 'BOOKING';
  amount: number;
  createdAt: string;
  durationMinutes?: number;
  clientName?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface EarningsData {
  summary: {
    totalEarned: number;
    pendingWithdrawal: number;
    availableBalance: number;
  };
  breakdown: { fromChats: number; fromCalls: number; fromBookings: number };
  periods: Record<Period, PeriodBreakdown>;
  recentTransactions: Transaction[];
  withdrawals: Withdrawal[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_BADGE: Record<Withdrawal['status'], { cls: string; label: string; icon: string }> = {
  PENDING:  { cls: 'bg-warning/15 text-warning-fg border-warning/30', label: 'Pending',  icon: '⏳' },
  APPROVED: { cls: 'bg-info/15 text-info-fg border-info/30',           label: 'Approved', icon: '✓'  },
  PAID:     { cls: 'bg-success/15 text-success-fg border-success/30',   label: 'Paid',     icon: '✓'  },
  REJECTED: { cls: 'bg-error/15 text-error-fg border-error/30',         label: 'Rejected', icon: '✕'  },
};

const TYPE_ICON: Record<string, string> = { CHAT: '💬', CALL: '📞', BOOKING: '📅' };

// ─── Withdrawal Modal ─────────────────────────────────────────────────────────

function WithdrawalModal({
  availableBalance,
  onClose,
  onSuccess,
}: {
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const maxRupees = Math.floor(availableBalance / 100);
  const [amountRupees, setAmountRupees] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedRupees = parseInt(amountRupees) || 0;
  const isValid = parsedRupees >= 500 && parsedRupees <= maxRupees;

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/companion/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedRupees * 100, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to submit'); return; }
      onSuccess();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-charcoal-elevated border border-charcoal-border rounded-2xl p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Request Withdrawal</h2>
        <p className="text-sm text-white/50 mb-5">Available: <span className="text-success-fg font-semibold">{fmt(availableBalance)}</span></p>

        {/* Quick amounts */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[500, 1000, 2000, 5000].map((amt) => (
            <button
              key={amt}
              onClick={() => setAmountRupees(String(amt))}
              disabled={amt > maxRupees}
              className="px-3 py-1.5 rounded-lg border border-charcoal-border text-sm text-white/70 hover:border-gold hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ₹{amt.toLocaleString('en-IN')}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-white/80 mb-1.5">Amount (₹)</label>
          <input
            type="number"
            min={500}
            max={maxRupees}
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            placeholder="Enter amount in rupees"
            className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold placeholder:text-white/30"
          />
          {parsedRupees > 0 && parsedRupees < 500 && (
            <p className="text-xs text-error-fg mt-1">Minimum withdrawal is ₹500</p>
          )}
          {parsedRupees > maxRupees && maxRupees > 0 && (
            <p className="text-xs text-error-fg mt-1">Exceeds available balance</p>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-white/80 mb-1.5">Note <span className="text-white/30 font-normal">(optional)</span></label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Add a note for admin (optional)"
            className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
          />
        </div>

        {error && <p className="text-sm text-error-fg mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-charcoal-border text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 py-2.5 rounded-lg bg-gold hover:bg-gold/90 text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/companion/earnings');
      if (res.ok) {
        const d = await res.json();
        setData(d.data);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const summary = data?.summary ?? { totalEarned: 0, pendingWithdrawal: 0, availableBalance: 0 };
  const periodData = data?.periods[period] ?? { chats: 0, calls: 0, bookings: 0, total: 0 };
  const transactions = data?.recentTransactions ?? [];
  const withdrawals = data?.withdrawals ?? [];

  const PERIOD_TABS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'allTime', label: 'All Time' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-success/15 border border-success/30 text-success-fg text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Earnings</h1>
          <p className="text-white/60">Track your income and withdrawals</p>
        </div>
        <button
          onClick={() => setShowWithdrawalModal(true)}
          disabled={summary.availableBalance < 50000}
          className="shrink-0 px-4 py-2 rounded-xl bg-gold hover:bg-gold/90 text-black text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Request Withdrawal
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 bg-success/10 border border-success/20">
          <p className="text-xl font-bold text-success-fg">{fmt(summary.availableBalance)}</p>
          <p className="text-xs text-white/50 mt-1">Available Balance</p>
          <p className="text-xs text-white/30 mt-0.5">Ready to withdraw</p>
        </div>
        <div className="rounded-xl p-4 bg-warning/10 border border-warning/20">
          <p className="text-xl font-bold text-warning-fg">{fmt(summary.pendingWithdrawal)}</p>
          <p className="text-xs text-white/50 mt-1">Pending Withdrawal</p>
          <p className="text-xs text-white/30 mt-0.5">Under review</p>
        </div>
        <div className="rounded-xl p-4 bg-charcoal-surface border border-charcoal-border">
          <p className="text-xl font-bold text-gold">{fmt(summary.totalEarned)}</p>
          <p className="text-xs text-white/50 mt-1">Total Earned</p>
          <p className="text-xs text-white/30 mt-0.5">All time</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 bg-charcoal-surface rounded-xl p-1 border border-charcoal-border">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              period === tab.key ? 'bg-gold text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '💬', label: 'Chats', value: periodData.chats },
          { icon: '📞', label: 'Calls', value: periodData.calls },
          { icon: '📅', label: 'Bookings', value: periodData.bookings },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-xl p-4 bg-charcoal-surface border border-charcoal-border text-center">
            <p className="text-lg mb-1">{icon}</p>
            <p className="text-base font-bold text-white">{fmt(value)}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
            <p className="text-xs text-white/30 mt-1">{pct(value, periodData.total)}</p>
          </div>
        ))}
      </div>

      {periodData.total > 0 && (
        <div className="text-center text-sm text-white/40">
          Total for period: <span className="text-white font-semibold">{fmt(periodData.total)}</span>
        </div>
      )}

      {/* Recent transactions */}
      <Card>
        <h2 className="font-medium text-white mb-4">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-white/50 text-center py-8 text-sm">No transactions yet</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {transactions.map((tx, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <span className="text-xl shrink-0">{TYPE_ICON[tx.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {tx.type === 'BOOKING' ? 'Booking' : tx.type === 'CHAT' ? 'Chat session' : 'Voice call'}
                    {tx.clientName ? ` · ${tx.clientName}` : ''}
                  </p>
                  <p className="text-xs text-white/40">
                    {tx.durationMinutes ? `${tx.durationMinutes} min · ` : ''}
                    {relativeTime(tx.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-success-fg shrink-0">+{fmt(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Withdrawal history */}
      <Card>
        <h2 className="font-medium text-white mb-4">Withdrawal History</h2>
        {withdrawals.length === 0 ? (
          <p className="text-white/50 text-center py-6 text-sm">No withdrawal requests yet</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {withdrawals.map((w) => (
              <div key={w.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{fmt(w.amount)}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[w.status].cls}`}>
                      <span aria-hidden>{STATUS_BADGE[w.status].icon}</span>
                      {STATUS_BADGE[w.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{formatDateTime(w.createdAt)}</p>
                  {w.adminNote && (
                    <p className="text-xs text-white/50 mt-1 italic">{w.adminNote}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showWithdrawalModal && data && (
        <WithdrawalModal
          availableBalance={summary.availableBalance}
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={() => {
            setShowWithdrawalModal(false);
            showToast('Withdrawal request submitted');
            load();
          }}
        />
      )}
    </div>
  );
}
