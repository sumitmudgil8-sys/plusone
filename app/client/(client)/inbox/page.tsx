'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  companionId: string;
  companionName: string;
  companionAvatar: string | null;
  companionAvailabilityStatus: string;
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

function statusLabel(s: string) {
  if (s === 'ONLINE') return 'Available';
  if (s === 'BUSY') return 'In a session';
  return 'Offline';
}

/* ─── Component ──────────────────────────────────────────────── */

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false); // mobile: list vs chat
  const [showScrollPill, setShowScrollPill] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stable refs to avoid stale closures in callbacks
  const activeThreadIdRef = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  // Derive active thread from state
  const activeThread = threads.find((t) => t.threadId === activeThreadId) ?? null;

  // Real-time via Ably (same channel names / events as existing useSocket hook)
  const { onMessage } = useSocket(currentUser?.id, currentUser?.role);

  /* Scroll helpers */
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

  /* Initial load */
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
          const list: Thread[] = d.data ?? [];
          setThreads(list);
          if (list.length > 0) setActiveThreadId(list[0].threadId);
        }
      } catch (err) {
        console.error('Inbox init error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  /* Fetch messages when active thread changes */
  useEffect(() => {
    if (!activeThreadId) return;
    const thread = threadsRef.current.find((t) => t.threadId === activeThreadId);
    if (!thread) return;

    setMessagesLoading(true);
    setMessages([]);

    fetch(`/api/messages/${thread.companionId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50);
      })
      .catch((err) => console.error('Fetch messages error:', err))
      .finally(() => setMessagesLoading(false));
  }, [activeThreadId]);

  /* Ably real-time messages */
  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      const currentActiveId = activeThreadIdRef.current;
      const currentThreads = threadsRef.current;
      const activeThread = currentThreads.find((t) => t.threadId === currentActiveId);

      const belongsToActive =
        activeThread &&
        (data.threadId === activeThread.threadId || data.senderId === activeThread.companionId);

      if (belongsToActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [
            ...prev,
            {
              id: data.id,
              content: data.content,
              senderId: data.senderId,
              senderName: data.senderName,
              createdAt: data.createdAt,
            },
          ];
        });
        scrollToBottom(false);
      } else {
        // Update the right thread row in the list
        setThreads((prev) =>
          prev.map((t) =>
            t.companionId === data.senderId
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

  /* Textarea auto-resize */
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

  /* Send message */
  const handleSend = async () => {
    if (!input.trim() || !activeThread || sending || !currentUser) return;
    const content = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: activeThread.companionId, content }),
      });
      const d = await res.json();
      if (d.success && d.data?.message) {
        const saved = d.data.message;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: saved.id, createdAt: saved.createdAt }
              : m
          )
        );
        setThreads((prev) =>
          prev.map((t) =>
            t.threadId === activeThread.threadId
              ? {
                  ...t,
                  lastMessage: {
                    content,
                    senderId: currentUser.id,
                    createdAt: saved.createdAt,
                    isRead: true,
                  },
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
    setThreads((prev) =>
      prev.map((t) => (t.threadId === threadId ? { ...t, unreadCount: 0 } : t))
    );
  };

  /* ─── Loading ─── */
  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ─── Thread list panel ─── */
  const ThreadListPanel = (
    <div className="h-full flex flex-col border-r border-white/10 bg-black/20">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 shrink-0">
        <h2 className="font-semibold text-white text-lg">Inbox</h2>
      </div>

      {threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <svg className="w-10 h-10 text-white/10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-white/40 text-sm">No conversations yet</p>
          <p className="text-white/25 text-xs mt-1">Start a chat from a companion&apos;s profile</p>
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
                  ? 'bg-white/[0.08] border-l-2 border-l-amber-400'
                  : 'hover:bg-white/5'
              )}
            >
              {/* Avatar with availability dot */}
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-amber-500/20 flex items-center justify-center">
                  {thread.companionAvatar ? (
                    <img
                      src={thread.companionAvatar}
                      alt={thread.companionName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-amber-400">
                      {thread.companionName.charAt(0)}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-charcoal',
                    thread.companionAvailabilityStatus === 'ONLINE'
                      ? 'bg-green-400'
                      : thread.companionAvailabilityStatus === 'BUSY'
                      ? 'bg-amber-400'
                      : 'bg-gray-500'
                  )}
                />
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="text-sm font-medium text-white truncate">{thread.companionName}</p>
                  {thread.lastMessage && (
                    <span className="text-xs text-white/40 shrink-0 ml-2">
                      {formatTime(thread.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-white/50 truncate flex-1">
                    {thread.lastMessage
                      ? (thread.lastMessage.senderId === currentUser.id ? 'You: ' : '') +
                        thread.lastMessage.content
                      : 'No messages yet'}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-amber-500 text-xs text-black font-bold flex items-center justify-center">
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

  /* ─── Chat panel (right side) ─── */
  const ChatPanel = activeThread ? (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        {/* Mobile back */}
        <button
          onClick={() => setShowChat(false)}
          className="md:hidden p-1 -ml-1 text-white/60 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-amber-500/20 flex items-center justify-center">
            {activeThread.companionAvatar ? (
              <img
                src={activeThread.companionAvatar}
                alt={activeThread.companionName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-amber-400">
                {activeThread.companionName.charAt(0)}
              </span>
            )}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-charcoal',
              activeThread.companionAvailabilityStatus === 'ONLINE'
                ? 'bg-green-400'
                : activeThread.companionAvailabilityStatus === 'BUSY'
                ? 'bg-amber-400'
                : 'bg-gray-500'
            )}
          />
        </div>

        {/* Name + status */}
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{activeThread.companionName}</p>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                activeThread.companionAvailabilityStatus === 'ONLINE'
                  ? 'bg-green-400'
                  : activeThread.companionAvailabilityStatus === 'BUSY'
                  ? 'bg-amber-400'
                  : 'bg-gray-500'
              )}
            />
            <span className="text-xs text-white/50">
              {statusLabel(activeThread.companionAvailabilityStatus)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <a
            href={`/client/chat/${activeThread.companionId}`}
            className="p-2 text-white/60 hover:text-white transition-colors"
            title="Voice call"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </a>
          <Link
            href={`/client/booking/${activeThread.companionId}`}
            className="p-2 text-white/60 hover:text-white transition-colors"
            title="View profile"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Messages area (flex-1 so it fills remaining height) */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
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
                  <div
                    className={cn(
                      'flex flex-col',
                      isOwn ? 'items-end' : 'items-start',
                      sameGroupPrev ? 'mt-0.5' : 'mt-2'
                    )}
                  >
                    <div
                      className={cn(
                        'px-4 py-2 text-sm text-white break-words',
                        'max-w-[70%] rounded-2xl',
                        isOwn
                          ? 'bg-amber-500/20 border border-amber-500/30 rounded-tr-sm'
                          : 'bg-white/[0.08] border border-white/10 rounded-tl-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                    {showTime && (
                      <span
                        className={cn(
                          'text-xs text-white/30 mt-1',
                          isOwn ? 'self-end' : 'self-start'
                        )}
                      >
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

        {/* Scroll-to-bottom pill */}
        {showScrollPill && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-semibold shadow-lg whitespace-nowrap"
          >
            ↓ New message
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none overflow-hidden bg-white/5 border border-white/10 focus:border-amber-500/50 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              'w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-colors',
              input.trim() && !sending
                ? 'bg-amber-500 hover:bg-amber-400'
                : 'bg-white/10 cursor-not-allowed'
            )}
          >
            <svg
              className={cn('w-4 h-4', input.trim() && !sending ? 'text-black' : 'text-white/30')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  ) : (
    /* Empty state — no conversation selected (desktop only) */
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
    /*
     * -mx-4 -my-6: cancel the main's px-4 py-6 padding so inbox fills edge-to-edge.
     * Height: mobile = 100dvh minus header (~65px) minus bottom nav (~64px).
     *         desktop = 100dvh minus header only.
     */
    <div className="-mx-4 -my-6 flex overflow-hidden h-[calc(100dvh-129px)] md:h-[calc(100dvh-65px)]">
      {/* Left panel */}
      <div
        className={cn(
          'h-full md:w-80 md:shrink-0',
          showChat ? 'hidden md:block' : 'w-full block'
        )}
      >
        {ThreadListPanel}
      </div>

      {/* Right panel */}
      <div
        className={cn(
          'h-full flex-1 overflow-hidden',
          showChat ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        )}
      >
        {ChatPanel}
      </div>
    </div>
  );
}
