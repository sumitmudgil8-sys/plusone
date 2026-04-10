'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import type { RoomMessage } from '@/hooks/useSocket';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import type { VoiceCallState } from '@/hooks/useVoiceCall';
import { BILLING_TICK_SECONDS } from '@/lib/constants';
import { getChatRoomChannelName } from '@/lib/ably';
import { ActiveCallBanner } from '@/components/ActiveCallBanner';

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionState = 'LOADING' | 'NO_SESSION' | 'PENDING' | 'ACTIVE' | 'ENDED';

interface LocalMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
}

interface CompanionInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface SessionInfo {
  sessionId: string;
  ratePerMinute: number;
  totalCharged: number;
  durationSeconds: number;
  startedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientInboxPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [userId, setUserId] = useState<string | undefined>();
  const [companion, setCompanion] = useState<CompanionInfo | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('LOADING');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionType, setSessionType] = useState<'CHAT' | 'VOICE' | null>(null);
  const [balanceLow, setBalanceLow] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{ totalCharged: number; durationSeconds: number } | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [voiceStartError, setVoiceStartError] = useState<string | null>(null);

  // Read ?mode=voice from URL on mount (no Suspense needed — window is always available in client components)
  const voiceModeRef = useRef(false);
  useEffect(() => {
    voiceModeRef.current = new URLSearchParams(window.location.search).get('mode') === 'voice';
  }, []);

  const sessionStartedAtMsRef = useRef<number | null>(null);
  const liveSecondsRef = useRef(0);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickAtMsRef = useRef<number | null>(null);
  const sessionStateRef = useRef<SessionState>('LOADING');
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);
  useEffect(() => { sessionIdRef.current = session?.sessionId ?? null; }, [session?.sessionId]);

  // Room ID is computed early — useSocket subscribes to the channel immediately,
  // before the session is even active. This means the subscription is ready and
  // waiting when the companion sends the first message.
  const roomId = userId ? getChatRoomChannelName(userId, companionId) : undefined;

  const {
    onChatRequestResponse,
    onChatEnded,
    onBalanceLow,
    publishToRoom,
    publishRoomTyping,
    roomMessages,   // direct state from hook
    isOtherTyping,  // direct state from hook
  } = useSocket(userId, 'CLIENT', roomId);

  // Fetch current user
  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => { if (d.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  // Fetch companion info
  useEffect(() => {
    fetch(`/api/companions/${companionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.companion) setCompanion({
          id: companionId,
          name: d.companion.name ?? 'Companion',
          avatarUrl: d.companion.avatarUrl ?? null,
        });
      })
      .catch(() => {});
  }, [companionId]);

  // Check session status
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/session-status?companionId=${companionId}`);
      const d = await res.json();
      if (!d.success) { setSessionState('NO_SESSION'); return; }
      const { status } = d.data;
      if (status === 'ACTIVE') {
        const durationSeconds: number = d.data.durationSeconds ?? 0;
        const startedAt: string | null = d.data.startedAt ?? null;
        setSession({
          sessionId: d.data.sessionId,
          ratePerMinute: d.data.ratePerMinute,
          totalCharged: d.data.totalCharged,
          durationSeconds,
          startedAt,
        });
        setSessionType(d.data.type ?? 'CHAT');
        if (!sessionStartedAtMsRef.current) {
          sessionStartedAtMsRef.current = startedAt
            ? new Date(startedAt).getTime()
            : Date.now() - durationSeconds * 1000;
        }
        setSessionState('ACTIVE');
      } else if (status === 'PENDING') {
        setSession({ sessionId: d.data.sessionId, ratePerMinute: d.data.ratePerMinute, totalCharged: 0, durationSeconds: 0, startedAt: null });
        setSessionType(d.data.type ?? 'CHAT');
        setSessionState('PENDING');
      } else {
        setSessionState('NO_SESSION');
      }
    } catch { setSessionState('NO_SESSION'); }
  }, [companionId]);

  useEffect(() => {
    if (!userId) return;
    checkSession();
  }, [userId, checkSession]);

  // Poll while PENDING
  useEffect(() => {
    if (sessionState !== 'PENDING') return;
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [sessionState, checkSession]);

  // Auto-start voice call when NO_SESSION and mode=voice.
  // voiceModeRef is cleared immediately to prevent infinite retry loops on failure.
  useEffect(() => {
    if (sessionState !== 'NO_SESSION' || !voiceModeRef.current || !userId) return;
    voiceModeRef.current = false; // prevent re-entry if this attempt fails
    const start = async () => {
      setSessionState('LOADING');
      try {
        const res = await fetch('/api/billing/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companionId, type: 'VOICE' }),
        });
        const d = await res.json();
        if (d.success) {
          setVoiceStartError(null);
          setSession({
            sessionId: d.data.sessionId,
            ratePerMinute: d.data.ratePerMinute,
            totalCharged: 0,
            durationSeconds: 0,
            startedAt: null,
          });
          setSessionType('VOICE');
          setSessionState('PENDING'); // companion must accept before Agora starts
        } else if (d.error === 'INSUFFICIENT_BALANCE') {
          setVoiceStartError('insufficient_balance');
          setSessionState('NO_SESSION');
        } else {
          setVoiceStartError(d.error ?? 'Failed to start call');
          setSessionState('NO_SESSION');
        }
      } catch {
        setVoiceStartError('Connection error. Please try again.');
        setSessionState('NO_SESSION');
      }
    };
    start();
  }, [sessionState, userId, companionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ably: companion accepted or declined
  useEffect(() => {
    if (!userId) return;
    return onChatRequestResponse((data) => {
      if (sessionIdRef.current && data.sessionId !== sessionIdRef.current) return;
      if (data.status === 'DECLINED') {
        setSessionState('NO_SESSION');
        return;
      }
      if (data.status !== 'ACCEPTED') return;
      const sessionId = data.sessionId ?? sessionIdRef.current;
      if (!sessionId) return;
      sessionStartedAtMsRef.current = Date.now();
      setSession(prev => prev
        ? { ...prev, sessionId, startedAt: new Date().toISOString() }
        : { sessionId, ratePerMinute: 0, totalCharged: 0, durationSeconds: 0, startedAt: new Date().toISOString() });
      setSessionState('ACTIVE');
    });
  }, [userId, onChatRequestResponse]);

  // Ably: session ended
  useEffect(() => {
    return onChatEnded((data) => {
      if (session?.sessionId && data.sessionId !== session.sessionId) return;
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      setSessionState('ENDED');
      setSessionSummary({ totalCharged: data.totalCharged, durationSeconds: liveSecondsRef.current });
    });
  }, [onChatEnded, session?.sessionId]);

  useEffect(() => {
    return onBalanceLow(() => setBalanceLow(true));
  }, [onBalanceLow]);

  // Voice call — only pass sessionId once session is ACTIVE (companion has accepted).
  // Passing it while PENDING causes a 409 from /api/agora/token since billing hasn't started yet.
  const voiceSessionId = sessionType === 'VOICE' && sessionState === 'ACTIVE' && session?.sessionId ? session.sessionId : null;
  const voiceCall = useVoiceCall(voiceSessionId, userId ?? '');

  // ── Wall-clock timer ──────────────────────────────────────────────────────
  // For VOICE calls, timer starts when companion joins Agora (matches billing start).
  // For CHAT calls, timer starts immediately when session goes ACTIVE.
  const canStartTimer = sessionState === 'ACTIVE' && session &&
    (sessionType !== 'VOICE' || voiceCall.remoteUserJoined);

  useEffect(() => {
    if (!canStartTimer || !session) return;
    if (!sessionStartedAtMsRef.current) {
      sessionStartedAtMsRef.current = session.startedAt
        ? new Date(session.startedAt).getTime()
        : Date.now() - session.durationSeconds * 1000;
    }
    const tick = () => {
      if (!sessionStartedAtMsRef.current) return;
      const elapsed = Math.floor((Date.now() - sessionStartedAtMsRef.current) / 1000);
      liveSecondsRef.current = elapsed;
      setLiveSeconds(elapsed);
    };
    tick();
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = setInterval(tick, 1000);
    return () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current); };
  }, [canStartTimer, session?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync timer + billing tick on tab visibility change ────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (sessionStateRef.current === 'ACTIVE' && sessionStartedAtMsRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartedAtMsRef.current) / 1000);
        liveSecondsRef.current = elapsed;
        setLiveSeconds(elapsed);
      }
      if (
        sessionStateRef.current === 'ACTIVE' &&
        sessionIdRef.current &&
        lastTickAtMsRef.current &&
        Date.now() - lastTickAtMsRef.current >= BILLING_TICK_SECONDS * 1000
      ) {
        fireBillingTick(sessionIdRef.current);
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = setInterval(() => {
          if (sessionIdRef.current) fireBillingTick(sessionIdRef.current);
        }, BILLING_TICK_SECONDS * 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Billing tick ──────────────────────────────────────────────────────────
  const fireBillingTick = useCallback(async (sid: string) => {
    lastTickAtMsRef.current = Date.now();
    try {
      const res = await fetch('/api/billing/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      const d = await res.json();
      if (d.success && d.data) {
        if (d.data.ended) {
          if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
          if (liveTimerRef.current) clearInterval(liveTimerRef.current);
          setSessionState('ENDED');
          setSessionSummary({ totalCharged: d.data.totalCharged ?? 0, durationSeconds: liveSecondsRef.current });
        } else if (d.data.balanceLow) {
          setBalanceLow(true);
        }
      }
    } catch { /* non-fatal */ }
  }, []);

  // Billing tick — for VOICE calls, delay until companion actually joins Agora RTC
  // so the client isn't billed for the Agora connection setup time.
  // For CHAT sessions, start ticks immediately when session goes ACTIVE.
  const canStartTicks = sessionState === 'ACTIVE' && session?.sessionId &&
    (sessionType !== 'VOICE' || voiceCall.remoteUserJoined);

  useEffect(() => {
    if (!canStartTicks || !session?.sessionId) return;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    const sid = session.sessionId;
    lastTickAtMsRef.current = Date.now();
    tickIntervalRef.current = setInterval(() => fireBillingTick(sid), BILLING_TICK_SECONDS * 1000);
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, [canStartTicks, session?.sessionId, fireBillingTick]);

  const handleEndSession = useCallback(async () => {
    if (!session?.sessionId) return;
    const sid = session.sessionId;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    setSessionState('ENDED');
    setSessionSummary({ totalCharged: session.totalCharged, durationSeconds: liveSecondsRef.current });
    try {
      const res = await fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      const d = await res.json();
      if (d.data?.totalCharged !== undefined) {
        setSessionSummary(prev => prev ? { ...prev, totalCharged: d.data.totalCharged } : prev);
      }
    } catch { /* keep local summary */ }
  }, [session]);

  const handleEndVoiceCall = useCallback(async () => {
    ActiveCallBanner.clear();
    await voiceCall.endCall();
    await handleEndSession();
  }, [voiceCall, handleEndSession]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, []);

  // beforeunload: fire billing end if client closes browser mid-session
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = sessionIdRef.current;
      const st = sessionStateRef.current;
      if (!sid || (st !== 'ACTIVE' && st !== 'PENDING')) return;
      navigator.sendBeacon(
        '/api/billing/end',
        new Blob([JSON.stringify({ sessionId: sid })], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Active call banner — set when VOICE call is active, clear when ended
  useEffect(() => {
    if (sessionType === 'VOICE' && sessionState === 'ACTIVE' && voiceCall.state === 'connected') {
      ActiveCallBanner.set({
        sessionId: session?.sessionId ?? '',
        returnPath: `/client/inbox/${companionId}`,
        peerName: companion?.name ?? 'Companion',
      });
    }
    if (sessionState === 'ENDED' || voiceCall.state === 'ended' || voiceCall.state === 'error') {
      ActiveCallBanner.clear();
    }
    return () => { ActiveCallBanner.clear(); };
  }, [sessionType, sessionState, voiceCall.state, companionId, companion?.name, session?.sessionId]);

  const companionName = companion?.name ?? 'Companion';
  const companionAvatar = companion?.avatarUrl ?? null;

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (sessionState === 'LOADING') {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0C0C14] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // ── ENDED ─────────────────────────────────────────────────────────────────
  if (sessionState === 'ENDED' && sessionSummary) {
    const isVoiceEnded = sessionType === 'VOICE';
    return (
      <div className="fixed inset-0 z-[60] bg-[#0C0C14] flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white mb-1">{isVoiceEnded ? 'Call Ended' : 'Chat Ended'}</h2>
          <p className="text-white/40 text-sm">{formatDuration(sessionSummary.durationSeconds)} with {companionName}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/client/booking/${companionId}`} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-semibold text-sm text-center">
            {isVoiceEnded ? 'Call Again' : 'Chat Again'}
          </Link>
          <Link href="/client/browse" className="w-full py-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/60 font-medium text-sm text-center">
            Browse
          </Link>
        </div>
      </div>
    );
  }

  // ── PENDING / NO_SESSION ──────────────────────────────────────────────────
  if (sessionState === 'PENDING' || sessionState === 'NO_SESSION') {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0C0C14] flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 bg-[#0C0C14] border-b border-white/[0.06]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: '12px' }}>
          <Link href="/client/browse"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/50 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="relative shrink-0">
            {companionAvatar
              ? <img src={companionAvatar} alt={companionName} className="w-10 h-10 rounded-full object-cover" />
              : <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-amber-300">{companionName[0]}</span>
                </div>}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{companionName}</p>
            {sessionState === 'PENDING'
              ? <p className="text-xs text-amber-400">{sessionType === 'VOICE' ? 'Ringing…' : 'Waiting…'}</p>
              : <p className="text-xs text-white/30">No session</p>}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          {sessionState === 'PENDING' ? (
            <>
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  {sessionType === 'VOICE' ? (
                    <svg className="w-9 h-9 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  ) : (
                    <svg className="w-9 h-9 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping" />
              </div>
              <div>
                {sessionType === 'VOICE' ? (
                  <>
                    <p className="text-white font-semibold text-lg">Calling {companionName}…</p>
                    <p className="text-white/40 text-sm mt-1">Waiting for them to answer</p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-semibold text-lg">Waiting for {companionName}…</p>
                    <p className="text-white/40 text-sm mt-1">They&apos;ll be notified right away</p>
                  </>
                )}
              </div>
            </>
          ) : voiceStartError === 'insufficient_balance' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Insufficient Balance</p>
                <p className="text-white/40 text-sm mt-1">Add money to your wallet to make calls</p>
              </div>
              <Link href="/client/wallet"
                className="px-6 py-3 rounded-2xl bg-amber-500 text-black font-semibold text-sm">
                Add Money
              </Link>
            </>
          ) : voiceStartError ? (
            <>
              <p className="text-white/50 text-sm">{voiceStartError}</p>
              <Link href="/client/browse"
                className="px-6 py-3 rounded-2xl bg-white/[0.07] border border-white/[0.1] text-white/60 font-medium text-sm">
                Go Back
              </Link>
            </>
          ) : (
            <>
              <p className="text-white/50 text-sm">No active session with {companionName}</p>
              <Link href={`/client/booking/${companionId}`}
                className="px-6 py-3 rounded-2xl bg-amber-500 text-black font-semibold text-sm">
                Start Chat
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── ACTIVE ────────────────────────────────────────────────────────────────
  if (!userId || !session) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0C0C14] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // VOICE session: show voice call overlay
  if (sessionType === 'VOICE') {
    return (
      <ClientVoiceOverlay
        callState={voiceCall.state}
        isMuted={voiceCall.isMuted}
        remoteUserJoined={voiceCall.remoteUserJoined}
        error={voiceCall.error}
        liveSeconds={liveSeconds}
        companionName={companionName}
        companionAvatar={companionAvatar}
        onToggleMute={voiceCall.toggleMute}
        onEndCall={handleEndVoiceCall}
      />
    );
  }

  return (
    <ClientChatView
      userId={userId}
      companionId={companionId}
      companionName={companionName}
      companionAvatar={companionAvatar}
      liveSeconds={liveSeconds}
      balanceLow={balanceLow}
      onEndSession={handleEndSession}
      publishToRoom={publishToRoom}
      publishRoomTyping={publishRoomTyping}
      roomMessages={roomMessages}
      isOtherTyping={isOtherTyping}
    />
  );
}

// ─── Active chat view ─────────────────────────────────────────────────────────

interface ClientChatViewProps {
  userId: string;
  companionId: string;
  companionName: string;
  companionAvatar: string | null;
  liveSeconds: number;
  balanceLow: boolean;
  onEndSession: () => Promise<void>;
  publishToRoom: (text: string, id?: string) => Promise<string | null>;
  publishRoomTyping: (isTyping: boolean) => void;
  roomMessages: RoomMessage[];   // direct state from parent hook
  isOtherTyping: boolean;        // direct state from parent hook
}

function ClientChatView({
  userId,
  companionId,
  companionName,
  companionAvatar,
  liveSeconds,
  balanceLow,
  onEndSession,
  publishToRoom,
  publishRoomTyping,
  roomMessages,
  isOtherTyping,
}: ClientChatViewProps) {
  // History: messages loaded from DB on mount
  const [history, setHistory] = useState<LocalMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Pending: optimistically added messages waiting for Ably echo
  const [pendingMessages, setPendingMessages] = useState<LocalMessage[]>([]);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load history from DB on mount ─────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/messages/thread?companionUserId=${companionId}&clientUserId=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.messages)) {
          setHistory(d.data.messages.map((m: { id: string; content: string; senderId: string; createdAt: string }) => ({
            id: m.id,
            text: m.content,
            senderId: m.senderId,
            createdAt: new Date(m.createdAt),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Remove pending messages once echoed into roomMessages ─────────────────
  useEffect(() => {
    if (pendingMessages.length === 0) return;
    const arrivedIds = new Set(roomMessages.map(m => m.id));
    setPendingMessages(prev => prev.filter(m => !arrivedIds.has(m.id)));
  }, [roomMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merged + deduplicated message list ────────────────────────────────────
  const allMessages = useMemo<LocalMessage[]>(() => {
    const seen = new Set<string>();
    const result: LocalMessage[] = [];
    const add = (m: LocalMessage) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      result.push(m);
    };
    for (const m of history) add(m);
    for (const m of roomMessages) {
      add({ id: m.id, text: m.text, senderId: m.senderId, createdAt: new Date(m.createdAt) });
    }
    for (const m of pendingMessages) add(m);
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [history, roomMessages, pendingMessages]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, isOtherTyping]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending) return;
    const content = inputText.trim();
    const now = new Date();
    const msgId = `${userId}-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`;

    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);

    // Optimistic: show immediately before echo
    setPendingMessages(prev => [...prev, { id: msgId, text: content, senderId: userId, createdAt: now }]);

    try {
      publishRoomTyping(false);
      await publishToRoom(content, msgId);
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionId, clientUserId: userId, content, ablyMsgId: msgId }),
      }).catch(() => {});
    } catch {
      setPendingMessages(prev => prev.filter(m => m.id !== msgId));
      setInputText(content);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, userId, companionId, publishToRoom, publishRoomTyping]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    publishRoomTyping(e.target.value.trim().length > 0);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0C0C14]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 bg-[#0C0C14] border-b border-white/[0.06]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: '12px' }}>
        <Link href="/client/browse"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="relative shrink-0">
          {companionAvatar
            ? <img src={companionAvatar} alt={companionName} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-amber-300">{companionName[0]}</span>
              </div>}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0C0C14]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{companionName}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
            <span className="text-xs text-white/50 tabular-nums">{formatDuration(liveSeconds)}</span>
          </div>
        </div>
        <button
          onClick={onEndSession}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 active:scale-95 transition-all">
          End
        </button>
      </div>

      {/* ── Low balance banner ──────────────────────────────────────────── */}
      {balanceLow && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="text-xs text-amber-300 font-medium">Less than 2 minutes remaining</span>
          </div>
          <Link href="/client/wallet" className="text-xs text-amber-400 font-semibold underline underline-offset-2">
            Add Money
          </Link>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {!historyLoaded ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
            <span className="text-3xl">👋</span>
            <p className="text-white/30 text-sm">Say hello to {companionName}!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {allMessages.map((msg, i) => {
              const isOwn = msg.senderId === userId;
              const sameAbove = i > 0 && allMessages[i - 1].senderId === msg.senderId;
              const sameBelow = i < allMessages.length - 1 && allMessages[i + 1].senderId === msg.senderId;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${sameAbove ? 'mt-0.5' : 'mt-3'}`}
                >
                  {!isOwn && (
                    <div className="w-7 shrink-0 self-end mb-0.5">
                      {!sameBelow && (
                        companionAvatar
                          ? <img src={companionAvatar} alt={companionName} className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <span className="text-xs font-semibold text-amber-300">{companionName[0]}</span>
                            </div>
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                      isOwn
                        ? `bg-gradient-to-br from-amber-500 to-amber-400 text-black font-medium shadow-lg shadow-amber-500/10 ${sameAbove ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-sm'}`
                        : `bg-white/[0.08] text-white border border-white/[0.06] ${sameAbove ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-sm'}`
                    }`}>
                      {msg.text}
                    </div>
                    {!sameBelow && (
                      <span className="text-[10px] text-white/20 px-1 mt-0.5">
                        {msg.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {isOtherTyping && (
              <div className="flex items-end gap-2 mt-3">
                <div className="w-7 shrink-0 self-end mb-0.5">
                  {companionAvatar
                    ? <img src={companionAvatar} alt={companionName} className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-xs font-semibold text-amber-300">{companionName[0]}</span>
                      </div>}
                </div>
                <div className="bg-white/[0.08] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3.5">
                  <span className="flex gap-1 items-center h-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '160ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '320ms' }} />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-[#0C0C14] border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
      >
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTyping}
            placeholder="Message…"
            disabled={sending}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 resize-none bg-white/[0.05] border border-white/[0.09] focus:border-amber-500/40 rounded-3xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-colors min-h-[46px] max-h-[120px] leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: inputText.trim() ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.05)',
              boxShadow: inputText.trim() ? '0 4px 16px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            <svg
              className={`w-5 h-5 transition-colors ${inputText.trim() ? 'text-black' : 'text-white/20'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Client voice overlay ─────────────────────────────────────────────────────

interface ClientVoiceOverlayProps {
  callState: VoiceCallState;
  isMuted: boolean;
  remoteUserJoined: boolean;
  error: string | null;
  liveSeconds: number;
  companionName: string;
  companionAvatar: string | null;
  onToggleMute: () => Promise<void>;
  onEndCall: () => Promise<void>;
}

function ClientVoiceOverlay({
  callState, isMuted, remoteUserJoined, error,
  liveSeconds, companionName, companionAvatar,
  onToggleMute, onEndCall,
}: ClientVoiceOverlayProps) {
  const statusText =
    callState === 'connecting' ? `Calling ${companionName}…` :
    callState === 'error' ? (error ?? 'Call failed') :
    callState === 'ended' ? 'Call ended' :
    !remoteUserJoined ? `Waiting for ${companionName} to join…` :
    `In call with ${companionName}`;

  const showTimer = callState === 'connected' && remoteUserJoined;
  const showConnecting = callState === 'connecting' || (callState === 'connected' && !remoteUserJoined);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-[#0A0A12] px-8"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>

      {/* Top: avatar + name + status */}
      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="relative">
          {companionAvatar
            ? <img src={companionAvatar} alt={companionName} className="w-28 h-28 rounded-full object-cover ring-4 ring-amber-500/20" />
            : <div className="w-28 h-28 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
                <span className="text-4xl font-semibold text-amber-300">{companionName[0]}</span>
              </div>}
          {showTimer && (
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-[#0A0A12]" />
          )}
        </div>
        <p className="text-2xl font-semibold text-white mt-3">{companionName}</p>
        <p className="text-sm text-white/50 text-center max-w-[240px]">{statusText}</p>
        {showTimer && (
          <p className="text-3xl font-mono text-white/70 mt-2">{formatDuration(liveSeconds)}</p>
        )}
        {showConnecting && (
          <div className="flex gap-1.5 mt-3">
            {[0, 200, 400].map(delay => (
              <span key={delay} className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom: controls */}
      <div className="flex items-center justify-center gap-10">
        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          disabled={callState !== 'connected'}
          className="flex flex-col items-center gap-2 disabled:opacity-40"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white/25' : 'bg-white/10'}`}>
            {isMuted ? (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          <span className="text-xs text-white/50">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* End call */}
        <button onClick={onEndCall} className="flex flex-col items-center gap-2">
          <div className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-400 transition-colors active:scale-95">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
            </svg>
          </div>
          <span className="text-xs text-white/50">End Call</span>
        </button>
      </div>
    </div>
  );
}
