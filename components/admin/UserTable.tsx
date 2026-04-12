"use client";
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  role: string;
  subscriptionTier: string;
  isBanned: boolean;
  isActive: boolean;
  createdAt: string;
  clientProfile?: {
    name: string;
    avatarUrl?: string;
  };
  companionProfile?: {
    name: string;
    avatarUrl?: string;
    isApproved: boolean;
  };
  _count?: {
    clientBookings: number;
    companionBookings: number;
  };
}

interface UserTableProps {
  users: User[];
  onBanUser: (id: string, isBanned: boolean) => void;
  onDeleteUser: (id: string) => void;
  onUpgradeUser: (id: string, tier: string) => void;
  onApproveCompanion: (id: string, isApproved: boolean) => void;
}

export function UserTable({
  users,
  onBanUser,
  onDeleteUser,
  onUpgradeUser,
  onApproveCompanion,
}: UserTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const getName = (user: User) => {
    return user.clientProfile?.name || user.companionProfile?.name || 'Unknown';
  };

  const getAvatar = (user: User) => {
    return user.clientProfile?.avatarUrl || user.companionProfile?.avatarUrl;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-charcoal-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-white/50">User</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Role</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Joined</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-border">
          {users.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-white/5 transition-colors"
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  {getAvatar(user) ? (
                    <img
                      src={getAvatar(user)}
                      alt={getName(user)}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-white font-medium">
                      {getName(user).charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">{getName(user)}</p>
                    <p className="text-sm text-white/50">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <Badge variant={user.role === 'ADMIN' ? 'gold' : 'default'}>
                  {user.role}
                </Badge>
                {user.companionProfile && (
                  <Badge variant={user.companionProfile.isApproved ? 'success' : 'warning'} className="ml-2">
                    {user.companionProfile.isApproved ? 'Approved' : 'Pending'}
                  </Badge>
                )}
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-wrap gap-1">
                  {user.isBanned && <Badge variant="error">Banned</Badge>}
                  {!user.isBanned && <Badge variant="success">Active</Badge>}
                  {user.subscriptionTier === 'GOLD' && (
                    <Badge variant="gold">Gold</Badge>
                  )}
                </div>
              </td>
              <td className="py-4 px-4 text-white/70">
                {formatDate(user.createdAt)}
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-wrap gap-2">
                  {user.role === 'CLIENT' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onUpgradeUser(user.id, user.subscriptionTier === 'GOLD' ? 'FREE' : 'GOLD')
                      }
                    >
                      {user.subscriptionTier === 'GOLD' ? 'Downgrade' : 'Upgrade'}
                    </Button>
                  )}
                  {user.role === 'COMPANION' && user.companionProfile && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onApproveCompanion(user.id, !user.companionProfile!.isApproved)
                      }
                    >
                      {user.companionProfile.isApproved ? 'Reject' : 'Approve'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={user.isBanned ? 'outline' : 'ghost'}
                    onClick={() => onBanUser(user.id, !user.isBanned)}
                  >
                    {user.isBanned ? 'Unban' : 'Ban'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this user?')) {
                        onDeleteUser(user.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
