'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { useToast } from '@/components/ui/Toast';
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

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type SlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
type WeeklySchedule = Record<DayKey, SlotKey[]>;

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
];

const SLOTS: { key: SlotKey; label: string; time: string }[] = [
  { key: 'MORNING', label: 'Morning', time: '6 AM – 12 PM' },
  { key: 'AFTERNOON', label: 'Afternoon', time: '12 – 5 PM' },
  { key: 'EVENING', label: 'Evening', time: '5 – 9 PM' },
  { key: 'NIGHT', label: 'Night', time: '9 PM – 12 AM' },
];

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function emptySchedule(): WeeklySchedule {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function hasAnySlots(schedule: WeeklySchedule): boolean {
  return Object.values(schedule).some((slots) => slots.length > 0);
}

function buildSummary(schedule: WeeklySchedule): string {
  const activeDays = DAYS.filter((d) => (schedule[d.key]?.length ?? 0) > 0);
  if (activeDays.length === 0) return '';
  if (activeDays.length === 7) {
    const allSlots = new Set(activeDays.flatMap((d) => schedule[d.key]));
    if (allSlots.size === 4) return 'Every day, all day';
    const slotLabels = SLOTS.filter((s) => allSlots.has(s.key)).map((s) => s.label);
    return `Every day · ${slotLabels.join(', ')}`;
  }
  const dayLabels = activeDays.map((d) => d.short).join(', ');
  const allSlots = new Set(activeDays.flatMap((d) => schedule[d.key]));
  const slotLabels = SLOTS.filter((s) => allSlots.has(s.key)).map((s) => s.label);
  return `${dayLabels} · ${slotLabels.join(', ')}`;
}

export default function CompanionDashboard() {
  const toast = useToast();
  const [user, setUser] = useState<{ isOnline?: boolean; companionProfile?: { name?: string } } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookings, setBookings] = useState<any[]>([]);
  const [today, setToday] = useState<TodayBreakdown | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const prevActiveRef = useState<boolean>(false);

  // Availability state
  const [schedule, setSchedule] = useState<WeeklySchedule>(emptySchedule());
  const [availableNow, setAvailableNow] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState<WeeklySchedule>(emptySchedule());
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [togglingAvailableNow, setTogglingAvailableNow] = useState(false);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch('/api/companion/weekly-availability');
      if (res.ok) {
        const d = await res.json();
        const s = { ...emptySchedule(), ...(d.data?.schedule ?? {}) };
        setSchedule(s);
        setAvailableNow(d.data?.availableNow ?? false);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // Poll active session every 30s
  useEffect(() => {
    const pollActive = async () => {
      try {
        const res = await fetch('/api/companion/active-session');
        if (res.ok) {
          const d = await res.json();
          const wasActive = prevActiveRef[0];
          setActiveSession(d.data);
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
    fetchAvailability();
  }, [fetchAvailability]);

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
        const verb =
          status === 'CONFIRMED' ? 'accepted' :
          status === 'CANCELLED' ? 'declined' :
          status.toLowerCase();
        toast.success(`Booking ${verb}`);
        const d = await fetch('/api/bookings').then((r) => r.json());
        setBookings(d.bookings ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to update booking');
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Network error — please try again');
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
        toast.success(d.data.isOnline ? 'You are now online' : 'You are now offline');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to update status');
      }
    } catch (error) {
      console.error('Toggle online error:', error);
      toast.error('Network error — please try again');
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleToggleAvailableNow = async () => {
    setTogglingAvailableNow(true);
    const newVal = !availableNow;
    try {
      const res = await fetch('/api/companion/weekly-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableNow: newVal }),
      });
      if (res.ok) {
        setAvailableNow(newVal);
      } else {
        toast.error('Failed to update availability');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setTogglingAvailableNow(false);
    }
  };

  const openEditor = () => {
    setDraftSchedule({ ...emptySchedule(), ...JSON.parse(JSON.stringify(schedule)) });
    setEditingAvailability(true);
  };

  const toggleSlot = (day: DayKey, slot: SlotKey) => {
    setDraftSchedule((prev) => {
      const current = prev[day] ?? [];
      const has = current.includes(slot);
      return {
        ...prev,
        [day]: has ? current.filter((s) => s !== slot) : [...current, slot],
      };
    });
  };

  const applyToAllDays = (sourceDay: DayKey) => {
    const sourceSlots = draftSchedule[sourceDay] ?? [];
    setDraftSchedule((prev) => {
      const next = { ...prev };
      for (const d of DAYS) {
        next[d.key] = [...sourceSlots];
      }
      return next;
    });
  };

  const selectAllForDay = (day: DayKey) => {
    const current = draftSchedule[day] ?? [];
    const allSelected = SLOTS.every((s) => current.includes(s.key));
    setDraftSchedule((prev) => ({
      ...prev,
      [day]: allSelected ? [] : SLOTS.map((s) => s.key),
    }));
  };

  const saveSchedule = async () => {
    setSavingAvailability(true);
    try {
      const res = await fetch('/api/companion/weekly-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: draftSchedule }),
      });
      if (res.ok) {
        setSchedule(draftSchedule);
        setEditingAvailability(false);
        toast.success('Schedule saved');
      } else {
        toast.error('Failed to save schedule');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSavingAvailability(false);
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
  const isAvailabilitySet = hasAnySlots(schedule);
  const summary = buildSummary(schedule);

  return (
    <div className="space-y-6">
      {/* Header + online toggle */}
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
              : 'bg-charcoal-surface border-white/[0.06] text-white/50 hover:text-white hover:border-white/20'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* ── Availability Section ── */}
      <div className="rounded-2xl border border-charcoal-border bg-charcoal-surface overflow-hidden">
        {/* Available Now toggle + header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              availableNow
                ? 'bg-green-500/15 border border-green-500/30'
                : isAvailabilitySet
                  ? 'bg-gold/10 border border-gold/20'
                  : 'bg-white/[0.04] border border-white/[0.06]'
            }`}>
              <svg className={`w-5 h-5 ${availableNow ? 'text-green-400' : isAvailabilitySet ? 'text-gold' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Availability</p>
              {isAvailabilitySet ? (
                <p className="text-xs text-white/40 mt-0.5">{summary}</p>
              ) : (
                <p className="text-xs text-amber-400 mt-0.5">Not set — clients can&apos;t find you</p>
              )}
            </div>
          </div>
          {!editingAvailability && (
            <button
              onClick={openEditor}
              className="text-xs text-gold font-medium hover:text-gold/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-gold/5"
            >
              {isAvailabilitySet ? 'Edit' : 'Set up'}
            </button>
          )}
        </div>

        {/* Available Now toggle row */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Available right now</p>
            <p className="text-xs text-white/35">Override schedule — appear available instantly</p>
          </div>
          <button
            onClick={handleToggleAvailableNow}
            disabled={togglingAvailableNow}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              availableNow ? 'bg-green-500' : 'bg-white/[0.12]'
            } ${togglingAvailableNow ? 'opacity-50' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
              availableNow ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* No availability warning */}
        {!isAvailabilitySet && !editingAvailability && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
            <p className="text-xs text-amber-400/90">
              Set your weekly availability so clients can discover and book you at the right times.
            </p>
          </div>
        )}

        {/* ── Inline Availability Editor ── */}
        {editingAvailability && (
          <div className="border-t border-charcoal-border">
            {/* Slot legend */}
            <div className="px-4 pt-4 pb-2 flex flex-wrap gap-2">
              {SLOTS.map((slot) => (
                <span key={slot.key} className="text-[10px] text-white/35 font-medium">
                  {slot.label} <span className="text-white/20">{slot.time}</span>
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="px-4 pb-3 space-y-2">
              {DAYS.map((day) => {
                const daySlots = draftSchedule[day.key] ?? [];
                const allSelected = SLOTS.every((s) => daySlots.includes(s.key));

                return (
                  <div key={day.key} className="flex items-center gap-2">
                    {/* Day label — tap to select/deselect all */}
                    <button
                      onClick={() => selectAllForDay(day.key)}
                      className={`w-10 text-xs font-semibold text-left transition-colors ${
                        daySlots.length > 0 ? 'text-white' : 'text-white/30'
                      }`}
                    >
                      {day.short}
                    </button>

                    {/* Slot buttons */}
                    <div className="flex gap-1.5 flex-1">
                      {SLOTS.map((slot) => {
                        const active = daySlots.includes(slot.key);
                        return (
                          <button
                            key={slot.key}
                            onClick={() => toggleSlot(day.key, slot.key)}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                              active
                                ? 'bg-gold/20 text-gold border border-gold/30'
                                : 'bg-white/[0.03] text-white/25 border border-transparent hover:bg-white/[0.06] hover:text-white/40'
                            }`}
                          >
                            {slot.label.slice(0, 4)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Apply to all button */}
                    {daySlots.length > 0 && (
                      <button
                        onClick={() => applyToAllDays(day.key)}
                        className="text-[10px] text-white/25 hover:text-gold transition-colors whitespace-nowrap"
                        title="Apply to all days"
                      >
                        All
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save / Cancel */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => setEditingAvailability(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSchedule}
                disabled={savingAvailability}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-black bg-gold hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {savingAvailability ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
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
            <div key={label} className="rounded-xl p-3 bg-charcoal-surface border border-white/[0.06] text-center">
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
            <div className="divide-y divide-white/[0.06]">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.clientAvatar ? (
                      <img src={s.clientAvatar} alt={s.clientName}
                        className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
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
