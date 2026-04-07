'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { useSocket } from '@/hooks/useSocket';
import { BILLING_TICK_SECONDS } from '@/lib/constants';

interface CurrentUser { id: string; email: string; }
interface ClientProfile { name: string | null; avatarUrl: string | null; }
interface ClientUser { id: string; clientProfile: ClientProfile | null; }
interface Message { id: string; content: string; senderId: string; senderName: string; senderAvatar: string | null; createdAt: string; }

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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

  // Chat session
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const call = useVoiceCall(voiceSessionId, user?.id ?? '');
  const { onChatRequestResponse, onChatEnded, onMessage, sendTyping, onTyping } = useSocket(user?.id || undefined, 'COMPANION');

  // Load user, client, block status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, clientRes, blockedRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch(`/api/users/${clientId}`),
          fetch('/api/companion/blocked'),
        ]);
        if (userRes.ok) setUser((await userRes.json()).user);
        if (clientRes.ok) setClient((await clientRes.json()).user);
        if (blockedRes.ok) {
          const d = await blockedRes.json();
          setIsBlocked((d.data?.blocked ?? []).some((b: { clientId: string }) => b.clientId === clientId));
        }
      } catch { /* non-fatal */ } finally { setLoading(false); }
    };
    fetchData();
  }, [clientId]);

  // Check for active billing session
  useEffect(() => {
    if (!user) return;
    fetch('/api/companion/active-session')
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.active && d.data.clientId === clientId) {
          setChatSessionActive(true);
          setChatSessionId(d.data.sessionId);
        }
      })
      .catch(() => {});
  }, [user, clientId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/messages/thread?companionUserId=${user.id}&clientUserId=${clientId}`);
      const d = await res.json();
      if (d.success && d.data?.messages) {
        const serverMsgs: Message[] = d.data.messages;
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        setMessages((prev) => {
          const stillOptimistic = prev.filter((m) => m.id.startsWith('opt-') && !serverIds.has(m.id));
          return [...serverMsgs, ...stillOptimistic];
        });
        if (!threadId && d.data.threadId) setThreadId(d.data.threadId);
      }
    } catch { /* non-fatal */ }
  }, [user, clientId, threadId]);

  // Initial load
  useEffect(() => {
    if (user && client) fetchMessages();
  }, [user, client]); // eslint-disable-line react-hooks/exhaustive-deps

  // 0.5s polling while session active
  useEffect(() => {
    if (!chatSessionActive || !user) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(fetchMessages, 500);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [chatSessionActive, user, fetchMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live session timer
  useEffect(() => {
    if (chatSessionActive) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [chatSessionActive]);

  // Subscribe to chat:accepted
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
      if (chatSessionId && data.sessionId !== chatSessionId) return;
      setChatSessionActive(false);
      setChatSessionId(null);
      setSessionEnded(true);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    });
  }, [onChatEnded, chatSessionId]);

  // Ably messages (instant)
  useEffect(() => {
    return onMessage((data) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, { id: data.id, content: data.content, senderId: data.senderId, senderName: data.senderName, senderAvatar: data.senderAvatar ?? null, createdAt: data.createdAt }];
      });
      setIsTyping(false);
    });
  }, [onMessage]);

  // Typing
  useEffect(() => {
    return onTyping(() => {
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });
  }, [onTyping]);

  // Voice call billing tick + duration
  useEffect(() => {
    if (call.state === 'connected' && voiceSessionId) {
      durationIntervalRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      tickIntervalRef.current = setInterval(async () => {
        try {
          await fetch('/api/billing/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: voiceSessionId }) });
        } catch { /* non-fatal */ }
      }, BILLING_TICK_SECONDS * 1000);
      return () => {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      };
    }
  }, [call.state, voiceSessionId]);

  useEffect(() => {
    if (call.state === 'ended' && voiceSessionId) {
      fetch('/api/billing/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: voiceSessionId }) }).catch(() => {});
      setVoiceSessionId(null);
      setCallDuration(0);
    }
  }, [call.state, voiceSessionId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleEndChatSession = useCallback(async () => {
    if (!chatSessionId) return;
    const sid = chatSessionId;
    setChatSessionActive(false);
    setChatSessionId(null);
    setSessionEnded(true);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    try {
      await fetch('/api/billing/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) });
    } catch { /* non-fatal */ }
  }, [chatSessionId]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !user || sending) return;
    const content = inputText.trim();
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);

    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, content, senderId: user.id, senderName: 'You', senderAvatar: null, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: user.id, clientUserId: clientId, content }),
      });
      const d = await res.json();
      if (d.success && d.data) {
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, id: d.data.id } : m));
        if (!threadId && d.data.threadId) setThreadId(d.data.threadId);
      }
    } catch { /* keep optimistic */ } finally { setSending(false); }
  }, [inputText, user, sending, clientId, threadId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    if (user && (threadId ?? clientId)) sendTyping({ threadId: threadId ?? clientId, userId: user.id, receiverId: clientId });
  };

  const handleEndCall = useCallback(async () => {
    if (!voiceSessionId) return;
    await Promise.allSettled([
      fetch('/api/billing/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: voiceSessionId }) }),
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
          const record = (d.data?.blocked ?? []).find((b: { clientId: string; id: string }) => b.clientId === clientId);
          if (record) { await fetch(`/api/companion/block/${record.id}`, { method: 'DELETE' }); setIsBlocked(false); }
        }
      } else {
        const res = await fetch('/api/companion/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) });
        if (res.ok) setIsBlocked(true);
      }
    } catch { /* non-fatal */ } finally { setBlocking(false); }
  };

  const callerName = client?.clientProfile?.name ?? 'Client';
  const callerAvatar = client?.clientProfile?.avatarUrl ?? null;
  const isInCall = call.state !== 'idle' && call.state !== 'ended';
  const canSendMessage = !sessionEnded;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0C14] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  if (!user || !client) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0C14] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-sm">Unable to load chat</p>
        <button onClick={() => router.push('/companion/inbox')} className="px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm">
          Back to Inbox
        </button>
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
        <button
          onClick={() => router.push('/companion/inbox')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative shrink-0">
          {callerAvatar ? (
            <img src={callerAvatar} alt={callerName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
              <span className="text-sm font-semibold text-white/70">{callerName[0]}</span>
            </div>
          )}
          {chatSessionActive && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0C0C14]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{callerName}</p>
          {chatSessionActive && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
              <span className="text-xs text-white/50 tabular-nums">{formatDuration(sessionSeconds)}</span>
            </div>
          )}
          {sessionEnded && <p className="text-xs text-white/30 leading-tight">Session ended</p>}
          {!chatSessionActive && !sessionEnded && <p className="text-xs text-white/30 leading-tight">No active session</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {chatSessionActive && (
            <button onClick={handleEndChatSession} className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 active:scale-95 transition-all">
              End
            </button>
          )}
          <button
            onClick={handleToggleBlock}
            disabled={blocking}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40 ${isBlocked ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'}`}
          >
            {blocking ? '…' : isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      </div>

      {/* ── Voice Call Overlay ───────────────────────────────────────────── */}
      {isInCall && (
        <div className="absolute inset-0 z-10 bg-[#0C0C14]/98 flex flex-col items-center justify-center gap-8">
          <div className="relative">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName} className="w-28 h-28 rounded-full object-cover ring-4 ring-amber-500/20" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-amber-500/10 flex items-center justify-center ring-4 ring-amber-500/20">
                <span className="text-4xl text-amber-400 font-semibold">{callerName[0]}</span>
              </div>
            )}
            {call.state === 'connected' && <div className="absolute inset-0 rounded-full ring-4 ring-green-400/20 animate-ping" />}
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-white">{callerName}</p>
            <p className="text-white/50 text-sm mt-1">
              {call.state === 'connecting' && 'Connecting…'}
              {call.state === 'connected' && (
                <span>
                  {call.remoteUserJoined ? 'Connected · ' : 'Waiting… · '}
                  <span className="text-amber-400 tabular-nums">{formatDuration(callDuration)}</span>
                </span>
              )}
              {call.state === 'error' && <span className="text-red-400">{call.error}</span>}
            </p>
          </div>
          <div className="flex gap-5 items-center">
            <button onClick={call.toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${call.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.08] text-white/70'}`}>
              {call.isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
            </button>
            <button onClick={handleEndCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center text-white transition-colors">
              <PhoneOffIcon className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-1.5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <span className="text-2xl">👋</span>
              <p className="text-white/30 text-sm">{chatSessionActive ? `Say hello to ${callerName}!` : 'No messages yet'}</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isOwn = msg.senderId === user.id;
            const prevMsg = messages[i - 1];
            const nextMsg = messages[i + 1];
            const isSameGroupAbove = prevMsg?.senderId === msg.senderId;
            const isSameGroupBelow = nextMsg?.senderId === msg.senderId;

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isSameGroupAbove ? 'mt-0.5' : 'mt-3'}`}>
                {!isOwn && (
                  <div className="w-7 shrink-0 self-end mb-0.5">
                    {!isSameGroupBelow && (
                      callerAvatar
                        ? <img src={callerAvatar} alt={callerName} className="w-7 h-7 rounded-full object-cover" />
                        : <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center"><span className="text-xs font-semibold text-white/50">{callerName[0]}</span></div>
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
                {callerAvatar
                  ? <img src={callerAvatar} alt={callerName} className="w-7 h-7 rounded-full object-cover" />
                  : <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center"><span className="text-xs font-semibold text-white/50">{callerName[0]}</span></div>
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

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-[#0C0C14] border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
      >
        {sessionEnded && (
          <p className="text-center text-white/30 text-xs mb-3">Session ended</p>
        )}
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTyping}
            placeholder={sessionEnded ? 'Session ended' : 'Message…'}
            disabled={!canSendMessage || sending}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            className="flex-1 resize-none bg-white/[0.05] border border-white/[0.09] focus:border-amber-500/40 rounded-3xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-colors min-h-[46px] max-h-[120px] leading-relaxed disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || !canSendMessage || sending}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: (inputText.trim() && canSendMessage) ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.05)',
              boxShadow: (inputText.trim() && canSendMessage) ? '0 4px 16px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            <svg className={`w-5 h-5 transition-colors ${(inputText.trim() && canSendMessage) ? 'text-black' : 'text-white/20'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
