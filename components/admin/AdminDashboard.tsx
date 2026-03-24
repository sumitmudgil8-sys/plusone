'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

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
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white/10 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users" className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 hover:border-gold/30 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-white/50">
            {stats.totalClients} clients · {stats.totalCompanions} companions
          </div>
        </Link>

        <Link href="/admin/bookings" className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 hover:border-gold/30 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Bookings</p>
              <p className="text-2xl font-bold text-white">{stats.totalBookings}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-white/50">
            {stats.pendingBookings} pending · {stats.completedBookings} completed
          </div>
        </Link>

        <Link href="/admin/companions" className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 hover:border-gold/30 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Pending Approvals</p>
              <p className="text-2xl font-bold text-white">{stats.pendingCompanions}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-white/50">
            {stats.pendingVerifications} pending verifications
          </div>
        </Link>

        <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-gold">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-white/50">All time earnings</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-charcoal-surface border border-charcoal-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-charcoal-border">
            <h3 className="text-lg font-semibold text-white">Recent Users</h3>
          </div>
          <div className="divide-y divide-charcoal-border">
            {recentUsers.map((user) => (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-charcoal border border-charcoal-border flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.clientProfile?.name || user.companionProfile?.name || user.email}</p>
                    <p className="text-sm text-white/50">{user.role.toLowerCase()} · {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  user.role === 'CLIENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-charcoal-surface border border-charcoal-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-charcoal-border">
            <h3 className="text-lg font-semibold text-white">Recent Bookings</h3>
          </div>
          <div className="divide-y divide-charcoal-border">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">
                    {booking.client?.clientProfile?.name} → {booking.companion?.companionProfile?.name}
                  </p>
                  <p className="text-sm text-white/50">
                    {formatCurrency(booking.totalAmount)} · {new Date(booking.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  booking.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400' :
                  booking.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
