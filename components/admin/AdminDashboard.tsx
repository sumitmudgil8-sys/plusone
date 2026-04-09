'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Stats {
  totalUsers: number;
  totalClients: number;
  totalCompanions: number;
  pendingCompanions: number;
  pendingVerifications: number;
  totalBookings: number;
  pendingBookings: number;
  completedBookings: number;
  totalRevenue: number;
}

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  clientProfile: { name: string } | null;
  companionProfile: { name: string } | null;
}

interface Booking {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  client: { clientProfile: { name: string } | null };
  companion: { companionProfile: { name: string } | null };
}

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      setStats(data.stats);
      setRecentUsers(data.recentUsers || []);
      setRecentBookings(data.recentBookings || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pt-2">
        {/* Skeleton header */}
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-56 bg-white/10 rounded-lg" />
          <div className="h-4 w-40 bg-white/5 rounded-lg" />
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      subtitle: `${stats.totalClients} clients · ${stats.totalCompanions} companions`,
      href: '/admin/users',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Bookings',
      value: stats.totalBookings,
      subtitle: `${stats.pendingBookings} pending · ${stats.completedBookings} done`,
      href: '/admin/bookings',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Pending Approvals',
      value: stats.pendingCompanions,
      subtitle: `${stats.pendingVerifications} verifications`,
      href: '/admin/users',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Revenue',
      value: formatCurrency(stats.totalRevenue),
      subtitle: 'All time earnings',
      href: undefined,
      gradient: 'from-gold/20 to-amber-600/20',
      iconBg: 'bg-gold/20',
      iconColor: 'text-gold',
      isGold: true,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    { label: 'View Clients', href: '/admin/users', icon: '→' },
    { label: 'Verify Payments', href: '/admin/payments', icon: '→' },
    { label: 'Monitor Chats', href: '/admin/chats', icon: '→' },
    { label: 'Process Payouts', href: '/admin/withdrawals', icon: '→' },
  ];

  return (
    <div className="space-y-6 pt-2">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {GREETING()}, Admin
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Here&apos;s what&apos;s happening on Plus One today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Wrapper = card.href ? Link : 'div';
          const wrapperProps = card.href ? { href: card.href } : {};
          return (
            <Wrapper
              key={card.label}
              {...(wrapperProps as any)}
              className={cn(
                'relative overflow-hidden rounded-2xl p-5 border border-charcoal-border/50 transition-all duration-300',
                'bg-gradient-to-br', card.gradient,
                card.href && 'hover:border-white/20 hover:scale-[1.02] cursor-pointer',
                'group'
              )}
            >
              {/* Decorative circle */}
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/[0.03]" />

              <div className="relative">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', card.iconBg)}>
                  <span className={card.iconColor}>{card.icon}</span>
                </div>
                <p className="text-xs text-white/50 font-medium uppercase tracking-wider">{card.label}</p>
                <p className={cn(
                  'text-2xl font-bold mt-0.5',
                  card.isGold ? 'text-gold' : 'text-white'
                )}>
                  {card.value}
                </p>
                <p className="text-xs text-white/35 mt-2">{card.subtitle}</p>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-charcoal-surface border border-charcoal-border/50 hover:border-gold/30 hover:bg-gold/5 transition-all duration-200 group"
          >
            <span className="text-sm text-white/70 group-hover:text-white transition-colors">{action.label}</span>
            <span className="text-gold opacity-0 group-hover:opacity-100 transition-opacity text-sm">{action.icon}</span>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-charcoal-surface border border-charcoal-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Users</h3>
            <Link href="/admin/users" className="text-xs text-gold hover:text-gold/80 transition-colors">
              View all
            </Link>
          </div>
          <div className="divide-y divide-charcoal-border/30">
            {recentUsers.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No users yet</div>
            ) : (
              recentUsers.map((user, i) => (
                <div key={user.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold',
                      user.role === 'CLIENT'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-purple-500/15 text-purple-400'
                    )}>
                      {(user.clientProfile?.name || user.companionProfile?.name || user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {user.clientProfile?.name || user.companionProfile?.name || user.email}
                      </p>
                      <p className="text-xs text-white/35">
                        {user.role.toLowerCase()} · {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-medium uppercase tracking-wider',
                    user.role === 'CLIENT'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-purple-500/10 text-purple-400'
                  )}>
                    {user.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-charcoal-surface border border-charcoal-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Bookings</h3>
            <Link href="/admin/bookings" className="text-xs text-gold hover:text-gold/80 transition-colors">
              View all
            </Link>
          </div>
          <div className="divide-y divide-charcoal-border/30">
            {recentBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No bookings yet</div>
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {booking.client?.clientProfile?.name || 'Unknown'}{' '}
                      <span className="text-white/30 mx-1">→</span>{' '}
                      {booking.companion?.companionProfile?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">
                      {formatCurrency(booking.totalAmount)} · {new Date(booking.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-medium uppercase tracking-wider',
                    booking.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                    booking.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-white/5 text-white/40'
                  )}>
                    {booking.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
