'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface ManualPayment {
  id: string;
  userId: string;
  requestedAmount: number;
  uniqueAmount: number;
  status: string;
  upiId: string;
  adminNote: string | null;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    email: string;
    clientProfile: { name: string; avatarUrl: string | null } | null;
  };
}

interface Stats {
  pendingCount: number;
  pendingAmount: number;
  approvedTodayCount: number;
  approvedTodayAmount: number;
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'ALL';

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: 'ALL' },
];

const STATUS_BADGE: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  EXPIRED: 'default',
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<ManualPayment | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetchPayments = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const query = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`/api/admin/payments${query}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.data.payments);
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(activeFilter);
  }, [activeFilter, fetchPayments]);

  // Auto-refresh every 30 seconds for pending tab
  useEffect(() => {
    if (activeFilter !== 'PENDING') return;
    const interval = setInterval(() => fetchPayments('PENDING'), 30000);
    return () => clearInterval(interval);
  }, [activeFilter, fetchPayments]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this payment? This will credit the client\'s wallet.')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) fetchPayments(activeFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const res = await fetch(`/api/admin/payments/${rejectModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', adminNote: rejectNote || undefined }),
      });
      if (res.ok) {
        setRejectModal(null);
        setRejectNote('');
        fetchPayments(activeFilter);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatPaise = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-white/50 text-sm">Verify and approve manual UPI wallet recharges</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/20 p-5">
            <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Pending</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{formatPaise(stats.pendingAmount)}</p>
            <p className="text-xs text-white/35 mt-1">{stats.pendingCount} request{stats.pendingCount !== 1 ? 's' : ''} waiting</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20 p-5">
            <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Approved Today</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatPaise(stats.approvedTodayAmount)}</p>
            <p className="text-xs text-white/35 mt-1">{stats.approvedTodayCount} payment{stats.approvedTodayCount !== 1 ? 's' : ''} approved</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeFilter === tab.value
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'text-white/40 hover:text-white/70 border border-transparent hover:border-charcoal-border'
            )}
          >
            {tab.label}
            {tab.value === 'PENDING' && stats && stats.pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full">
                {stats.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Payment List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">
              {activeFilter === 'PENDING' ? 'No pending payments' : 'No payments found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {payments.map((payment) => {
              const name = payment.user.clientProfile?.name || payment.user.email;
              const isPending = payment.status === 'PENDING';
              const isExpired = new Date(payment.expiresAt) < new Date() && payment.status === 'PENDING';

              return (
                <div key={payment.id} className="py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-white">{name[0].toUpperCase()}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{name}</span>
                        <Badge variant={STATUS_BADGE[payment.status] ?? 'default'}>
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{payment.user.email}</p>

                      {/* Amount details */}
                      <div className="mt-2 flex items-center gap-4 flex-wrap text-sm">
                        <div>
                          <span className="text-white/40 text-xs">Requested: </span>
                          <span className="text-white font-medium">{formatPaise(payment.requestedAmount)}</span>
                        </div>
                        <div>
                          <span className="text-white/40 text-xs">Unique amt: </span>
                          <span className="text-gold font-bold">{formatPaise(payment.uniqueAmount)}</span>
                        </div>
                      </div>

                      {/* Timing */}
                      <div className="mt-1 flex items-center gap-3 text-xs text-white/30">
                        <span>{formatTime(payment.createdAt)}</span>
                        <span>·</span>
                        <span>{timeAgo(payment.createdAt)}</span>
                        {isPending && !isExpired && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">
                              Expires {new Date(payment.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>

                      {payment.adminNote && (
                        <p className="mt-1.5 text-xs text-white/40 italic">
                          Note: {payment.adminNote}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {isPending && !isExpired && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(payment.id)}
                          isLoading={actionLoading === payment.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectModal(payment)}
                          disabled={actionLoading === payment.id}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-white">
              Reject Payment from {rejectModal.user.clientProfile?.name || rejectModal.user.email}
            </h3>
            <p className="text-sm text-white/60">
              Amount: <span className="text-gold font-medium">{formatPaise(rejectModal.uniqueAmount)}</span>
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Optional reason for rejection..."
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setRejectModal(null); setRejectNote(''); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectConfirm}
                isLoading={actionLoading === rejectModal.id}
                className="flex-1"
              >
                Reject Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
