'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ClientUser {
  id: string;
  email: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  clientProfile: { name: string; avatarUrl: string | null } | null;
}

const PLANS = [
  { value: 'MONTHLY_999', label: 'Monthly - ₹999' },
  { value: 'QUARTERLY_2499', label: 'Quarterly - ₹2,499' },
  { value: 'YEARLY_7999', label: 'Yearly - ₹7,999' },
];

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantModal, setGrantModal] = useState<ClientUser | null>(null);
  const [grantForm, setGrantForm] = useState({
    plan: 'MONTHLY_999',
    durationDays: 30,
    paymentRef: '',
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(
        (data.users ?? []).filter((u: ClientUser) => u.clientProfile)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleGrant = async () => {
    if (!grantModal) return;
    setActionLoading(grantModal.id);
    try {
      const expiresAt = new Date(Date.now() + grantForm.durationDays * 86400000).toISOString();
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: grantModal.id,
          subscriptionTier: 'PREMIUM',
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: grantForm.plan,
          subscriptionExpiresAt: expiresAt,
        }),
      });
      if (res.ok) {
        setGrantModal(null);
        setGrantForm({ plan: 'MONTHLY_999', durationDays: 30, paymentRef: '' });
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this subscription?')) return;
    setActionLoading(id);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          subscriptionTier: 'FREE',
          subscriptionStatus: 'FREE',
          subscriptionPlan: null,
          subscriptionExpiresAt: null,
        }),
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const premiumUsers = users.filter(u => u.subscriptionTier === 'PREMIUM');
  const freeUsers = users.filter(u => u.subscriptionTier !== 'PREMIUM');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-white/60">Grant or revoke premium access after verifying payment</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-white/60">Total Clients</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gold">{premiumUsers.length}</p>
          <p className="text-sm text-white/60">Premium</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{freeUsers.length}</p>
          <p className="text-sm text-white/60">Free</p>
        </Card>
      </div>

      {/* Premium users */}
      {premiumUsers.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Active Premium</h2>
          <div className="divide-y divide-charcoal-border">
            {premiumUsers.map(user => (
              <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">{user.clientProfile?.name?.[0] ?? '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.clientProfile?.name}</p>
                    <p className="text-xs text-white/40">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <Badge variant="gold">{user.subscriptionPlan ?? 'PREMIUM'}</Badge>
                    {user.subscriptionExpiresAt && (
                      <p className="text-xs text-white/40 mt-0.5">
                        Expires {new Date(user.subscriptionExpiresAt).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRevoke(user.id)}
                    isLoading={actionLoading === user.id}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Free users */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Free Users</h2>
        {freeUsers.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">All clients have premium</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {freeUsers.map(user => (
              <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">{user.clientProfile?.name?.[0] ?? '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.clientProfile?.name}</p>
                    <p className="text-xs text-white/40">{user.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setGrantModal(user)}
                >
                  Grant Premium
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Grant modal */}
      {grantModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-white">
              Grant Premium to {grantModal.clientProfile?.name}
            </h3>
            <p className="text-sm text-white/60">
              Verify payment has been received before granting access.
            </p>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Plan</label>
              <select
                value={grantForm.plan}
                onChange={e => setGrantForm({ ...grantForm, plan: e.target.value })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3"
              >
                {PLANS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Duration (days)</label>
              <input
                type="number"
                value={grantForm.durationDays}
                onChange={e => setGrantForm({ ...grantForm, durationDays: parseInt(e.target.value) || 30 })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3"
                min={1}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Payment Reference / Notes</label>
              <input
                type="text"
                value={grantForm.paymentRef}
                onChange={e => setGrantForm({ ...grantForm, paymentRef: e.target.value })}
                placeholder="e.g. UPI txn ID, bank ref"
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setGrantModal(null); setGrantForm({ plan: 'MONTHLY_999', durationDays: 30, paymentRef: '' }); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGrant}
                isLoading={actionLoading === grantModal.id}
                className="flex-1"
              >
                Confirm Grant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
