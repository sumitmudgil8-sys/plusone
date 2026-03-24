"use client";
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import { SUBSCRIPTION_PRICE } from '@/lib/constants';
import type { User } from '@/types';

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users.filter((u: User) => u.role === 'CLIENT'));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentTier: string) => {
    try {
      const newTier = currentTier === 'PREMIUM' ? 'FREE' : 'PREMIUM';
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, subscriptionTier: newTier }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  const premiumUsers = users.filter((u: User) => u.subscriptionTier === 'PREMIUM');

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
        <p className="text-white/60">Manage user subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-white/60">Total Clients</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gold">{premiumUsers.length}</p>
          <p className="text-sm text-white/60">Premium Users</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">
            {formatCurrency(premiumUsers.length * SUBSCRIPTION_PRICE)}
          </p>
          <p className="text-sm text-white/60">Est. Revenue</p>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Plan</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {user.clientProfile?.avatarUrl ? (
                        <img
                          src={user.clientProfile.avatarUrl}
                          alt={user.clientProfile.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center text-white font-medium">
                          {user.clientProfile?.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-white">{user.clientProfile?.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white/70">{user.email}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={user.subscriptionTier === 'PREMIUM' ? 'gold' : 'outline'}
                    >
                      {user.subscriptionTier}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggle(user.id, user.subscriptionTier)}
                      className={`
                        px-3 py-1 rounded-full text-sm font-medium transition-colors
                        ${user.subscriptionTier === 'PREMIUM'
                          ? 'bg-error/20 text-error hover:bg-error/30'
                          : 'bg-gold/20 text-gold hover:bg-gold/30'
                        }
                      `}
                    >
                      {user.subscriptionTier === 'PREMIUM' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
