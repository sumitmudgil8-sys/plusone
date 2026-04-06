'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';

/* ─── Types ─────────────────────────────────────────────────── */

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface Thread {
  threadId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

interface CurrentUser {
  id: string;
  role: string;
}

interface SessionSummary {
  sessionId: string;
  totalCharged: number;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDateLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const day = date.getDate();
  const mon = date.toLocaleDateString('en-IN', { month: 'short' });
  if (date.getFullYear() !== now.getFullYear()) return `${day} ${mon} ${date.getFullYear()}`;
  return `${day} ${mon}`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDays < 7) return date.toLocaleDateString('en-IN', { weekday: 'short' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function within2Min(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 2 * 60 * 1000;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

/* ─── Component ──────────────────────────────────────────────── */

export default function CompanionInboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showScrollPill, setShowScrollPill] = useState(false);

  // Chat billing session state (companion is passive — can end, but not start)
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatRatePerMinute, setChatRatePerMinute] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeThreadIdRef = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  const activeThread = threads.find((t) => t.threadId === activeThreadId) ?? null;

  const { onMessage, onChatEnded } = useSocket(currentUser?.id, 'COMPANION');

  /* ─── Scroll helpers ─── */
  const isNearBottom = useCallback(() => {
    const el = messagesBoxRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const el = messagesBoxRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (force || near) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowScrollPill(false);
    } else {
      setShowScrollPill(true);
    }
  }, []);

  /* ─── Initial load ─── */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, threadsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/messages/threads'),
        ]);
        if (userRes.ok) {
          const d = await userRes.json();
          setCurrentUser({ id: d.user.id, role: d.user.role });
        }
        if (threadsRes.ok) {
          const d = await threadsRes.json();
          const list = (d.data ?? []) as Array<{
            threadId: string;
            clientId: string;
            clientName: string;
            lastMessage: Thread['lastMessage'];
            unreadCount: number;
            updatedAt: string;
          }>;
          const mapped: Thread[] = list.map((t) => ({
            threadId: t.threadId,
            clientId: t.clientId,
            clientName: t.clientName,
            clientAvatar: null,
            lastMessage: t.lastMessage,
            unreadCount: t.unreadCount,
            updatedAt: t.updatedAt,
          }));
          setThreads(mapped);
          if (mapped.length > 0) setActiveThreadId(mapped[0].threadId);
        }
      } catch (err) {
        console.error('Companion inbox init error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  /* ─── Reset session state when thread changes ─── */
  useEffect(() => {
    setChatSessionActive(false);
    setChatSessionId(null);
    setChatRatePerMinute(0);
    setSessionSummary(null);
  }, [activeThreadId]);

  /* ─── Check active billing session when thread is selected ─── */
  useEffect(() => {
    if (!activeThread || !currentUser) return;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/companion/active-session');
        if (!res.ok) return;
        const d = await res.json();
        if (d.data?.active && d.data.clientId === activeThread.clientId) {
          setChatSessionActive(true);
          setChatSessionId(d.data.sessionId);
          setChatRatePerMinute(d.data.ratePerMinute ?? 0);
        }
      } catch { /* non-fatal */ }
    };
    checkSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, currentUser]);

  /* ─── Fetch messages when thread changes ─── */
  useEffect(() => {
    if (!activeThreadId) return;
    const thread = threadsRef.current.find((t) => t.threadId === activeThreadId);
    if (!thread) return;

    setMessagesLoading(true);
    setMessages([]);

    fetch(`/api/messages/${thread.clientId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50);
      })
      .catch((err) => console.error('Fetch messages error:', err))
      .finally(() => setMessagesLoading(false));
  }, [activeThreadId]);

  /* ─── chat:ended — session ended by either side ─── */
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

  /* ─── End session (companion side) ─── */
  const endChatSession = useCallback(async () => {
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

  /* ─── Clean up ─── */
  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    };
  }, []);

  /* ─── Real-time messages ─── */
  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      const currentActiveId = activeThreadIdRef.current;
      const currentThreads = threadsRef.current;
      const active = currentThreads.find((t) => t.threadId === currentActiveId);

      const belongsToActive =
        active &&
        (data.threadId === active.threadId || data.senderId === active.clientId);

      if (belongsToActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, {
            id: data.id,
            content: data.content,
            senderId: data.senderId,
            senderName: data.senderName,
            createdAt: data.createdAt,
          }];
        });
        scrollToBottom(false);
      } else {
        setThreads((prev) =>
          prev.map((t) =>
            t.clientId === data.senderId
              ? {
                  ...t,
                  unreadCount: t.unreadCount + 1,
                  lastMessage: {
                    content: data.content,
                    senderId: data.senderId,
                    createdAt: data.createdAt,
                    isRead: false,
                  },
                  updatedAt: data.createdAt,
                }
              : t
          )
        );
      }
    });
    return unsubscribe;
  }, [onMessage, scrollToBottom]);

  /* ─── Textarea auto-resize ─── */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ─── Send message ─── */
  const handleSend = async () => {
    if (!input.trim() || !activeThread || sending || !currentUser) return;
    const content = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      content,
      senderId: currentUser.id,
      senderName: 'You',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);

    try {
      // For COMPANION role, the API's "companionId" field is the clientId (the other party)
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: activeThread.clientId, content }),
      });
      const d = await res.json();
      if (d.success && d.data?.message) {
        const saved = d.data.message;
        setMessages((prev) =>
          prev.map((m) => m.id === tempId ? { ...m, id: saved.id, createdAt: saved.createdAt } : m)
        );
        setThreads((prev) =>
          prev.map((t) =>
            t.threadId === activeThread.threadId
              ? {
                  ...t,
                  lastMessage: { content, senderId: currentUser.id, createdAt: saved.createdAt, isRead: true },
                  updatedAt: saved.createdAt,
                }
              : t
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const selectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setShowChat(true);
    setThreads((prev) => prev.map((t) => t.threadId === threadId ? { ...t, unreadCount: 0 } : t));
  };

  /* ─── Loading ─── */
  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ─── Thread list panel ─── */
  const ThreadListPanel = (
    <div className="h-full flex flex-col border-r border-white/10 bg-black/20">
      <div className="px-4 py-4 border-b border-white/10 shrink-0">
        <h2 className="font-semibold text-white text-lg">Inbox</h2>
        <p className="text-xs text-white/40 mt-0.5">Messages from clients</p>
      </div>

      {threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <svg className="w-10 h-10 text-white/10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-white/40 text-sm">No conversations yet</p>
          <p className="text-white/25 text-xs mt-1">Clients will appear here once they message you</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.threadId}
              onClick={() => selectThread(thread.threadId)}
              className={cn(
                'w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-white/5',
                activeThreadId === thread.threadId
                  ? 'bg-white/[0.08] border-l-2 border-l-gold'
                  : 'hover:bg-white/5'
              )}
            >
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gold/20 flex items-center justify-center">
                  {thread.clientAvatar ? (
                    <img src={thread.clientAvatar} alt={thread.clientName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-gold">{thread.clientName.charAt(0)}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="text-sm font-medium text-white truncate">{thread.clientName}</p>
                  {thread.lastMessage && (
                    <span className="text-xs text-white/40 shrink-0 ml-2">{formatTime(thread.lastMessage.createdAt)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-white/50 truncate flex-1">
                    {thread.lastMessage
                      ? (thread.lastMessage.senderId === currentUser.id ? 'You: ' : '') + thread.lastMessage.content
                      : 'No messages yet'}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-gold text-black text-xs font-bold flex items-center justify-center">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* ─── Chat panel ─── */
  const ChatPanel = activeThread ? (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button
          onClick={() => setShowChat(false)}
          className="md:hidden p-1 -ml-1 text-white/60 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-9 h-9 rounded-full overflow-hidden bg-gold/20 flex items-center justify-center shrink-0">
          {activeThread.clientAvatar ? (
            <img src={activeThread.clientAvatar} alt={activeThread.clientName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-medium text-gold">{activeThread.clientName.charAt(0)}</span>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{activeThread.clientName}</p>
          {chatSessionActive ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">
                Session Active · {fmt(chatRatePerMinute)}/min
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/40">Client</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {chatSessionActive && (
            <button
              onClick={endChatSession}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Session summary banner */}
      {sessionSummary && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-charcoal-surface border-b border-white/10">
          <p className="text-xs text-white/70">
            Session ended · You earned <span className="text-green-400 font-semibold">{fmt(sessionSummary.totalCharged)}</span>
          </p>
          <button onClick={() => setSessionSummary(null)} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-white/40 text-sm">No messages yet</p>
            <p className="text-white/25 text-xs mt-1">Say hello!</p>
          </div>
        ) : (
          <div
            ref={messagesBoxRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
            onScroll={() => { if (isNearBottom()) setShowScrollPill(false); }}
          >
            {messages.map((msg, i) => {
              const isOwn = msg.senderId === currentUser.id;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
              const sameGroupPrev = !!prev && prev.senderId === msg.senderId && within2Min(prev.createdAt, msg.createdAt);
              const sameGroupNext = !!next && next.senderId === msg.senderId && within2Min(msg.createdAt, next.createdAt);
              const showTime = !sameGroupNext;

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30 px-2">{formatDateLabel(msg.createdAt)}</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start', sameGroupPrev ? 'mt-0.5' : 'mt-2')}>
                    <div
                      className={cn(
                        'px-4 py-2 text-sm text-white break-words max-w-[70%] rounded-2xl',
                        isOwn
                          ? 'bg-gold/20 border border-gold/30 rounded-tr-sm'
                          : 'bg-white/[0.08] border border-white/10 rounded-tl-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                    {showTime && (
                      <span className={cn('text-xs text-white/30 mt-1', isOwn ? 'self-end' : 'self-start')}>
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {showScrollPill && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-gold text-black text-xs font-semibold shadow-lg whitespace-nowrap"
          >
            ↓ New message
          </button>
        )}
      </div>

      {/* Input area — always enabled for companion */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none overflow-hidden bg-white/5 border border-white/10 focus:border-gold/50 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              'w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-colors',
              input.trim() && !sending ? 'bg-gold hover:bg-gold/80' : 'bg-white/10 cursor-not-allowed'
            )}
          >
            <svg
              className={cn('w-4 h-4', input.trim() && !sending ? 'text-black' : 'text-white/30')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex-1 h-full flex flex-col items-center justify-center text-center px-8">
      <svg className="w-16 h-16 text-white/10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p className="text-lg font-medium text-white/40">Select a conversation</p>
      <p className="text-sm text-white/25 mt-1">Choose from your conversations on the left</p>
    </div>
  );

  /* ─── Layout ─── */
  return (
    <div className="-mx-4 -my-6 flex overflow-hidden h-[calc(100dvh-129px)] md:h-[calc(100dvh-65px)]">
      {/* Left panel */}
      <div className={cn('h-full md:w-80 md:shrink-0', showChat ? 'hidden md:block' : 'w-full block')}>
        {ThreadListPanel}
      </div>

      {/* Right panel */}
      <div className={cn('h-full flex-1 overflow-hidden', showChat ? 'flex flex-col' : 'hidden md:flex md:flex-col')}>
        {ChatPanel}
      </div>
    </div>
  );
}
