'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { BILLING_TICK_SECONDS } from '@/lib/constants';

type SessionState = 'LOADING' | 'NO_SESSION' | 'PENDING' | 'ACTIVE' | 'ENDED';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
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
  expiresAt: string | null;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ClientInboxPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [userId, setUserId] = useState<string | undefined>();
  const [companion, setCompanion] = useState<CompanionInfo | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('LOADING');
  const [session, setSession] = useState<SessionInfo | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [balanceLow, setBalanceLow] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{ totalCharged: number; durationSeconds: number } | null>(null);

  // Live elapsed timer
  const [liveSeconds, setLiveSeconds] = useState(0);
  const liveSecondsRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStateRef = useRef<SessionState>('LOADING');
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => { sessionIdRef.current = session?.sessionId ?? null; }, [session?.sessionId]);

  const { onChatRequestResponse, onChatEnded, onBalanceLow, sendTyping, onMessage, onTyping, isConnected } =
    useSocket(userId, 'CLIENT');

  const startLiveTimer = useCallback((initialSeconds: number) => {
    liveSecondsRef.current = initialSeconds;
    setLiveSeconds(initialSeconds);
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = setInterval(() => {
      liveSecondsRef.current += 1;
      setLiveSeconds(liveSecondsRef.current);
    }, 1000);
  }, []);

  // Fetch current user
  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  // Fetch companion info
  useEffect(() => {
    fetch(`/api/companions/${companionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.companion) setCompanion({ id: companionId, name: d.companion.name ?? 'Companion', avatarUrl: d.companion.avatarUrl ?? null });
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
        setSession({ sessionId: d.data.sessionId, ratePerMinute: d.data.ratePerMinute, totalCharged: d.data.totalCharged, durationSeconds: d.data.durationSeconds, expiresAt: null });
        setSessionState('ACTIVE');
      } else if (status === 'PENDING') {
        setSession({ sessionId: d.data.sessionId, ratePerMinute: d.data.ratePerMinute, totalCharged: 0, durationSeconds: 0, expiresAt: d.data.expiresAt });
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

  useEffect(() => {
    if (!isConnected) return;
    if (sessionStateRef.current === 'PENDING') checkSession();
  }, [isConnected, checkSession]);

  // Periodic polling while PENDING — catches the case where Ably chat:accepted
  // is missed (subscription not yet ready when companion accepts)
  useEffect(() => {
    if (sessionState !== 'PENDING') return;
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [sessionState, checkSession]);

  // Fetch messages (used for initial load + polling)
  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/thread?companionUserId=${companionId}&clientUserId=${userId}`);
      const d = await res.json();
      if (d.success && d.data?.messages) {
        const serverMsgs: Message[] = d.data.messages;
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        setMessages((prev) => {
          // Keep unconfirmed optimistic messages; replace everything else with server data
          const stillOptimistic = prev.filter((m) => m.id.startsWith('opt-') && !serverIds.has(m.id));
          return [...serverMsgs, ...stillOptimistic];
        });
        if (!threadId && d.data.threadId) setThreadId(d.data.threadId);
      }
    } catch { /* non-fatal */ }
  }, [userId, companionId, threadId]);

  // Initial message load
  useEffect(() => {
    if (sessionState === 'ACTIVE') fetchMessages();
  }, [sessionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // 0.5s polling for real-time messages while active
  useEffect(() => {
    if (sessionState !== 'ACTIVE' || !userId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(fetchMessages, 500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [sessionState, userId, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start live timer when ACTIVE
  useEffect(() => {
    if (sessionState === 'ACTIVE' && session) {
      startLiveTimer(session.durationSeconds);
    }
    if (sessionState !== 'ACTIVE') {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    }
  }, [sessionState, session?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pending countdown
  useEffect(() => {
    if (sessionState !== 'PENDING' || !session?.expiresAt) return;
    const initial = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
    let t = initial;
    const interval = setInterval(() => {
      t -= 1;
      if (t <= 0) { clearInterval(interval); setSessionState('NO_SESSION'); setSession(null); }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionState, session?.expiresAt]);

  // Billing tick (every 60s)
  const startTick = useCallback((sessionId: string) => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/billing/tick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const d = await res.json();
        if (d.success && d.data) {
          if (d.data.ended) {
            if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
            if (liveTimerRef.current) clearInterval(liveTimerRef.current);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setSessionState('ENDED');
            setSessionSummary({ totalCharged: d.data.totalCharged ?? 0, durationSeconds: liveSecondsRef.current });
          } else {
            setSession((prev) => prev ? { ...prev, totalCharged: d.data.totalCharged, durationSeconds: d.data.durationSeconds ?? prev.durationSeconds + BILLING_TICK_SECONDS } : prev);
            liveSecondsRef.current = d.data.durationSeconds ?? liveSecondsRef.current;
            if (d.data.balanceLow) setBalanceLow(true);
          }
        }
      } catch { /* non-fatal */ }
    }, BILLING_TICK_SECONDS * 1000);
  }, []);

  // Subscribe to chat:accepted
  useEffect(() => {
    if (!userId) return;
    return onChatRequestResponse((data) => {
      if (data.status !== 'ACCEPTED') return;
      if (sessionIdRef.current && data.sessionId !== sessionIdRef.current) return;
      const sessionId = data.sessionId ?? sessionIdRef.current;
      if (!sessionId) return;
      setSession((prev) => prev ? { ...prev, sessionId } : { sessionId, ratePerMinute: 0, totalCharged: 0, durationSeconds: 0, expiresAt: null });
      setSessionState('ACTIVE');
      startTick(sessionId);
    });
  }, [userId, onChatRequestResponse, startTick]);

  // Subscribe to chat:ended
  useEffect(() => {
    return onChatEnded((data) => {
      if (session?.sessionId && data.sessionId !== session.sessionId) return;
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setSessionState('ENDED');
      setSessionSummary({ totalCharged: data.totalCharged, durationSeconds: liveSecondsRef.current });
    });
  }, [onChatEnded, session?.sessionId]);

  useEffect(() => {
    return onBalanceLow(() => setBalanceLow(true));
  }, [onBalanceLow]);

  // Ably real-time messages (instant delivery)
  useEffect(() => {
    return onMessage((data) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, { id: data.id, content: data.content, senderId: data.senderId, senderName: data.senderName, senderAvatar: data.senderAvatar ?? null, createdAt: data.createdAt }];
      });
      setIsTyping(false);
    });
  }, [onMessage]);

  useEffect(() => {
    return onTyping(() => {
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });
  }, [onTyping]);

  // Start tick when ACTIVE
  useEffect(() => {
    if (sessionState === 'ACTIVE' && session?.sessionId) startTick(session.sessionId);
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, [sessionState, session?.sessionId, startTick]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !userId || sessionState !== 'ACTIVE') return;
    const content = inputText.trim();
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);

    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, content, senderId: userId, senderName: 'You', senderAvatar: null, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionId, clientUserId: userId, content }),
      });
      const d = await res.json();
      if (d.success && d.data) {
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, id: d.data.id } : m));
        if (!threadId && d.data.threadId) setThreadId(d.data.threadId);
      }
    } catch { /* keep optimistic */ } finally { setSending(false); }
  }, [inputText, userId, sessionState, companionId, threadId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    if (isConnected && userId) sendTyping({ threadId: threadId ?? companionId, userId, receiverId: companionId });
  };

  const handleEndSession = useCallback(async () => {
    if (!session?.sessionId) return;
    const sid = session.sessionId;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setSessionState('ENDED');
    setSessionSummary({ totalCharged: session.totalCharged, durationSeconds: liveSecondsRef.current });
    try {
      const res = await fetch('/api/billing/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) });
      const d = await res.json();
      setSessionSummary({ totalCharged: d.data?.totalCharged ?? session.totalCharged, durationSeconds: liveSecondsRef.current });
    } catch { /* keep local */ }
  }, [session]);

  const companionName = companion?.name ?? 'Companion';
  const companionAvatar = companion?.avatarUrl ?? null;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (sessionState === 'LOADING') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0C14] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // ── ENDED ─────────────────────────────────────────────────────────────────
  if (sessionState === 'ENDED' && sessionSummary) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0C14] flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-1">Chat Ended</h2>
        <p className="text-white/40 text-sm mb-8">{formatDuration(sessionSummary.durationSeconds)} with {companionName}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/client/booking/${companionId}`} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-semibold text-sm text-center">
            Chat Again
          </Link>
          <Link href="/client/browse" className="w-full py-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/60 font-medium text-sm text-center">
            Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0C0C14]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 bg-[#0C0C14] border-b border-white/[0.06]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: '12px' }}
      >
        <Link href="/client/browse" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="relative shrink-0">
          {companionAvatar ? (
            <img src={companionAvatar} alt={companionName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-amber-300">{companionName[0]}</span>
            </div>
          )}
          {sessionState === 'ACTIVE' && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0C0C14]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{companionName}</p>
          {sessionState === 'ACTIVE' && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
              <span className="text-xs text-white/50 tabular-nums">{formatDuration(liveSeconds)}</span>
            </div>
          )}
          {sessionState === 'PENDING' && <p className="text-xs text-amber-400 leading-tight">Waiting…</p>}
          {sessionState === 'NO_SESSION' && <p className="text-xs text-white/30 leading-tight">No session</p>}
        </div>

        {sessionState === 'ACTIVE' && (
          <button onClick={handleEndSession} className="shrink-0 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 active:scale-95 transition-all">
            End
          </button>
        )}
      </div>

      {/* ── Low balance toast ───────────────────────────────────────────── */}
      {balanceLow && sessionState === 'ACTIVE' && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="text-xs text-amber-300 font-medium">Less than 2 minutes remaining</span>
          </div>
          <Link href="/client/wallet" className="text-xs text-amber-400 font-semibold underline underline-offset-2">
            Add Money
          </Link>
        </div>
      )}

      {/* ── PENDING ─────────────────────────────────────────────────────── */}
      {sessionState === 'PENDING' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-9 h-9 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Waiting for {companionName}…</p>
            <p className="text-white/40 text-sm mt-1">They'll be notified right away</p>
          </div>
        </div>
      )}

      {/* ── NO_SESSION ───────────────────────────────────────────────────── */}
      {sessionState === 'NO_SESSION' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <p className="text-white/50 text-sm">No active session with {companionName}</p>
          <Link href={`/client/booking/${companionId}`} className="px-6 py-3 rounded-2xl bg-amber-500 text-black font-semibold text-sm">
            Start Chat
          </Link>
        </div>
      )}

      {/* ── ACTIVE — messages + input ────────────────────────────────────── */}
      {sessionState === 'ACTIVE' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="flex flex-col gap-1.5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <span className="text-2xl">👋</span>
                  <p className="text-white/30 text-sm">Say hello to {companionName}!</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isOwn = msg.senderId === userId;
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const isSameGroupAbove = prevMsg?.senderId === msg.senderId;
                const isSameGroupBelow = nextMsg?.senderId === msg.senderId;

                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isSameGroupAbove ? 'mt-0.5' : 'mt-3'}`}>
                    {!isOwn && (
                      <div className="w-7 shrink-0 self-end mb-0.5">
                        {!isSameGroupBelow && (
                          companionAvatar
                            ? <img src={companionAvatar} alt={companionName} className="w-7 h-7 rounded-full object-cover" />
                            : <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center"><span className="text-xs font-semibold text-amber-300">{companionName[0]}</span></div>
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                        isOwn
                          ? `bg-gradient-to-br from-amber-500 to-amber-400 text-black font-medium shadow-lg shadow-amber-500/10 ${isSameGroupAbove ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-sm'}`
                          : `bg-white/[0.08] text-white border border-white/[0.06] ${isSameGroupAbove ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-sm'}`
                      }`}>
                        {msg.content}
                      </div>
                      {!isSameGroupBelow && (
                        <span className="text-[10px] text-white/20 px-1 mt-0.5">
                          {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-end gap-2 mt-3">
                  <div className="w-7 shrink-0 self-end mb-0.5">
                    {companionAvatar
                      ? <img src={companionAvatar} alt={companionName} className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center"><span className="text-xs font-semibold text-amber-300">{companionName[0]}</span></div>
                    }
                  </div>
                  <div className="bg-white/[0.08] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3.5">
                    <span className="flex gap-1 items-center h-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:160ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:320ms]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
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
                <svg className={`w-5 h-5 transition-colors ${inputText.trim() ? 'text-black' : 'text-white/20'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
