'use client';

import { useEffect, useState } from 'react';
import { UserTable } from '@/components/admin/UserTable';
import { Card } from '@/components/ui/Card';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (id: string, isBanned: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isBanned }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleUpgradeUser = async (id: string, tier: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, subscriptionTier: tier }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error upgrading user:', error);
    }
  };

  const handleApproveCompanion = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch('/api/admin/companions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isApproved }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error approving companion:', error);
    }
  };

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
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-white/60">Manage all users</p>
      </div>

      <Card>
        <UserTable
          users={users}
          onBanUser={handleBanUser}
          onDeleteUser={handleDeleteUser}
          onUpgradeUser={handleUpgradeUser}
          onApproveCompanion={handleApproveCompanion}
        />
      </Card>
    </div>
  );
}
