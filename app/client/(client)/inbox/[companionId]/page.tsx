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

function fmt(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
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

  const [timeLeft, setTimeLeft] = useState(180);
  const [balanceLow, setBalanceLow] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{ totalCharged: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to current sessionState for use inside effects without stale closure
  const sessionStateRef = useRef<SessionState>('LOADING');
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);

  const { onChatRequestResponse, onChatEnded, onBalanceLow, sendTyping, onMessage, onTyping, isConnected } =
    useSocket(userId, 'CLIENT');

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
        if (d.companion) {
          setCompanion({
            id: companionId,
            name: d.companion.name ?? 'Companion',
            avatarUrl: d.companion.avatarUrl ?? null,
          });
        }
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
        setSession({
          sessionId: d.data.sessionId,
          ratePerMinute: d.data.ratePerMinute,
          totalCharged: d.data.totalCharged,
          durationSeconds: d.data.durationSeconds,
          expiresAt: null,
        });
        setSessionState('ACTIVE');
      } else if (status === 'PENDING') {
        setSession({
          sessionId: d.data.sessionId,
          ratePerMinute: d.data.ratePerMinute,
          totalCharged: 0,
          durationSeconds: 0,
          expiresAt: d.data.expiresAt,
        });
        setSessionState('PENDING');
      } else {
        setSessionState('NO_SESSION');
      }
    } catch {
      setSessionState('NO_SESSION');
    }
  }, [companionId]);

  useEffect(() => {
    if (!userId) return;
    checkSession();
  }, [userId, checkSession]);

  // Re-check when Ably connects — catches the race where companion accepts
  // before the client's Ably connection is fully established.
  useEffect(() => {
    if (!isConnected) return;
    if (sessionStateRef.current === 'PENDING') checkSession();
  }, [isConnected, checkSession]);

  // Fetch thread messages when ACTIVE
  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `/api/messages/thread?companionUserId=${companionId}&clientUserId=${userId}`
      );
      const d = await res.json();
      if (d.success && d.data) {
        setMessages(d.data.messages);
        setThreadId(d.data.threadId);
      }
    } catch { /* non-fatal */ }
  }, [userId, companionId]);

  useEffect(() => {
    if (sessionState === 'ACTIVE') fetchMessages();
  }, [sessionState, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pending countdown
  useEffect(() => {
    if (sessionState !== 'PENDING' || !session?.expiresAt) return;
    const initial = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
    setTimeLeft(initial);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setSessionState('NO_SESSION');
          setSession(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, session?.expiresAt]);

  // Billing tick
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
            setSessionState('ENDED');
            setSessionSummary({ totalCharged: d.data.totalCharged ?? 0 });
          } else {
            setSession((prev) =>
              prev ? {
                ...prev,
                totalCharged: d.data.totalCharged,
                durationSeconds: d.data.durationSeconds ?? prev.durationSeconds + BILLING_TICK_SECONDS,
              } : prev
            );
            if (d.data.balanceLow) setBalanceLow(true);
          }
        }
      } catch { /* non-fatal */ }
    }, BILLING_TICK_SECONDS * 1000);
  }, []);

  // Subscribe to chat:accepted
  useEffect(() => {
    return onChatRequestResponse((data) => {
      if (data.status !== 'ACCEPTED') return;
      if (session?.sessionId && data.sessionId !== session.sessionId) return;
      const sessionId = data.sessionId ?? session?.sessionId;
      if (!sessionId) return;
      setSession((prev) => prev ? { ...prev, sessionId } : {
        sessionId,
        ratePerMinute: 0,
        totalCharged: 0,
        durationSeconds: 0,
        expiresAt: null,
      });
      setSessionState('ACTIVE');
      startTick(sessionId);
    });
  }, [onChatRequestResponse, session?.sessionId, startTick]);

  // Subscribe to chat:ended
  useEffect(() => {
    return onChatEnded((data) => {
      if (session?.sessionId && data.sessionId !== session.sessionId) return;
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      setSessionState('ENDED');
      setSessionSummary({ totalCharged: data.totalCharged });
    });
  }, [onChatEnded, session?.sessionId]);

  // Subscribe to chat:balance_low
  useEffect(() => {
    return onBalanceLow((data) => {
      if (session?.sessionId && data.sessionId !== session.sessionId) return;
      setBalanceLow(true);
    });
  }, [onBalanceLow, session?.sessionId]);

  // Subscribe to incoming messages
  useEffect(() => {
    return onMessage((data) => {
      setMessages((prev) => [...prev, {
        id: data.id,
        content: data.content,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar ?? null,
        createdAt: data.createdAt,
      }]);
      setIsTyping(false);
    });
  }, [onMessage]);

  // Subscribe to typing
  useEffect(() => {
    return onTyping(() => {
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });
  }, [onTyping]);

  // Start tick when state becomes ACTIVE
  useEffect(() => {
    if (sessionState === 'ACTIVE' && session?.sessionId) {
      startTick(session.sessionId);
    }
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [sessionState, session?.sessionId, startTick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !userId || sessionState !== 'ACTIVE') return;
    const content = inputText.trim();
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);

    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: optimisticId,
      content,
      senderId: userId,
      senderName: 'You',
      senderAvatar: null,
      createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionId, clientUserId: userId, content }),
      });
      const d = await res.json();
      if (d.success && d.data) {
        setMessages((prev) =>
          prev.map((m) => m.id === optimisticId ? { ...m, id: d.data.id } : m)
        );
        if (!threadId && d.data.threadId) setThreadId(d.data.threadId);
      }
    } catch { /* non-fatal — keep optimistic */ } finally {
      setSending(false);
    }
  }, [inputText, userId, sessionState, companionId, threadId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    if (isConnected && userId) {
      sendTyping({ threadId: threadId ?? companionId, userId, receiverId: companionId });
    }
  };

  const handleEndSession = useCallback(async () => {
    if (!session?.sessionId) return;
    const sid = session.sessionId;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    setSessionState('ENDED');
    try {
      const res = await fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      const d = await res.json();
      setSessionSummary({ totalCharged: d.data?.totalCharged ?? session.totalCharged });
    } catch {
      setSessionSummary({ totalCharged: session.totalCharged });
    }
  }, [session]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (sessionState === 'LOADING') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const companionName = companion?.name ?? 'Companion';
  const companionAvatar = companion?.avatarUrl ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0F]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111118] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/client/inbox" className="text-white/50 hover:text-white shrink-0 -ml-1 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {companionAvatar ? (
            <img src={companionAvatar} alt={companionName}
              className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{companionName[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{companionName}</p>
            {sessionState === 'ACTIVE' && session && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">
                  {fmt(session.ratePerMinute)}/min · {formatDuration(session.durationSeconds)}
                </span>
              </div>
            )}
            {sessionState === 'PENDING' && (
              <p className="text-xs text-amber-400">Waiting for response…</p>
            )}
            {sessionState === 'ENDED' && sessionSummary && (
              <p className="text-xs text-white/50">
                Session ended · {fmt(sessionSummary.totalCharged)} charged
              </p>
            )}
          </div>
        </div>
        {sessionState === 'ACTIVE' && (
          <button
            onClick={handleEndSession}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            End Chat
          </button>
        )}
      </div>

      {/* ── PENDING ─────────────────────────────────────────────────────── */}
      {sessionState === 'PENDING' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Waiting for {companionName}…</p>
            <p className="text-white/50 text-sm mt-1">
              Expires in {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
          </div>
          <div className="w-full max-w-xs bg-white/10 rounded-full h-1">
            <div
              className="bg-amber-400 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (timeLeft / 180) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── NO_SESSION ──────────────────────────────────────────────────── */}
      {sessionState === 'NO_SESSION' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-white/60">No active session with {companionName}</p>
          <Link
            href={`/client/booking/${companionId}`}
            className="px-6 py-2.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
          >
            Start Chat
          </Link>
        </div>
      )}

      {/* ── ACTIVE / ENDED — messages + input ──────────────────────────── */}
      {(sessionState === 'ACTIVE' || sessionState === 'ENDED') && (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2 min-h-full justify-end">
              {messages.length === 0 && sessionState === 'ACTIVE' && (
                <p className="text-center text-white/40 text-sm py-8">
                  Session started — say hello!
                </p>
              )}
              {messages.map((msg) => {
                const isOwn = msg.senderId === userId;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm break-words ${
                      isOwn
                        ? 'rounded-tr-sm bg-amber-500/20 border border-amber-500/30 text-white'
                        : 'rounded-tl-sm bg-white/[0.08] border border-white/10 text-white'
                    }`}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1 text-white/30 ${isOwn ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.08] border border-white/10">
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-white/10 bg-[#111118] px-4 py-3 shrink-0">
            {/* Session active banner */}
            {sessionState === 'ACTIVE' && session && !balanceLow && (
              <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">
                    Live · {fmt(session.ratePerMinute)}/min · {fmt(session.totalCharged)} charged
                  </span>
                </div>
                <button onClick={handleEndSession} className="text-xs text-red-400 hover:text-red-300">
                  End Chat
                </button>
              </div>
            )}
            {/* Low balance banner */}
            {balanceLow && sessionState === 'ACTIVE' && (
              <div className="flex items-center justify-between px-3 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <span className="text-xs text-amber-400">⚠ Low balance</span>
                <Link href="/client/wallet" className="text-xs text-amber-400 underline">
                  Add Money
                </Link>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleTyping}
                placeholder={sessionState === 'ENDED' ? 'Session ended' : 'Type a message…'}
                disabled={sessionState === 'ENDED' || sending}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-500/50 min-h-[44px] max-h-[120px] disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sessionState === 'ENDED' || sending}
                className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-center shrink-0 disabled:bg-white/10 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
