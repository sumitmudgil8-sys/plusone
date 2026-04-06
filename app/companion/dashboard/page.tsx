'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { formatDateTime } from '@/lib/utils';

interface TodayBreakdown {
  chats: number;
  calls: number;
  bookings: number;
  total: number;
}

interface SessionRecord {
  id: string;
  type: string;
  clientName: string;
  clientAvatar: string | null;
  durationMinutes: number;
  earned: number;
  startedAt: string;
  endedAt: string | null;
}

interface ActiveSession {
  active: boolean;
  sessionId?: string;
  type?: string;
  totalCharged?: number;
  clientName?: string;
  clientId?: string;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function CompanionDashboard() {
  const [user, setUser] = useState<{ isOnline?: boolean; companionProfile?: { name?: string } } | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [today, setToday] = useState<TodayBreakdown | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const prevActiveRef = useState<boolean>(false);

  // Poll active session every 30s — show live earnings ticker
  useEffect(() => {
    const pollActive = async () => {
      try {
        const res = await fetch('/api/companion/active-session');
        if (res.ok) {
          const d = await res.json();
          const wasActive = prevActiveRef[0];
          setActiveSession(d.data);

          // If session just ended, refresh earnings data
          if (wasActive && !d.data.active) {
            const earningsRes = await fetch('/api/companion/earnings');
            if (earningsRes.ok) {
              const ed = await earningsRes.json();
              setToday(ed.data?.periods?.today ?? null);
            }
          }
          prevActiveRef[1](d.data.active);
        }
      } catch {
        // non-fatal
      }
    };

    pollActive();
    const interval = setInterval(pollActive, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, bookingsRes, earningsRes, sessionsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/bookings'),
          fetch('/api/companion/earnings'),
          fetch('/api/companion/sessions?limit=5'),
        ]);

        if (userRes.ok) {
          const d = await userRes.json();
          setUser(d.user);
        }
        if (bookingsRes.ok) {
          const d = await bookingsRes.json();
          setBookings(d.bookings ?? []);
        }
        if (earningsRes.ok) {
          const d = await earningsRes.json();
          setToday(d.data?.periods?.today ?? null);
        }
        if (sessionsRes.ok) {
          const d = await sessionsRes.json();
          setSessions(d.data?.sessions ?? []);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingBookings = bookings.filter((b) => b.status === 'PENDING');
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');

  const handleStatusChange = async (bookingId: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const d = await fetch('/api/bookings').then((r) => r.json());
        setBookings(d.bookings ?? []);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

  const handleToggleOnline = async () => {
    setTogglingOnline(true);
    try {
      const body: { latitude?: number; longitude?: number } = {};
      if (!isOnline && 'geolocation' in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              body.latitude = pos.coords.latitude;
              body.longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 5000 }
          );
        });
      }

      const res = await fetch('/api/companion/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const d = await res.json();
        setUser((prev) => prev ? { ...prev, isOnline: d.data.isOnline } : prev);
      }
    } catch (error) {
      console.error('Toggle online error:', error);
    } finally {
      setTogglingOnline(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const isOnline = user?.isOnline ?? false;

  return (
    <div className="space-y-6">
      {/* Header + availability toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.companionProfile?.name}
          </h1>
          <p className="text-white/60">Manage your bookings and profile</p>
        </div>

        <button
          onClick={handleToggleOnline}
          disabled={togglingOnline}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
            isOnline
              ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25'
              : 'bg-charcoal-surface border-charcoal-border text-white/50 hover:text-white hover:border-white/30'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* Active session ticker */}
      {activeSession?.active && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-400">
              Active {activeSession.type === 'VOICE' ? 'Voice' : 'Chat'} session
              {activeSession.clientName ? ` · ${activeSession.clientName}` : ''}
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              Earned so far: {fmt(activeSession.totalCharged ?? 0)} · updates every 30s
            </p>
          </div>
          {activeSession.clientId && (
            <Link href={`/companion/inbox/${activeSession.clientId}`} className="text-xs text-green-400 hover:underline shrink-0">
              Go to chat →
            </Link>
          )}
        </div>
      )}

      {/* Today's earnings breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-white">Today&apos;s Earnings</h2>
          <Link href="/companion/earnings" className="text-sm text-gold hover:underline">
            View Full Report
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { icon: '💬', label: 'Chats', value: today?.chats ?? 0 },
            { icon: '📞', label: 'Calls', value: today?.calls ?? 0 },
            { icon: '📅', label: 'Bookings', value: today?.bookings ?? 0 },
          ].map(({ icon, label, value }) => (
            <div key={label} className="rounded-xl p-3 bg-charcoal-surface border border-charcoal-border text-center">
              <p className="text-base mb-0.5">{icon}</p>
              <p className="text-sm font-bold text-white">{fmt(value)}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>
        <Card className="text-center py-3">
          <p className="text-xs text-white/40 mb-0.5">Total today</p>
          <p className="text-xl font-bold text-gold">{fmt(today?.total ?? 0)}</p>
        </Card>
      </div>

      {/* Pending Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Pending Requests</h2>
          <Link href="/companion/bookings" className="text-sm text-gold hover:underline">
            View All
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-white/60">No pending requests</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingBookings.slice(0, 3).map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                role="COMPANION"
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Bookings */}
      {confirmedBookings.length > 0 && (
        <div>
          <h2 className="font-medium text-white mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmedBookings.slice(0, 3).map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                role="COMPANION"
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Recent Sessions</h2>
          <Link href="/companion/earnings" className="text-sm text-gold hover:underline">
            View All
          </Link>
        </div>

        <Card>
          {sessions.length === 0 ? (
            <p className="text-white/50 text-center py-6 text-sm">No sessions yet</p>
          ) : (
            <div className="divide-y divide-charcoal-border">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.clientAvatar ? (
                      <img src={s.clientAvatar} alt={s.clientName}
                        className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-white">{s.clientName[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.clientName}</p>
                      <p className="text-xs text-white/40">
                        {s.type} · {s.durationMinutes}m · {s.endedAt ? formatDateTime(s.endedAt) : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-400 shrink-0">
                    +{fmt(s.earned)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
