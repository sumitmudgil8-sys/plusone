'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BookingCard } from '@/components/booking/BookingCard';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import { CLIENT_APPROVAL_ENABLED } from '@/lib/constants';

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

const BADGE_DEFS = [
  {
    type: 'TOP_RATED',
    label: 'Top Rated',
    icon: '\u2B50',
    description: '4.5+ rating with 20+ sessions',
    bgActive: 'bg-amber-500/10',
    borderActive: 'border-amber-500/25',
    iconColor: 'text-amber-400',
  },
  {
    type: 'FAST_RESPONDER',
    label: 'Fast Responder',
    icon: '\u26A1',
    description: 'Avg response under 60 seconds',
    bgActive: 'bg-emerald-500/10',
    borderActive: 'border-emerald-500/25',
    iconColor: 'text-emerald-400',
  },
  {
    type: 'ELITE',
    label: 'Elite',
    icon: '\uD83D\uDC8E',
    description: '100+ sessions over 6+ months',
    bgActive: 'bg-purple-500/10',
    borderActive: 'border-purple-500/25',
    iconColor: 'text-purple-400',
  },
  {
    type: 'RISING_STAR',
    label: 'Rising Star',
    icon: '\uD83D\uDE80',
    description: '4.3+ rating, 5+ sessions in 60 days',
    bgActive: 'bg-blue-500/10',
    borderActive: 'border-blue-500/25',
    iconColor: 'text-blue-400',
  },
] as const;

export default function CompanionDashboard() {
  const toast = useToast();
  const [user, setUser] = useState<{ isOnline?: boolean; hasCompletedOnboarding?: boolean; companionProfile?: { name?: string }; companionImages?: { id: string }[] } | null>(null);
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

  // Badge state
  const [badges, setBadges] = useState<{ type: string; isActive: boolean; earnedAt: string | null }[]>([]);
  const [rankingScore, setRankingScore] = useState<number | null>(null);

  // Scheduled sessions
  const [scheduledSessions, setScheduledSessions] = useState<Array<{
    id: string; duration: number; scheduledAt: string; status: string;
    clientName: string; clientAvatar: string | null; holdAmount: number; estimatedTotal: number;
  }>>([]);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const [reminderShown, setReminderShown] = useState<Set<string>>(new Set());

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
        const [userRes, bookingsRes, earningsRes, sessionsRes, badgesRes, schedRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/bookings'),
          fetch('/api/companion/earnings'),
          fetch('/api/companion/sessions?limit=5'),
          fetch('/api/companion/badges'),
          fetch('/api/scheduled-sessions?status=BOOKED'),
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
        if (badgesRes.ok) {
          const d = await badgesRes.json();
          if (d.success) {
            setBadges(d.data.badges ?? []);
            setRankingScore(d.data.rankingScore ?? null);
          }
        }
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          if (schedData.success) setScheduledSessions(schedData.data);
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

  // Cancel a scheduled session
  const handleCancelScheduled = useCallback(async (sessionId: string) => {
    setCancellingSessionId(sessionId);
    try {
      const res = await fetch(`/api/scheduled-sessions/${sessionId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScheduledSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast.success('Session cancelled');
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCancellingSessionId(null);
    }
  }, [toast]);

  // 15-minute reminder for upcoming sessions
  useEffect(() => {
    if (scheduledSessions.length === 0) return;
    const check = () => {
      const now = Date.now();
      for (const s of scheduledSessions) {
        if (reminderShown.has(s.id)) continue;
        const diff = new Date(s.scheduledAt).getTime() - now;
        if (diff > 0 && diff <= 15 * 60 * 1000) {
          toast.info(`Chat with ${s.clientName} starts in ${Math.ceil(diff / 60000)} min`);
          setReminderShown((prev) => new Set(prev).add(s.id));
        }
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [scheduledSessions, reminderShown, toast]);

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
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isOnline = user?.isOnline ?? false;
  const isAvailabilitySet = hasAnySlots(schedule);
  const summary = buildSummary(schedule);
  const firstName = user?.companionProfile?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/[0.12] bg-gradient-to-br from-amber-500/[0.08] via-[#0f0f1a] to-[#0f0f1a] p-5">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/[0.12] blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-24 bg-gradient-to-t from-amber-500/[0.05] to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold">Dashboard</p>
            <h1 className="text-[26px] font-bold text-white mt-1.5 leading-tight truncate">
              Hi {firstName} <span className="inline-block">👋</span>
            </h1>
            <p className="text-sm text-white/45 mt-1">Here&apos;s how today is going</p>
          </div>
          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all disabled:opacity-50 shrink-0 ${
              isOnline
                ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25 shadow-lg shadow-green-500/10'
                : 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:border-white/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>
      </div>

      {/* ── Onboarding Tour Banner ───────────────────────────────────── */}
      {user && !user.hasCompletedOnboarding && (
        <Link
          href="/companion/onboarding-tour"
          className="group relative flex items-center gap-4 p-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.12] via-[#1a1710] to-amber-500/[0.06] hover:border-gold/50 transition-all overflow-hidden animate-fade-in"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gold/[0.1] blur-3xl pointer-events-none" />
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-gold/25 to-amber-500/15 border border-gold/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-semibold text-gold">Complete Onboarding Tour</p>
            <p className="text-xs text-white/40 mt-0.5">Required before you can go online and accept sessions</p>
          </div>
          <svg className="w-4 h-4 text-white/25 group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* ── No Primary Image Warning ─────────────────────────────────── */}
      {user && user.companionImages !== undefined && user.companionImages.length === 0 && (
        <Link
          href="/companion/profile"
          className="group relative flex items-center gap-4 p-4 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/[0.10] via-[#1a1010] to-red-500/[0.05] hover:border-red-500/50 transition-all overflow-hidden animate-fade-in"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-red-500/[0.08] blur-3xl pointer-events-none" />
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">Profile not visible to clients</p>
            <p className="text-xs text-white/40 mt-0.5">Upload at least one photo and set it as your main profile picture to appear in search results</p>
          </div>
          <svg className="w-4 h-4 text-white/25 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* ── Client Approvals CTA — only shown when approval flow is enabled ── */}
      {CLIENT_APPROVAL_ENABLED && (
        <Link
          href="/companion/client-approvals"
          className="group relative flex items-center gap-4 p-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/[0.08] via-[#12121d] to-amber-500/[0.06] hover:border-purple-500/30 transition-all overflow-hidden"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-purple-500/[0.08] blur-3xl pointer-events-none" />
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-amber-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Client Approvals</p>
            <p className="text-xs text-white/40 mt-0.5">Review new clients — only approved ones see your profile</p>
          </div>
          <svg className="w-4 h-4 text-white/25 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* ── Badges & Ranking ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f1a] overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Your Badges</p>
              {rankingScore !== null && (
                <p className="text-xs text-white/40 mt-0.5">Ranking score: <span className="text-amber-400 font-semibold">{rankingScore.toFixed(0)}/100</span></p>
              )}
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {BADGE_DEFS.map((def) => {
              const badge = badges.find((b) => b.type === def.type);
              const earned = badge?.isActive ?? false;
              return (
                <div
                  key={def.type}
                  className={`relative rounded-xl p-3 border transition-colors ${
                    earned
                      ? `${def.bgActive} ${def.borderActive}`
                      : 'bg-white/[0.02] border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-base ${earned ? def.iconColor : 'grayscale opacity-30'}`}>{def.icon}</span>
                    <span className={`text-xs font-semibold ${earned ? 'text-white' : 'text-white/30'}`}>{def.label}</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${earned ? 'text-white/50' : 'text-white/20'}`}>{def.description}</p>
                  {earned && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Today's earnings spotlight ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#12121d] via-[#0f0f1a] to-[#0f0f1a] p-5">
        <div className="absolute -top-8 -right-12 w-48 h-48 rounded-full bg-gradient-to-bl from-amber-500/[0.12] to-transparent blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-[0.14em] font-semibold">Today&apos;s Earnings</p>
              <p className="text-[38px] font-bold text-white tabular-nums mt-1 leading-none bg-gradient-to-br from-white to-amber-100 bg-clip-text text-transparent">
                {fmt(today?.total ?? 0)}
              </p>
            </div>
            <Link
              href="/companion/earnings"
              className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/25 rounded-full px-3 py-1.5 hover:bg-amber-500/15 transition-colors shrink-0 flex items-center gap-1"
            >
              Full Report
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Chats',
                value: today?.chats ?? 0,
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
              },
              {
                label: 'Calls',
                value: today?.calls ?? 0,
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                ),
              },
              {
                label: 'Bookings',
                value: today?.bookings ?? 0,
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-2xl p-3 bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-colors">
                <div className="flex items-center gap-1.5 text-amber-400/80 mb-1.5">
                  {icon}
                  <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
                </div>
                <p className="text-[15px] font-bold text-white tabular-nums">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Availability Section ── */}
      <div className="rounded-2xl border border-charcoal-border bg-charcoal-surface overflow-hidden">
        {/* Available Now toggle + header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isAvailabilitySet
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-white/[0.04] border border-white/[0.06]'
            }`}>
              <svg className={`w-5 h-5 ${isAvailabilitySet ? 'text-amber-400' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Availability</p>
              {isAvailabilitySet ? (
                <p className="text-xs text-white/40 mt-0.5">{summary}</p>
              ) : (
                <p className="text-xs text-amber-400 mt-0.5">Not set — clients can&apos;t schedule chats</p>
              )}
            </div>
          </div>
          {!editingAvailability && (
            <button
              onClick={openEditor}
              className="text-xs text-amber-400 font-semibold hover:text-amber-300 transition-colors px-3 py-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 hover:bg-amber-500/10"
            >
              {isAvailabilitySet ? 'Edit' : 'Set up'}
            </button>
          )}
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
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
                        className="text-[10px] text-white/25 hover:text-amber-400 transition-colors whitespace-nowrap"
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
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                {savingAvailability ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Active session ticker ─────────────────────────────────────── */}
      {activeSession?.active && (
        <div className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-green-500/15 via-green-500/[0.08] to-green-500/[0.04] border border-green-500/30">
          <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-green-500/20 blur-2xl pointer-events-none" />
          <div className="relative w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-300">
              Live {activeSession.type === 'VOICE' ? 'voice call' : 'chat'}
              {activeSession.clientName ? ` · ${activeSession.clientName}` : ''}
            </p>
            <p className="text-xs text-white/55 mt-0.5 tabular-nums">
              Earned so far: <span className="text-green-400 font-semibold">{fmt(activeSession.totalCharged ?? 0)}</span>
            </p>
          </div>
          {activeSession.clientId && (
            <Link
              href={`/companion/inbox?active=${activeSession.clientId}`}
              className="relative text-xs text-green-300 font-semibold bg-green-500/15 border border-green-500/25 rounded-full px-3 py-1.5 hover:bg-green-500/25 transition-colors shrink-0"
            >
              Open →
            </Link>
          )}
        </div>
      )}

      {/* ── Scheduled Sessions ────────────────────────────────────────── */}
      {scheduledSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Scheduled</h2>
              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-gold text-black text-[10px] font-bold flex items-center justify-center">
                {scheduledSessions.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {scheduledSessions.map((s) => {
              const dt = new Date(s.scheduledAt);
              const diffMs = dt.getTime() - Date.now();
              const isSoon = diffMs > 0 && diffMs <= 15 * 60 * 1000;
              const timeLabel = diffMs <= 0
                ? 'Now'
                : diffMs < 60 * 60 * 1000
                  ? `in ${Math.ceil(diffMs / 60000)} min`
                  : diffMs < 24 * 60 * 60 * 1000
                    ? `in ${Math.floor(diffMs / 3600000)}h`
                    : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return (
                <div key={s.id} className={`rounded-xl bg-charcoal-surface border px-4 py-3 flex items-center gap-3 ${isSoon ? 'border-gold/30' : 'border-white/[0.06]'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSoon ? 'bg-gold/20 border border-gold/40' : 'bg-gold/10 border border-gold/20'}`}>
                    <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-medium truncate">{s.duration}min chat with {s.clientName}</p>
                      {isSoon && <span className="shrink-0 text-[9px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">SOON</span>}
                    </div>
                    <p className="text-xs text-white/40">
                      {timeLabel}
                      {' · '}
                      {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}Earn ≈ {fmt(Math.round(s.estimatedTotal * 0.8))}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelScheduled(s.id)}
                    disabled={cancellingSessionId === s.id}
                    className="shrink-0 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancellingSessionId === s.id ? '...' : 'Cancel'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Requests ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pending</h2>
            {pendingBookings.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {pendingBookings.length}
              </span>
            )}
          </div>
          <Link href="/companion/bookings" className="text-xs text-amber-400 font-medium hover:text-amber-300 transition-colors">
            View all →
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f1a] p-6 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
              <svg className="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs text-white/35">No pending requests</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* ── Upcoming Bookings ─────────────────────────────────────────── */}
      {confirmedBookings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Upcoming</h2>
            <Link href="/companion/bookings" className="text-xs text-amber-400 font-medium hover:text-amber-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* ── Recent Sessions ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent sessions</h2>
          <Link href="/companion/earnings" className="text-xs text-amber-400 font-medium hover:text-amber-300 transition-colors">
            View all →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f1a] overflow-hidden">
          {sessions.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
                <svg className="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-white/35">No sessions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {sessions.map((s) => {
                const typeIcon = s.type === 'VOICE' ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                ) : s.type === 'CHAT' ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                );
                return (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {s.clientAvatar ? (
                          <img src={s.clientAvatar} alt={s.clientName}
                            className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                            <span className="text-sm font-semibold text-amber-300">{s.clientName[0]}</span>
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0f0f1a] border border-white/[0.08] flex items-center justify-center text-white/60">
                          {typeIcon}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-tight">{s.clientName}</p>
                        <p className="text-[11px] text-white/35 mt-0.5 tabular-nums">
                          {s.durationMinutes}m · {s.endedAt ? formatDateTime(s.endedAt) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-green-400 font-bold text-sm tabular-nums">
                      <span className="text-xs">+</span>{fmt(s.earned)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
