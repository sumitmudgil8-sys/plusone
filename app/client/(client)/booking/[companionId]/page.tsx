'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { CompanionProfile } from '@/components/companion/CompanionProfile';
import { ReviewSection } from '@/components/reviews/ReviewComponents';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSocket } from '@/hooks/useSocket';
import { buildCalendarUrl } from '@/lib/utils';

const CHAT_REQUEST_TIMEOUT_S = 180; // 3 minutes
const SCHEDULE_DURATIONS = [15, 30] as const;

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type SlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

const SLOT_META: Record<SlotKey, { label: string; startHour: number; endHour: number }> = {
  MORNING:   { label: 'Morning',   startHour: 6,  endHour: 12 },
  AFTERNOON: { label: 'Afternoon', startHour: 12, endHour: 17 },
  EVENING:   { label: 'Evening',   startHour: 17, endHour: 21 },
  NIGHT:     { label: 'Night',     startHour: 21, endHour: 24 },
};

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getTimesForSlot(slot: SlotKey): string[] {
  const { startHour, endHour } = SLOT_META[slot];
  const times: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`);
    times.push(`${String(h).padStart(2, '0')}:30`);
  }
  return times;
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

type ChatRequestStatus = 'idle' | 'sending' | 'waiting' | 'accepted' | 'declined' | 'expired' | 'insufficient_balance';
type ScheduleStatus = 'idle' | 'form' | 'booking' | 'success' | 'error';

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const companionId = params.companionId as string;

  const [companion, setCompanion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const startTimeRef = useRef(Date.now());

  // Chat request state
  const [userId, setUserId] = useState<string | undefined>();
  const [chatRequestStatus, setChatRequestStatus] = useState<ChatRequestStatus>('idle');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatSessionIdRef = useRef<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHAT_REQUEST_TIMEOUT_S);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [insufficientBalanceDetails, setInsufficientBalanceDetails] = useState<{
    required: number;
    current: number;
    ratePerMinute: number;
  } | null>(null);

  // Schedule state
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('idle');
  const [scheduleDuration, setScheduleDuration] = useState<15 | 30>(15);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState<SlotKey | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleResult, setScheduleResult] = useState<{
    sessionId: string;
    holdAmount: number;
    estimatedTotal: number;
    scheduledAt: string;
  } | null>(null);

  // Fetch current user ID for Ably socket
  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (companionId) fetchCompanion();

    return () => {
      const durationMs = Date.now() - startTimeRef.current;
      if (durationMs > 2000) {
        navigator.sendBeacon(
          '/api/client/profile-view',
          new Blob(
            [JSON.stringify({ companionId, durationMs })],
            { type: 'application/json' }
          )
        );
      }
    };
  }, [companionId]);

  // Subscribe to chat accepted/declined events via Ably
  const { onChatRequestResponse } = useSocket(userId, 'CLIENT');

  // Keep ref in sync so the subscription doesn't need to re-register on sessionId changes
  useEffect(() => { chatSessionIdRef.current = chatSessionId; }, [chatSessionId]);

  useEffect(() => {
    if (!userId) return;
    return onChatRequestResponse((data) => {
      if (chatSessionIdRef.current && data.sessionId !== chatSessionIdRef.current) return;
      if (data.status === 'ACCEPTED') {
        setChatRequestStatus('accepted');
        setTimeout(() => router.push(`/client/inbox/${companionId}`), 800);
      } else {
        setChatRequestStatus('declined');
      }
    });
  }, [userId, onChatRequestResponse, companionId, router]);

  // Poll session-status while waiting — catches missed Ably chat:accepted events
  useEffect(() => {
    if (chatRequestStatus !== 'waiting' || !chatSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/session-status?companionId=${companionId}`);
        const d = await res.json();
        if (d.data?.status === 'ACTIVE') {
          clearInterval(interval);
          setChatRequestStatus('accepted');
          setTimeout(() => router.push(`/client/inbox/${companionId}`), 800);
        } else if (d.data?.status === 'EXPIRED' || d.data?.status === 'NONE') {
          clearInterval(interval);
          setChatRequestStatus('expired');
        }
      } catch { /* non-fatal */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [chatRequestStatus, chatSessionId, companionId, router]);

  // Countdown timer while waiting
  useEffect(() => {
    if (chatRequestStatus !== 'waiting') return;

    // Compute initial seconds from expiresAt if available
    const initial = expiresAt
      ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : CHAT_REQUEST_TIMEOUT_S;
    setTimeLeft(initial);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setChatRequestStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [chatRequestStatus, expiresAt]);

  const handleChatRequest = useCallback(async () => {
    setChatRequestStatus('sending');
    try {
      const res = await fetch('/api/billing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId, type: 'CHAT' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_BALANCE') {
          setInsufficientBalanceDetails({
            required: data.required,
            current: data.current,
            ratePerMinute: data.ratePerMinute,
          });
          setChatRequestStatus('insufficient_balance');
          return;
        }
        setChatRequestStatus('idle');
        return;
      }
      if (!data.success) {
        setChatRequestStatus('idle');
        return;
      }
      setChatSessionId(data.data.sessionId);
      setExpiresAt(data.data.expiresAt ?? null);
      // If already ACTIVE (resumed), go straight to inbox
      if (!data.data.pending) {
        router.push(`/client/inbox/${companionId}`);
        return;
      }
      setChatRequestStatus('waiting');
    } catch {
      setChatRequestStatus('idle');
    }
  }, [companionId, router]);

  const handleScheduleBook = useCallback(async () => {
    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please select a date and time');
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (isNaN(scheduledAt.getTime())) {
      setScheduleError('Invalid date/time');
      return;
    }
    if (scheduledAt.getTime() < Date.now() + 55 * 60 * 1000) {
      setScheduleError('Must be at least 1 hour from now');
      return;
    }

    setScheduleStatus('booking');
    setScheduleError('');
    try {
      const res = await fetch('/api/scheduled-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          duration: scheduleDuration,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === 'INSUFFICIENT_BALANCE') {
          setScheduleError(`Insufficient balance. Need ₹${Math.ceil((data.required ?? 0) / 100)} for the hold.`);
        } else {
          setScheduleError(data.error || 'Booking failed');
        }
        setScheduleStatus('error');
        return;
      }
      setScheduleResult(data.data);
      setScheduleStatus('success');
    } catch {
      setScheduleError('Network error');
      setScheduleStatus('error');
    }
  }, [companionId, scheduleDate, scheduleTime, scheduleDuration]);

  const fetchCompanion = async () => {
    try {
      const res = await fetch(`/api/companions/${companionId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Companion not found');
        return;
      }

      setCompanion(data.companion);
    } catch (error) {
      console.error('Error fetching companion:', error);
      setError('Failed to load companion');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !companion) {
    return (
      <Card className="text-center py-12">
        <p className="text-error mb-4">{error || 'Companion not found'}</p>
        <Link href="/client/browse">
          <Button>Browse Companions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-charcoal-border">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'reviews', label: `Reviews (${companion.reviewCount || 0})` },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-gold border-b-2 border-gold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <CompanionProfile
            companion={companion}
            onChatClick={handleChatRequest}
            onBookClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
            onScheduleClick={() => document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' })}
            showActions={companion.accessible}
          />
        )}

        {activeTab === 'reviews' && (
          <Card>
            <ReviewSection
              companionId={companion.id}
              averageRating={companion.averageRating || 0}
              reviewCount={companion.reviewCount || 0}
            />
          </Card>
        )}
      </div>

      <div id="booking-form" className="space-y-6">
        {/* Schedule a Chat — shown FIRST when companion is offline */}
        {companion.accessible && (
          <Card id="schedule-form">
            <h2 className="text-lg font-bold text-white mb-1">Schedule a Chat</h2>
            <p className="text-white/50 text-xs mb-4">Book a guaranteed chat slot. Full amount held from your wallet.</p>

            {scheduleStatus === 'success' && scheduleResult ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-success-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Session Booked!</p>
                <div className="text-xs text-white/50 space-y-1">
                  <p>Hold: ₹{(scheduleResult.holdAmount / 100).toFixed(0)}</p>
                  <p>Scheduled: {new Date(scheduleResult.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <p className="text-[10px] text-white/30">You&apos;ll be able to start the chat near the scheduled time.</p>

                {/* Reminder prompt */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-amber-400">Set a reminder</p>
                      <p className="text-[10px] text-white/40 mt-0.5">Web notifications aren&apos;t always reliable. Add this to your calendar.</p>
                    </div>
                  </div>
                  <a
                    href={buildCalendarUrl({
                      title: `Plus One — Chat with ${companion?.name ?? 'Companion'}`,
                      startDate: new Date(scheduleResult.scheduledAt),
                      durationMinutes: scheduleDuration,
                      description: `Scheduled ${scheduleDuration}-min chat session on Plus One`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-white font-medium transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add to Calendar
                  </a>
                </div>

                <Button variant="outline" onClick={() => { setScheduleStatus('idle'); setScheduleResult(null); }} className="w-full">Done</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Duration */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Duration</label>
                  <div className="flex gap-2">
                    {SCHEDULE_DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setScheduleDuration(d)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          scheduleDuration === d
                            ? 'bg-gold/15 border-gold/40 text-gold'
                            : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15'
                        }`}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => { setScheduleDate(e.target.value); setScheduleSlot(null); setScheduleTime(''); setScheduleError(''); }}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                </div>

                {/* Available Slots (from companion's weekly schedule) */}
                {scheduleDate && (() => {
                  const weekly = companion.weeklyAvailability ?? {};
                  const dayIdx = new Date(scheduleDate + 'T00:00').getDay(); // 0=sun
                  const dayKey = DAY_KEYS[dayIdx];
                  const slotsForDay: SlotKey[] = weekly[dayKey] ?? [];
                  const hasSlots = slotsForDay.length > 0;

                  return (
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">
                        {hasSlots ? 'Available windows' : 'Availability'}
                      </label>
                      {!hasSlots ? (
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                          <p className="text-xs text-white/40">{companion.name} hasn&apos;t set availability for this day</p>
                          <p className="text-[10px] text-white/25 mt-1">Try another date or chat now if they&apos;re online</p>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {slotsForDay.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => { setScheduleSlot(slot); setScheduleTime(''); setScheduleError(''); }}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                scheduleSlot === slot
                                  ? 'bg-gold/15 border-gold/40 text-gold'
                                  : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15'
                              }`}
                            >
                              {SLOT_META[slot].label}
                              <span className="text-[10px] ml-1 opacity-60">
                                {SLOT_META[slot].startHour > 12 ? SLOT_META[slot].startHour - 12 : SLOT_META[slot].startHour}
                                {SLOT_META[slot].startHour >= 12 ? 'PM' : 'AM'}
                                –
                                {(SLOT_META[slot].endHour % 24) > 12 ? (SLOT_META[slot].endHour % 24) - 12 : SLOT_META[slot].endHour % 24 || 12}
                                {SLOT_META[slot].endHour >= 12 ? (SLOT_META[slot].endHour === 24 ? 'AM' : 'PM') : 'AM'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Time picker within selected slot */}
                {scheduleSlot && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Pick a time</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {getTimesForSlot(scheduleSlot).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setScheduleTime(t); setScheduleError(''); }}
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                            scheduleTime === t
                              ? 'bg-gold/15 border-gold/40 text-gold'
                              : 'bg-white/5 border-white/[0.06] text-white/60 hover:border-white/15'
                          }`}
                        >
                          {formatTime(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost breakdown */}
                {companion.chatRatePerMinute && (
                  <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/50">Rate</span>
                      <span className="text-white">₹{(companion.chatRatePerMinute / 100).toFixed(0)}/min</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/50">Est. total ({scheduleDuration} min)</span>
                      <span className="text-white">₹{((companion.chatRatePerMinute * scheduleDuration) / 100).toFixed(0)}</span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-1 flex justify-between text-xs">
                      <span className="text-gold font-medium">Amount on hold</span>
                      <span className="text-gold font-medium">₹{Math.ceil((companion.chatRatePerMinute * scheduleDuration) / 100)}</span>
                    </div>
                  </div>
                )}

                {scheduleError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {scheduleError}
                  </p>
                )}

                <Button
                  onClick={handleScheduleBook}
                  disabled={scheduleStatus === 'booking' || !scheduleDate || !scheduleTime}
                  className="w-full"
                >
                  {scheduleStatus === 'booking' ? 'Booking…' : 'Book Scheduled Chat'}
                </Button>

                <p className="text-[10px] text-white/30 text-center leading-relaxed">
                  Cancel free up to 1 hour before. Client no-show forfeits the hold. Companion no-show releases it back.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Offline booking (in-person meeting) */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Book a Meeting</h2>
            {companion.isVerified && (
              <Badge variant="success">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </Badge>
            )}
          </div>

          <BookingForm
            companionId={companion.id}
            companionName={companion.name}
            hourlyRate={companion.hourlyRate}
            availability={companion.availability || []}
            weeklyAvailability={companion.weeklyAvailability}
          />
        </Card>
      </div>

      {/* Chat request overlay */}
      {chatRequestStatus !== 'idle' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <Card className="max-w-sm w-full p-8 text-center space-y-5">
            {chatRequestStatus === 'sending' && (
              <>
                <div className="animate-spin h-10 w-10 border-2 border-gold border-t-transparent rounded-full mx-auto" />
                <p className="text-white font-medium">Sending request…</p>
              </>
            )}

            {chatRequestStatus === 'waiting' && (
              <>
                <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">Waiting for {companion.name}…</p>
                  <p className="text-white/50 text-sm mt-1">Request expires in {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
                </div>
                <div className="w-full bg-white/[0.08] rounded-full h-1">
                  <div
                    className="bg-gold h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / CHAT_REQUEST_TIMEOUT_S) * 100}%` }}
                  />
                </div>
                <Button variant="outline" onClick={() => setChatRequestStatus('idle')} className="w-full">
                  Cancel
                </Button>
              </>
            )}

            {chatRequestStatus === 'accepted' && (
              <>
                <div className="w-16 h-16 rounded-full bg-success/20 border-2 border-success/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-success-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Request accepted! Joining chat…</p>
              </>
            )}

            {chatRequestStatus === 'declined' && (
              <>
                <div className="w-16 h-16 rounded-full bg-error/20 border-2 border-error/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-error-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">{companion.name} declined the request</p>
                  <p className="text-white/50 text-sm mt-1">Try again later</p>
                </div>
                <Button onClick={() => setChatRequestStatus('idle')} className="w-full">Close</Button>
              </>
            )}

            {chatRequestStatus === 'expired' && (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Companion unavailable</p>
                  <p className="text-white/50 text-sm mt-1">{companion.name} didn&apos;t respond in time</p>
                </div>
                <Button onClick={() => setChatRequestStatus('idle')} className="w-full">Try Again</Button>
              </>
            )}

            {chatRequestStatus === 'insufficient_balance' && (
              <>
                <div className="w-16 h-16 rounded-full bg-warning/20 border-2 border-warning/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-warning-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Insufficient Balance</p>
                  <p className="text-white/50 text-sm mt-1">
                    {insufficientBalanceDetails
                      ? `You need ₹${Math.ceil((insufficientBalanceDetails.required - insufficientBalanceDetails.current) / 100)} more to start a chat session.`
                      : 'Add money to your wallet to start a chat session.'}
                  </p>
                </div>
                {insufficientBalanceDetails && (
                  <div className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-left space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/50">Current balance</span>
                      <span className="text-white font-medium">₹{(insufficientBalanceDetails.current / 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/50">Required (10 min minimum)</span>
                      <span className="text-white font-medium">₹{(insufficientBalanceDetails.required / 100).toFixed(0)}</span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-1.5 flex justify-between text-xs">
                      <span className="text-warning-fg font-semibold">Shortfall</span>
                      <span className="text-warning-fg font-semibold">
                        ₹{Math.ceil((insufficientBalanceDetails.required - insufficientBalanceDetails.current) / 100)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={() => setChatRequestStatus('idle')} className="flex-1">Cancel</Button>
                  <Button onClick={() => router.push('/client/wallet')} className="flex-1">Add Money</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
