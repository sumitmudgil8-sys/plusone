'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────

interface BookingClient {
  id: string;
  email: string;
  clientProfile: { name: string; avatarUrl: string | null } | null;
}

interface BookingCompanion {
  id: string;
  email: string;
  companionProfile: { name: string; avatarUrl: string | null } | null;
}

interface Booking {
  id: string;
  date: string;
  duration: number;
  status: string;
  totalAmount: number;
  depositAmount: number;
  paymentStatus: string;
  notes: string | null;
  venueName: string | null;
  venueAddress: string | null;
  createdAt: string;
  client: BookingClient;
  companion: BookingCompanion;
}

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  rejected: number;
  totalRevenue: number;
}

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

const FILTER_TABS: { label: string; value: StatusFilter; color: string }[] = [
  { label: 'All', value: 'ALL', color: 'text-white' },
  { label: 'Pending', value: 'PENDING', color: 'text-amber-400' },
  { label: 'Confirmed', value: 'CONFIRMED', color: 'text-blue-400' },
  { label: 'Completed', value: 'COMPLETED', color: 'text-emerald-400' },
  { label: 'Cancelled', value: 'CANCELLED', color: 'text-white/50' },
  { label: 'Rejected', value: 'REJECTED', color: 'text-red-400' },
];

const STATUS_BADGE: Record<string, 'warning' | 'success' | 'error' | 'default' | 'gold'> = {
  PENDING: 'warning',
  CONFIRMED: 'gold',
  COMPLETED: 'success',
  CANCELLED: 'default',
  REJECTED: 'error',
  EXPIRED: 'default',
};

const PAYMENT_STATUS_BADGE: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  PAID: 'success',
  REFUNDED: 'default',
};

// ─── Helpers ─────────────────────────────────────────────────────

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Component ─────────────────────────────────────────────

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBookings = useCallback(async (status: StatusFilter, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'ALL') params.set('status', status);
      if (q) params.set('search', q);
      params.set('limit', '100');
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings(activeFilter, searchDebounced);
  }, [activeFilter, searchDebounced, fetchBookings]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bookings?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchBookings(activeFilter, searchDebounced);
      }
    } catch (err) {
      console.error('Error deleting booking:', err);
    } finally {
      setDeleting(false);
    }
  };

  const statCards = stats ? [
    {
      label: 'Total',
      value: stats.total,
      gradient: 'from-white/10 to-white/5',
      textColor: 'text-white',
    },
    {
      label: 'Pending',
      value: stats.pending,
      gradient: 'from-amber-500/15 to-orange-500/15',
      textColor: 'text-amber-400',
    },
    {
      label: 'Confirmed',
      value: stats.confirmed,
      gradient: 'from-blue-500/15 to-indigo-500/15',
      textColor: 'text-blue-400',
    },
    {
      label: 'Completed',
      value: stats.completed,
      gradient: 'from-emerald-500/15 to-teal-500/15',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Revenue',
      value: formatPaise(stats.totalRevenue),
      gradient: 'from-gold/15 to-amber-600/15',
      textColor: 'text-gold',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/50 text-sm">Manage all meeting bookings across the platform</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                'rounded-2xl p-4 border border-white/[0.06] bg-gradient-to-br',
                card.gradient
              )}
            >
              <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium">{card.label}</p>
              <p className={cn('text-xl font-bold mt-1', card.textColor)}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, companion, or venue..."
            className="w-full bg-charcoal border border-charcoal-border text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-charcoal-surface border border-charcoal-border rounded-xl p-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                activeFilter === tab.value
                  ? 'bg-gold text-charcoal shadow-lg shadow-gold/20'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {tab.label}
              {tab.value !== 'ALL' && stats && (
                <span className="ml-1 text-[10px] opacity-60">
                  {stats[tab.value.toLowerCase() as keyof BookingStats]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Booking List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">
              {search ? 'No bookings match your search' : activeFilter !== 'ALL' ? `No ${activeFilter.toLowerCase()} bookings` : 'No bookings yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {bookings.map((booking) => {
              const clientName = booking.client?.clientProfile?.name ?? booking.client?.email ?? 'Unknown';
              const companionName = booking.companion?.companionProfile?.name ?? booking.companion?.email ?? 'Unknown';
              const clientAvatar = booking.client?.clientProfile?.avatarUrl;
              const companionAvatar = booking.companion?.companionProfile?.avatarUrl;
              const bookingDate = new Date(booking.date);
              const isPast = bookingDate < new Date();

              return (
                <div key={booking.id} className="py-4 space-y-3">
                  {/* Top row: people + status */}
                  <div className="flex items-start gap-3">
                    {/* Avatars */}
                    <div className="relative shrink-0">
                      {clientAvatar ? (
                        <img src={clientAvatar} alt={clientName} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-400">{clientName[0].toUpperCase()}</span>
                        </div>
                      )}
                      {companionAvatar ? (
                        <img src={companionAvatar} alt={companionName} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover border-2 border-charcoal-surface" />
                      ) : (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-500/15 flex items-center justify-center border-2 border-charcoal-surface">
                          <span className="text-[9px] font-semibold text-purple-400">{companionName[0].toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{clientName}</span>
                        <span className="text-white/30">→</span>
                        <span className="text-gold font-medium">{companionName}</span>
                      </div>

                      {/* Date & Duration */}
                      <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className={cn('text-white/70', isPast && booking.status === 'PENDING' && 'text-red-400')}>
                            {formatDate(booking.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-white/70">{booking.duration}h</span>
                        </div>
                        <span className="text-gold font-semibold">{formatCurrency(booking.totalAmount)}</span>
                      </div>

                      {/* Venue */}
                      {booking.venueName && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-xs text-white/50 truncate">
                            {booking.venueName}
                            {booking.venueAddress && ` · ${booking.venueAddress}`}
                          </span>
                        </div>
                      )}

                      {/* Notes */}
                      {booking.notes && (
                        <p className="text-xs text-white/40 mt-1 truncate max-w-md" title={booking.notes}>
                          Note: {booking.notes}
                        </p>
                      )}

                      {/* Timing */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-white/30">
                        <span>ID: {booking.id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>Created {timeAgo(booking.createdAt)}</span>
                      </div>
                    </div>

                    {/* Right: badges + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={STATUS_BADGE[booking.status] ?? 'default'}>
                          {booking.status}
                        </Badge>
                        <Badge variant={PAYMENT_STATUS_BADGE[booking.paymentStatus] ?? 'default'}>
                          {booking.paymentStatus}
                        </Badge>
                      </div>
                      <button
                        onClick={() => setDeleteTarget(booking)}
                        className="text-xs text-white/30 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete booking?"
        message={
          deleteTarget
            ? `This will permanently delete the booking between ${deleteTarget.client?.clientProfile?.name ?? 'client'} and ${deleteTarget.companion?.companionProfile?.name ?? 'companion'} for ${formatCurrency(deleteTarget.totalAmount)}. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={deleting}
      />
    </div>
  );
}
