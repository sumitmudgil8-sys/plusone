'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { useSocket } from '@/hooks/useSocket';
import { BILLING_TICK_SECONDS } from '@/lib/constants';

interface CurrentUser {
  id: string;
  email: string;
}

interface ClientProfile {
  name: string | null;
  avatarUrl: string | null;
}

interface ClientUser {
  id: string;
  clientProfile: ClientProfile | null;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
}

interface SessionSummary {
  sessionId: string;
  totalCharged: number;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.129a1 1 0 00.502-1.21L7.228 3.683A1 1 0 006.279 3H5z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

export default function CompanionChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  const voiceSessionIdParam = searchParams.get('voiceSessionId');

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [client, setClient] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(voiceSessionIdParam);
  const [callDuration, setCallDuration] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  // Chat billing session state
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatRatePerMinute, setChatRatePerMinute] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const call = useVoiceCall(voiceSessionId, user?.id ?? '');

  const {
    onChatRequestResponse, onChatEnded,
    onMessage, sendTyping, onTyping,
  } = useSocket(user?.id || undefined, 'COMPANION');

  // Load user, client, blocked status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        const clientRes = await fetch(`/api/users/${clientId}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          setClient(clientData.user);
        }

        const blockedRes = await fetch('/api/companion/blocked');
        if (blockedRes.ok) {
          const blockedData = await blockedRes.json();
          const alreadyBlocked = (blockedData.data?.blocked ?? []).some(
            (b: { clientId: string }) => b.clientId === clientId
          );
          setIsBlocked(alreadyBlocked);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  // Check for active billing session on mount
  useEffect(() => {
    if (!user) return;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/companion/active-session');
        if (!res.ok) return;
        const d = await res.json();
        if (d.data?.active && d.data.clientId === clientId) {
          setChatSessionActive(true);
          setChatSessionId(d.data.sessionId);
          setChatRatePerMinute(d.data.ratePerMinute ?? 0);
        }
      } catch { /* non-fatal */ }
    };
    checkSession();
  }, [user, clientId]);

  // Fetch messages when user + client loaded
  useEffect(() => {
    if (!user || !client) return;
    const fetchMsgs = async () => {
      try {
        const res = await fetch(
          `/api/messages/thread?companionUserId=${user.id}&clientUserId=${clientId}`
        );
        const d = await res.json();
        if (d.success && d.data) {
          setMessages(d.data.messages);
          setThreadId(d.data.threadId);
        }
      } catch { /* non-fatal */ }
    };
    fetchMsgs();
  }, [user, client, clientId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to chat:accepted — companion's own accept confirmation
  useEffect(() => {
    return onChatRequestResponse((data) => {
      if (data.status === 'ACCEPTED' && data.sessionId && data.clientId === clientId) {
        setChatSessionActive(true);
        setChatSessionId(data.sessionId);
      }
    });
  }, [onChatRequestResponse, clientId]);

  // Subscribe to chat:ended
  useEffect(() => {
    return onChatEnded((data) => {
      if (!chatSessionId || data.sessionId !== chatSessionId) return;
      setChatSessionActive(false);
      setChatSessionId(null);
      const summary: SessionSummary = { sessionId: data.sessionId, totalCharged: data.totalCharged };
      setSessionSummary(summary);
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
      summaryTimerRef.current = setTimeout(() => setSessionSummary(null), 60000);
    });
  }, [onChatEnded, chatSessionId]);

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

  // End session handler (companion side)
  const handleEndChatSession = useCallback(async () => {
    if (!chatSessionId) return;
    const sid = chatSessionId;
    setChatSessionActive(false);
    setChatSessionId(null);
    try {
      await fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
    } catch { /* non-fatal */ }
  }, [chatSessionId]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !user || sending) return;
    const content = inputText.trim();
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);

    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: optimisticId,
      content,
      senderId: user.id,
      senderName: 'You',
      senderAvatar: null,
      createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: user.id, clientUserId: clientId, content }),
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
  }, [inputText, user, sending, clientId, threadId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    if (user && (threadId ?? clientId)) {
      sendTyping({ threadId: threadId ?? clientId, userId: user.id, receiverId: clientId });
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Voice call billing tick + duration counter
  useEffect(() => {
    if (call.state === 'connected' && voiceSessionId) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      tickIntervalRef.current = setInterval(async () => {
        try {
          await fetch('/api/billing/tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: voiceSessionId }),
          });
        } catch { /* non-fatal */ }
      }, BILLING_TICK_SECONDS * 1000);

      return () => {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        tickIntervalRef.current = null;
        durationIntervalRef.current = null;
      };
    }
  }, [call.state, voiceSessionId]);

  // End billing session if voice call ends unexpectedly
  useEffect(() => {
    if (call.state === 'ended' && voiceSessionId) {
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: voiceSessionId }),
      }).catch(() => {});
      setVoiceSessionId(null);
      setCallDuration(0);
    }
  }, [call.state, voiceSessionId]);

  const handleEndCall = useCallback(async () => {
    if (!voiceSessionId) return;
    await Promise.allSettled([
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: voiceSessionId }),
      }),
      call.endCall(),
    ]);
    setVoiceSessionId(null);
    setCallDuration(0);
  }, [voiceSessionId, call]);

  const handleToggleBlock = async () => {
    setBlocking(true);
    try {
      if (isBlocked) {
        const res = await fetch('/api/companion/blocked');
        if (res.ok) {
          const d = await res.json();
          const record = (d.data?.blocked ?? []).find(
            (b: { clientId: string; id: string }) => b.clientId === clientId
          );
          if (record) {
            await fetch(`/api/companion/block/${record.id}`, { method: 'DELETE' });
            setIsBlocked(false);
          }
        }
      } else {
        const res = await fetch('/api/companion/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        });
        if (res.ok) setIsBlocked(true);
      }
    } catch { /* non-fatal */ } finally {
      setBlocking(false);
    }
  };

  const formatCallDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !client) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col items-center justify-center gap-4">
        <p className="text-white/60">Unable to load chat</p>
        <Button onClick={() => router.push('/companion/inbox')}>Back to Inbox</Button>
      </div>
    );
  }

  const callerName = client.clientProfile?.name ?? 'Client';
  const callerAvatar = client.clientProfile?.avatarUrl ?? null;
  const isInCall = call.state !== 'idle' && call.state !== 'ended';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0F]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111118] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/companion/inbox')}
            className="text-white/60 hover:text-white transition-colors shrink-0 -ml-1 p-1"
            aria-label="Back to inbox"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {callerAvatar ? (
            <img src={callerAvatar} alt={callerName}
              className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{callerName[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{callerName}</p>
            {chatSessionActive && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">
                  Session Active · {fmt(chatRatePerMinute)}/min
                </span>
              </div>
            )}
            {!chatSessionActive && sessionSummary && (
              <p className="text-xs text-white/50">
                Session ended · {fmt(sessionSummary.totalCharged)} earned
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {chatSessionActive && (
            <button
              onClick={handleEndChatSession}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              End Session
            </button>
          )}
          <button
            onClick={handleToggleBlock}
            disabled={blocking}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
              isBlocked
                ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
            }`}
          >
            {blocking ? '…' : isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      </div>

      {/* ── Voice Call Overlay ─────────────────────────────────────────── */}
      {isInCall && (
        <div className="absolute inset-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="text-center">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover ring-4 ring-amber-500/30" />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-amber-500/20 flex items-center justify-center ring-4 ring-amber-500/30">
                <span className="text-3xl text-amber-400 font-semibold">{callerName[0]}</span>
              </div>
            )}
            <h2 className="text-xl font-semibold text-white">{callerName}</h2>
            <p className="text-white/60 mt-1 text-sm">
              {call.state === 'connecting' && 'Connecting...'}
              {call.state === 'connected' && (
                <>
                  {call.remoteUserJoined ? 'Connected' : 'Waiting for client...'}
                  <span className="ml-2 font-mono text-amber-400">{formatCallDuration(callDuration)}</span>
                </>
              )}
              {call.state === 'error' && <span className="text-red-400">{call.error}</span>}
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <button
              onClick={call.toggleMute}
              title={call.isMuted ? 'Unmute' : 'Mute'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                call.isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {call.isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
            </button>
            <button
              onClick={handleEndCall}
              title="End call"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
            >
              <PhoneOffIcon className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* ── Messages area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2 min-h-full justify-end">
          {messages.length === 0 && (
            <p className="text-center text-white/40 text-sm py-8">
              {chatSessionActive ? 'Session active — say hello!' : 'No messages yet'}
            </p>
          )}
          {messages.map((msg) => {
            const isOwn = msg.senderId === user.id;
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

      {/* ── Input area ────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-[#111118] px-4 py-3 shrink-0">
        {chatSessionActive && (
          <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">
                Live · {fmt(chatRatePerMinute)}/min (your share 70%)
              </span>
            </div>
            <button onClick={handleEndChatSession} className="text-xs text-red-400 hover:text-red-300">
              End Session
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTyping}
            placeholder="Type a message…"
            disabled={sending}
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
            disabled={!inputText.trim() || sending}
            className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-center shrink-0 disabled:bg-white/10 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
