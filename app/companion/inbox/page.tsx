'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getChatRoomChannelName } from '@/lib/ably';
import { useSocket } from '@/hooks/useSocket';
import type { RoomMessage } from '@/hooks/useSocket';
import type { VoiceCallState } from '@/hooks/useVoiceCall';
import { useCompanionCall } from '@/contexts/CompanionCallContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Thread {
  threadId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  lastMessage: { content: string; senderId: string; createdAt: string; isRead: boolean } | null;
  unreadCount: number;
  updatedAt: string;
}

interface LocalMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
}

interface ClientInfo {
  id: string;
  name: string;
  avatar: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(d: Date | string) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diffDays < 7) return date.toLocaleDateString('en-IN', { weekday: 'short' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function fmt(paise: number) {
  return `₹${Math.round(paise / 100)}`;
}

// ─── Inner page (needs Suspense for useSearchParams) ──────────────────────────

function CompanionInboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeClientInfo, setActiveClientInfo] = useState<ClientInfo | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Billing session state (per active thread)
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatRatePerMinute, setChatRatePerMinute] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartedAtMsRef = useRef<number | null>(null);

  // ── Voice call (from layout context — persists across navigation) ─────────
  const companionCall = useCompanionCall();
  const voiceSessionId = searchParams.get('voiceSessionId');
  const voiceCall = companionCall.voiceCall;
  const voiceLiveSeconds = companionCall.liveSeconds;

  // If we land on this page with voiceSessionId but context has no active call,
  // start it (e.g. page refresh or direct URL)
  useEffect(() => {
    if (voiceSessionId && !companionCall.activeCall && activeClientId) {
      const clientInfo = threads.find(t => t.clientId === activeClientId);
      companionCall.startCall({
        sessionId: voiceSessionId,
        clientId: activeClientId,
        clientName: clientInfo?.clientName ?? 'Client',
        clientAvatar: clientInfo?.clientAvatar ?? null,
      });
    }
  }, [voiceSessionId, companionCall.activeCall, activeClientId, threads]);

  const handleEndVoiceCall = useCallback(async () => {
    await companionCall.endCall();
    router.replace(`/companion/inbox${activeClientId ? `?active=${activeClientId}` : ''}`);
  }, [companionCall, router, activeClientId]);

  // Chat room ID — drives room subscription in useSocket.
  // Must match the format used by the client side and the server publisher.
  const chatRoomId =
    currentUserId && activeClientId
      ? getChatRoomChannelName(activeClientId, currentUserId)
      : undefined;

  const {
    onChatRequestResponse,
    onChatEnded,
    publishToRoom,
    publishRoomTyping,
    roomMessages,    // direct state from hook — no callbacks
    isOtherTyping,   // direct state from hook — no callbacks
  } = useSocket(currentUserId ?? undefined, 'COMPANION', chatRoomId);

  // ── Load user + threads ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [userRes, threadsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/messages/threads'),
        ]);
        if (userRes.ok) {
          const d = await userRes.json();
          setCurrentUserId(d.user?.id ?? null);
        }
        if (threadsRes.ok) {
          const d = await threadsRes.json();
          setThreads((d.data ?? []).map((t: {
            threadId: string; clientId: string; clientName: string;
            clientAvatar?: string | null; lastMessage: Thread['lastMessage'];
            unreadCount: number; updatedAt: string;
          }) => ({
            threadId: t.threadId,
            clientId: t.clientId,
            clientName: t.clientName,
            clientAvatar: t.clientAvatar ?? null,
            lastMessage: t.lastMessage,
            unreadCount: t.unreadCount,
            updatedAt: t.updatedAt,
          })));
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Auto-select from ?active= param ──────────────────────────────────────
  useEffect(() => {
    const active = searchParams.get('active');
    if (!active) return;
    setActiveClientId(active);
    setShowMobileChat(true);
  }, [searchParams]);

  // ── Resolve client info ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeClientId) { setActiveClientInfo(null); return; }
    const thread = threads.find(t => t.clientId === activeClientId);
    if (thread) {
      setActiveClientInfo({ id: activeClientId, name: thread.clientName, avatar: thread.clientAvatar });
      return;
    }
    fetch(`/api/users/${activeClientId}`)
      .then(r => r.json())
      .then(d => setActiveClientInfo({
        id: activeClientId,
        name: d.user?.clientProfile?.name ?? 'Client',
        avatar: d.user?.clientProfile?.avatarUrl ?? null,
      }))
      .catch(() => setActiveClientInfo({ id: activeClientId, name: 'Client', avatar: null }));
  }, [activeClientId, threads]);

  // ── Reset session state when thread changes ───────────────────────────────
  useEffect(() => {
    setChatSessionActive(false);
    setChatSessionId(null);
    setChatRatePerMinute(0);
    setSessionEnded(false);
    setSessionSeconds(0);
    sessionStartedAtMsRef.current = null;
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
  }, [activeClientId]);

  // ── Poll for active billing session ───────────────────────────────────────
  useEffect(() => {
    if (!activeClientId || !currentUserId || chatSessionActive) return;
    const check = async () => {
      try {
        const res = await fetch(`/api/billing/session-status?clientId=${activeClientId}`);
        const d = await res.json();
        if (d.data?.status === 'ACTIVE') {
          const durationSeconds: number = d.data.durationSeconds ?? 0;
          const startedAt: string | null = d.data.startedAt ?? null;
          sessionStartedAtMsRef.current = startedAt
            ? new Date(startedAt).getTime()
            : Date.now() - durationSeconds * 1000;
          setChatSessionActive(true);
          setChatSessionId(d.data.sessionId);
          setChatRatePerMinute(d.data.ratePerMinute ?? 0);
          setSessionSeconds(durationSeconds);
        }
      } catch { /* non-fatal */ }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [activeClientId, currentUserId, chatSessionActive]);

  // ── Ably: chat:accepted ───────────────────────────────────────────────────
  useEffect(() => {
    return onChatRequestResponse((data) => {
      if (data.status !== 'ACCEPTED' || !data.clientId) return;
      if (data.clientId === activeClientId) {
        sessionStartedAtMsRef.current = Date.now();
        setChatSessionActive(true);
        if (data.sessionId) setChatSessionId(data.sessionId);
      }
    });
  }, [onChatRequestResponse, activeClientId]);

  // ── Ably: chat:ended ──────────────────────────────────────────────────────
  useEffect(() => {
    return onChatEnded((data) => {
      if (chatSessionId && data.sessionId !== chatSessionId) return;
      setChatSessionActive(false);
      setSessionEnded(true);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    });
  }, [onChatEnded, chatSessionId]);

  // ── Session timer (wall-clock based) ──────────────────────────────────────
  useEffect(() => {
    if (!chatSessionActive) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      return;
    }
    if (!sessionStartedAtMsRef.current) {
      sessionStartedAtMsRef.current = Date.now();
    }
    const tick = () => {
      if (!sessionStartedAtMsRef.current) return;
      setSessionSeconds(Math.floor((Date.now() - sessionStartedAtMsRef.current) / 1000));
    };
    tick();
    sessionTimerRef.current = setInterval(tick, 1000);
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [chatSessionActive]);

  // Sync timer on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && chatSessionActive && sessionStartedAtMsRef.current) {
        setSessionSeconds(Math.floor((Date.now() - sessionStartedAtMsRef.current) / 1000));
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [chatSessionActive]);

  useEffect(() => () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    if (!chatSessionId) return;
    const sid = chatSessionId;
    setChatSessionActive(false);
    setSessionEnded(true);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    await fetch('/api/billing/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    }).catch(() => {});
  }, [chatSessionId]);

  const handleSelectClient = (clientId: string) => {
    setActiveClientId(clientId);
    setShowMobileChat(true);
    setThreads(prev => prev.map(t => t.clientId === clientId ? { ...t, unreadCount: 0 } : t));
  };

  const handleOwnMessage = useCallback((content: string, createdAt: string) => {
    if (!activeClientId) return;
    setThreads(prev => prev.map(t =>
      t.clientId === activeClientId
        ? { ...t, lastMessage: { content, senderId: currentUserId ?? '', createdAt, isRead: true }, updatedAt: createdAt }
        : t
    ));
  }, [activeClientId, currentUserId]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-129px)] md:h-[calc(100dvh-65px)] overflow-hidden">

      {/* ── Thread list ─────────────────────────────────────────────────── */}
      <div className={cn(
        'h-full flex flex-col border-r border-white/[0.06]',
        'md:w-72 md:shrink-0',
        showMobileChat ? 'hidden md:flex' : 'w-full flex'
      )}>
        <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="font-semibold text-white text-base">Inbox</h2>
          <p className="text-xs text-white/30 mt-0.5">Client conversations</p>
        </div>

        {threads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
              <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/30 text-sm">No conversations yet</p>
            <p className="text-white/20 text-xs">Clients appear here after a chat request</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {threads.map(t => (
              <button
                key={t.threadId}
                onClick={() => handleSelectClient(t.clientId)}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-4 py-3 transition-colors border-b border-white/[0.03]',
                  activeClientId === t.clientId
                    ? 'bg-white/[0.06] border-l-2 border-l-amber-500'
                    : 'hover:bg-white/[0.03]'
                )}
              >
                <div className="w-11 h-11 rounded-full shrink-0 overflow-hidden bg-amber-500/10 flex items-center justify-center">
                  {t.clientAvatar
                    ? <img src={t.clientAvatar} alt={t.clientName} className="w-full h-full object-cover" />
                    : <span className="text-sm font-semibold text-amber-300">{t.clientName[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-sm font-medium text-white truncate">{t.clientName}</p>
                    {t.lastMessage && (
                      <span className="text-[11px] text-white/30 shrink-0 ml-2">{formatTime(t.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-white/40 truncate flex-1">
                      {t.lastMessage
                        ? (t.lastMessage.senderId === currentUserId ? 'You: ' : '') + t.lastMessage.content
                        : 'No messages yet'}
                    </p>
                    {t.unreadCount > 0 && (
                      <span className="ml-2 shrink-0 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center px-1">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <div className={cn(
        'flex-1 h-full overflow-hidden',
        showMobileChat ? 'flex flex-col' : 'hidden md:flex md:flex-col'
      )}>
        {currentUserId && activeClientId && activeClientInfo ? (
          <CompanionChatPanel
            key={activeClientId}
            currentUserId={currentUserId}
            clientId={activeClientId}
            clientName={activeClientInfo.name}
            clientAvatar={activeClientInfo.avatar}
            chatSessionActive={chatSessionActive}
            sessionEnded={sessionEnded}
            sessionSeconds={sessionSeconds}
            ratePerMinute={chatRatePerMinute}
            onEndSession={handleEndSession}
            onBack={() => setShowMobileChat(false)}
            onOwnMessage={handleOwnMessage}
            publishToRoom={publishToRoom}
            publishRoomTyping={publishRoomTyping}
            roomMessages={roomMessages}
            isOtherTyping={isOtherTyping}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center">
              <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/30 text-sm">Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* ── Voice call overlay ──────────────────────────────────────────── */}
      {(voiceSessionId || companionCall.activeCall) && voiceCall.state !== 'idle' && voiceCall.state !== 'ended' && (
        <CompanionVoiceOverlay
          callState={voiceCall.state}
          isMuted={voiceCall.isMuted}
          remoteUserJoined={voiceCall.remoteUserJoined}
          error={voiceCall.error}
          liveSeconds={voiceLiveSeconds}
          clientName={companionCall.activeCall?.clientName ?? activeClientInfo?.name ?? 'Client'}
          clientAvatar={companionCall.activeCall?.clientAvatar ?? activeClientInfo?.avatar ?? null}
          onToggleMute={voiceCall.toggleMute}
          onEndCall={handleEndVoiceCall}
        />
      )}

    </div>
  );
}

export default function CompanionInboxPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    }>
      <CompanionInboxContent />
    </Suspense>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

interface CompanionChatPanelProps {
  currentUserId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  chatSessionActive: boolean;
  sessionEnded: boolean;
  sessionSeconds: number;
  ratePerMinute: number;
  onEndSession: () => Promise<void>;
  onBack: () => void;
  onOwnMessage: (content: string, createdAt: string) => void;
  publishToRoom: (text: string, id?: string) => Promise<string | null>;
  publishRoomTyping: (isTyping: boolean) => void;
  roomMessages: RoomMessage[];   // direct state from parent hook
  isOtherTyping: boolean;        // direct state from parent hook
}

function CompanionChatPanel({
  currentUserId, clientId, clientName, clientAvatar,
  chatSessionActive, sessionEnded, sessionSeconds, ratePerMinute,
  onEndSession, onBack, onOwnMessage,
  publishToRoom, publishRoomTyping,
  roomMessages, isOtherTyping,
}: CompanionChatPanelProps) {
  // History: messages loaded from DB on mount
  const [history, setHistory] = useState<LocalMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Pending: optimistically added messages waiting for Ably echo
  const [pendingMessages, setPendingMessages] = useState<LocalMessage[]>([]);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Load history from DB ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/messages/thread?companionUserId=${currentUserId}&clientUserId=${clientId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.messages)) {
          setHistory(d.data.messages.map((m: { id: string; content: string; senderId: string; createdAt: string }) => ({
            id: m.id, text: m.content, senderId: m.senderId, createdAt: new Date(m.createdAt),
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

  // ── Merged message list ───────────────────────────────────────────────────
  // history (DB) + roomMessages (Ably real-time) + pendingMessages (optimistic)
  // Deduplicated by ID, sorted by createdAt.
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

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages, isOtherTyping]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending || sessionEnded) return;
    const content = inputText.trim();
    const now = new Date();
    const msgId = `${currentUserId}-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`;

    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSending(true);
    publishRoomTyping(false);

    // Optimistic: show immediately before echo
    setPendingMessages(prev => [...prev, { id: msgId, text: content, senderId: currentUserId, createdAt: now }]);

    try {
      await publishToRoom(content, msgId);
      onOwnMessage(content, now.toISOString());
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: currentUserId, clientUserId: clientId, content, ablyMsgId: msgId }),
      }).catch(() => {});
    } catch {
      setPendingMessages(prev => prev.filter(m => m.id !== msgId));
      setInputText(content);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, sessionEnded, currentUserId, clientId, publishToRoom, publishRoomTyping, onOwnMessage]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    publishRoomTyping(e.target.value.trim().length > 0);
  };

  return (
    <div className="flex flex-col h-full bg-[#0C0C14]">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <button onClick={onBack}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {clientAvatar
          ? <img src={clientAvatar} alt={clientName} className="w-9 h-9 rounded-full object-cover shrink-0" />
          : <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-amber-300">{clientName[0]}</span>
            </div>}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{clientName}</p>
          {chatSessionActive ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
              <span className="text-xs text-white/50 tabular-nums">{formatDuration(sessionSeconds)}</span>
              {ratePerMinute > 0 && <span className="text-xs text-white/25">· {fmt(Math.floor(ratePerMinute * 0.4))}/min</span>}
            </div>
          ) : sessionEnded ? (
            <p className="text-xs text-white/30 leading-tight">Session ended</p>
          ) : (
            <p className="text-xs text-white/30 leading-tight">Client</p>
          )}
        </div>

        {chatSessionActive && (
          <button onClick={onEndSession}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 active:scale-95 transition-all">
            End
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {!historyLoaded ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
          </div>
        ) : allMessages.length === 0 && !isOtherTyping ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
            <span className="text-3xl">👋</span>
            <p className="text-white/30 text-sm">
              {chatSessionActive ? `Say hello to ${clientName}!` : 'No messages yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {allMessages.map((msg, i) => {
              const isOwn = msg.senderId === currentUserId;
              const sameAbove = i > 0 && allMessages[i - 1].senderId === msg.senderId;
              const sameBelow = i < allMessages.length - 1 && allMessages[i + 1].senderId === msg.senderId;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${sameAbove ? 'mt-0.5' : 'mt-3'}`}>
                  {!isOwn && (
                    <div className="w-7 shrink-0 self-end mb-0.5">
                      {!sameBelow && (clientAvatar
                        ? <img src={clientAvatar} alt={clientName} className="w-7 h-7 rounded-full object-cover" />
                        : <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-amber-300">{clientName[0]}</span>
                          </div>)}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                      isOwn
                        ? `bg-gradient-to-br from-amber-500 to-amber-400 text-black font-medium ${sameAbove ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-sm'}`
                        : `bg-white/[0.08] text-white border border-white/[0.06] ${sameAbove ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-sm'}`
                    }`}>
                      {msg.text}
                    </div>
                    {!sameBelow && (
                      <span className="text-[10px] text-white/20 px-1 mt-0.5">
                        {(msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt))
                          .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {isOtherTyping && (
              <div className="flex items-end gap-2 mt-3">
                <div className="w-7 shrink-0 self-end mb-0.5">
                  {clientAvatar
                    ? <img src={clientAvatar} alt={clientName} className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-amber-300">{clientName[0]}</span>
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

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
        {sessionEnded && (
          <p className="text-center text-white/25 text-xs mb-2">Session ended · messaging disabled</p>
        )}
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTyping}
            placeholder={sessionEnded ? 'Session ended' : 'Message…'}
            disabled={sessionEnded || sending}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 resize-none bg-white/[0.05] border border-white/[0.09] focus:border-amber-500/40 rounded-3xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-colors min-h-[46px] max-h-[120px] leading-relaxed disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sessionEnded || sending}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: (inputText.trim() && !sessionEnded) ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.05)',
              boxShadow: (inputText.trim() && !sessionEnded) ? '0 4px 16px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            <svg className={`w-5 h-5 ${(inputText.trim() && !sessionEnded) ? 'text-black' : 'text-white/20'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Companion voice overlay ──────────────────────────────────────────────────

interface CompanionVoiceOverlayProps {
  callState: VoiceCallState;
  isMuted: boolean;
  remoteUserJoined: boolean;
  error: string | null;
  liveSeconds: number;
  clientName: string;
  clientAvatar: string | null;
  onToggleMute: () => Promise<void>;
  onEndCall: () => Promise<void>;
}

function CompanionVoiceOverlay({
  callState, isMuted, remoteUserJoined, error,
  liveSeconds, clientName, clientAvatar,
  onToggleMute, onEndCall,
}: CompanionVoiceOverlayProps) {
  const statusText =
    callState === 'connecting' ? 'Connecting…' :
    callState === 'error' ? (error ?? 'Call error') :
    callState === 'ended' ? 'Call ended' :
    !remoteUserJoined ? 'Waiting for client…' :
    'In call';

  const showTimer = callState === 'connected' && remoteUserJoined;
  const showConnecting = callState === 'connecting' || (callState === 'connected' && !remoteUserJoined);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-[#0A0A12] px-8"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>

      {/* Top: name + status */}
      <div className="flex flex-col items-center gap-2 mt-8">
        {clientAvatar
          ? <img src={clientAvatar} alt={clientName} className="w-24 h-24 rounded-full object-cover ring-4 ring-amber-500/20" />
          : <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
              <span className="text-3xl font-semibold text-amber-300">{clientName[0]}</span>
            </div>}
        <p className="text-xl font-semibold text-white mt-3">{clientName}</p>
        <p className="text-sm text-white/50">{statusText}</p>
        {showTimer && (
          <p className="text-2xl font-mono text-white/70 mt-1">{formatDuration(liveSeconds)}</p>
        )}
        {showConnecting && (
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-2" />
        )}
      </div>

      {/* Bottom: controls */}
      <div className="flex items-center justify-center gap-8">
        {/* Mute */}
        <button
          onClick={onToggleMute}
          disabled={callState !== 'connected'}
          className="flex flex-col items-center gap-2 disabled:opacity-40"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white/20' : 'bg-white/10'}`}>
            {isMuted ? (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          <span className="text-xs text-white/50">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* End call */}
        <button onClick={onEndCall} className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-400 transition-colors active:scale-95">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
            </svg>
          </div>
          <span className="text-xs text-white/50">End</span>
        </button>
      </div>
    </div>
  );
}
