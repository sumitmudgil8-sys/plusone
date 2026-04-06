'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

interface WithdrawalRecord {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  companion: {
    id: string;
    email: string;
    companionProfile: { name: string; avatarUrl: string | null } | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_BADGE: Record<WithdrawalStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PAID: 'bg-green-500/15 text-green-400 border-green-500/30',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ─── Action Modal ─────────────────────────────────────────────────────────────

function ActionModal({
  withdrawal,
  action,
  onClose,
  onDone,
}: {
  withdrawal: WithdrawalRecord;
  action: 'approve' | 'reject' | 'mark_paid';
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    approve: 'Approve Withdrawal',
    reject: 'Reject Withdrawal',
    mark_paid: 'Mark as Paid',
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed'); return; }
      onDone();
    } catch {
      setError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1C1C1C] border border-charcoal-border rounded-2xl p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">{titles[action]}</h2>
        <p className="text-sm text-white/50 mb-5">
          Companion: <span className="text-white">{withdrawal.companion.companionProfile?.name ?? withdrawal.companion.email}</span>
          {' · '}{fmt(withdrawal.amount)}
        </p>

        {(action === 'reject' || action === 'mark_paid') && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              {action === 'reject' ? 'Reason' : 'Admin Note'} <span className="text-white/30 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
              placeholder={action === 'reject' ? 'Reason for rejection' : 'Payment reference or note'}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-charcoal-border text-sm text-white/50 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
              action === 'reject'
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-gold hover:bg-gold/90 text-black'
            }`}
          >
            {submitting ? 'Processing…' : titles[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | WithdrawalStatus>('ALL');
  const [modal, setModal] = useState<{
    withdrawal: WithdrawalRecord;
    action: 'approve' | 'reject' | 'mark_paid';
  } | null>(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const url = filter === 'ALL' ? '/api/admin/withdrawals' : `/api/admin/withdrawals?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.data.withdrawals);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const pending = withdrawals.filter((w) => w.status === 'PENDING');
  const pendingTotal = pending.reduce((s, w) => s + w.amount, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = withdrawals
    .filter((w) => w.status === 'PAID' && w.resolvedAt && new Date(w.resolvedAt) >= monthStart)
    .reduce((s, w) => s + w.amount, 0);

  const FILTER_TABS: { key: typeof filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'PAID', label: 'Paid' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Withdrawal Requests</h1>
        <p className="text-white/60">Manage companion payout requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20">
          <p className="text-xl font-bold text-amber-400">{fmt(pendingTotal)}</p>
          <p className="text-xs text-white/50 mt-1">Pending ({pending.length} requests)</p>
        </div>
        <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/20">
          <p className="text-xl font-bold text-green-400">{fmt(paidThisMonth)}</p>
          <p className="text-xs text-white/50 mt-1">Paid this month</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-charcoal-surface rounded-xl p-1 border border-charcoal-border overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key ? 'bg-gold text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Withdrawals table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : withdrawals.length === 0 ? (
          <p className="text-white/50 text-center py-12 text-sm">No withdrawal requests</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {withdrawals.map((w) => {
              const companionName = w.companion.companionProfile?.name ?? w.companion.email;
              const avatarUrl = w.companion.companionProfile?.avatarUrl;

              return (
                <div key={w.id} className="py-4 flex items-start gap-4">
                  {/* Avatar */}
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={companionName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-white">{companionName[0]}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{companionName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[w.status]}`}>
                        {w.status}
                      </span>
                    </div>
                    <p className="text-base font-bold text-gold mt-1">{fmt(w.amount)}</p>
                    <p className="text-xs text-white/40 mt-0.5">Requested {formatDateTime(w.createdAt)}</p>
                    {w.note && (
                      <p className="text-xs text-white/50 mt-1 truncate max-w-xs" title={w.note}>Note: {w.note}</p>
                    )}
                    {w.adminNote && (
                      <p className="text-xs text-blue-400 mt-1">Admin: {w.adminNote}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {w.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setModal({ withdrawal: w, action: 'approve' })}
                          className="px-3 py-1.5 rounded-lg border border-green-500/40 text-green-400 text-xs font-medium hover:bg-green-500/10 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setModal({ withdrawal: w, action: 'reject' })}
                          className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {w.status === 'APPROVED' && (
                      <button
                        onClick={() => setModal({ withdrawal: w, action: 'mark_paid' })}
                        className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-xs font-medium hover:bg-gold/10 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {modal && (
        <ActionModal
          withdrawal={modal.withdrawal}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            showToast('Action completed');
            load();
          }}
        />
      )}
    </div>
  );
}
