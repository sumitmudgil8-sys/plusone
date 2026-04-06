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
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Fetch session status on mount
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

  // Billing tick when ACTIVE
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
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
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
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          content: data.content,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar ?? null,
          createdAt: data.createdAt,
        },
      ]);
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

  // Start tick when state changes to ACTIVE
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userId || sessionState !== 'ACTIVE') return;
    const content = inputText.trim();
    setInputText('');
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
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (isConnected && userId) {
      sendTyping({ threadId: threadId ?? companionId, userId, receiverId: companionId });
    }
  };

  const handleEndSession = async () => {
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
  };

  if (sessionState === 'LOADING') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const companionName = companion?.name ?? 'Companion';
  const companionAvatar = companion?.avatarUrl ?? null;

  return (
    <div className="h-[calc(100vh-160px)] min-h-[500px] flex flex-col bg-charcoal-surface rounded-2xl border border-charcoal-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/client/inbox" className="text-white/50 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {companionAvatar ? (
            <img src={companionAvatar} alt={companionName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{companionName[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{companionName}</p>
            {sessionState === 'ACTIVE' && session && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">
                  {fmt(session.ratePerMinute)}/min · {formatDuration(session.durationSeconds)}
                </span>
              </div>
            )}
            {sessionState === 'PENDING' && (
              <p className="text-xs text-yellow-400">Waiting for response…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sessionState === 'ACTIVE' && (
            <button
              onClick={handleEndSession}
              className="text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* Balance low warning */}
      {balanceLow && sessionState === 'ACTIVE' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/10 border-b border-yellow-400/20 shrink-0">
          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-yellow-400">
            Low balance — <Link href="/client/wallet" className="underline">recharge now</Link> to keep chatting
          </p>
        </div>
      )}

      {/* Session ended summary */}
      {sessionState === 'ENDED' && sessionSummary && (
        <div className="flex items-center justify-between px-4 py-3 bg-charcoal-surface border-b border-charcoal-border shrink-0">
          <div>
            <p className="text-sm font-medium text-white">Session ended</p>
            <p className="text-xs text-white/50">Total charged: {fmt(sessionSummary.totalCharged)}</p>
          </div>
          <Link href={`/client/booking/${companionId}`}
            className="text-xs px-3 py-1.5 rounded-lg bg-gold text-black font-semibold hover:bg-gold/80 transition-colors">
            New Session
          </Link>
        </div>
      )}

      {/* PENDING state */}
      {sessionState === 'PENDING' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="w-full max-w-xs bg-charcoal-border rounded-full h-1">
            <div
              className="bg-gold h-1 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (timeLeft / 180) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* NO_SESSION state */}
      {sessionState === 'NO_SESSION' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-white/60">No active session with {companionName}</p>
          <Link
            href={`/client/booking/${companionId}`}
            className="px-6 py-2.5 rounded-xl bg-gold text-black font-semibold hover:bg-gold/80 transition-colors"
          >
            Start Chat
          </Link>
        </div>
      )}

      {/* ACTIVE / ENDED — messages */}
      {(sessionState === 'ACTIVE' || sessionState === 'ENDED') && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">
                Session started. Say hello!
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === userId;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isOwn && (
                      companionAvatar ? (
                        <img src={companionAvatar} alt={companionName} className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-charcoal-border flex items-center justify-center shrink-0 mt-1">
                          <span className="text-xs text-white">{companionName[0]}</span>
                        </div>
                      )
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-gold text-black rounded-br-sm' : 'bg-charcoal-border text-white rounded-bl-sm'}`}>
                      <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-0.5 ${isOwn ? 'text-black/50 text-right' : 'text-white/40'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            {isTyping && (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <span>{companionName} is typing</span>
                <span className="flex gap-0.5">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-charcoal-border shrink-0 flex gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={handleTyping}
              placeholder={sessionState === 'ENDED' ? 'Session ended' : 'Type a message…'}
              disabled={sessionState === 'ENDED' || sending}
              className="flex-1 bg-charcoal border border-charcoal-border text-white rounded-xl px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-40 text-sm"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sessionState === 'ENDED' || sending}
              className="px-4 py-2.5 rounded-xl bg-gold text-black font-semibold text-sm disabled:opacity-40 hover:bg-gold/80 transition-colors shrink-0"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
