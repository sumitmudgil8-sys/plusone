'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';

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

function AvailabilityDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'w-2 h-2 rounded-full shrink-0',
        status === 'ONLINE' ? 'bg-green-400' : status === 'BUSY' ? 'bg-amber-400' : 'bg-white/20'
      )}
    />
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeThread = threads.find((t) => t.threadId === activeThreadId) ?? null;

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
      } catch (error) {
        console.error('Inbox fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-charcoal-border">
      {/* Left panel — thread list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-charcoal-border bg-charcoal-surface overflow-hidden">
        <div className="p-4 border-b border-charcoal-border">
          <h2 className="font-semibold text-white text-base">Messages</h2>
        </div>

        {threads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <svg className="w-10 h-10 text-white/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-white/40 text-sm">No conversations yet</p>
            <Link href="/client/browse" className="text-xs text-gold hover:underline mt-2">
              Browse companions →
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => setActiveThreadId(thread.threadId)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-charcoal-border/50',
                  activeThreadId === thread.threadId
                    ? 'bg-gold/10 border-l-2 border-l-gold'
                    : 'hover:bg-white/5'
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-charcoal-border">
                    {thread.companionAvatar ? (
                      <img
                        src={thread.companionAvatar}
                        alt={thread.companionName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-medium text-white/40">
                        {thread.companionName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-charcoal-surface',
                      thread.companionAvailabilityStatus === 'ONLINE'
                        ? 'bg-green-400'
                        : thread.companionAvailabilityStatus === 'BUSY'
                        ? 'bg-amber-400'
                        : 'bg-white/20'
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-white truncate">{thread.companionName}</p>
                    {thread.lastMessage && (
                      <span className="text-xs text-white/30 shrink-0">
                        {formatTime(thread.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-white/40 truncate">
                      {thread.lastMessage
                        ? (thread.lastMessage.senderId === currentUser.id ? 'You: ' : '') +
                          thread.lastMessage.content
                        : 'No messages yet'}
                    </p>
                    {thread.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-gold text-black text-[10px] font-bold flex items-center justify-center shrink-0">
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

      {/* Right panel — active chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeThread ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-charcoal-border bg-charcoal-surface shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-charcoal-border">
                  {activeThread.companionAvatar ? (
                    <img
                      src={activeThread.companionAvatar}
                      alt={activeThread.companionName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-white/40">
                      {activeThread.companionName.charAt(0)}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-charcoal-surface',
                    activeThread.companionAvailabilityStatus === 'ONLINE'
                      ? 'bg-green-400'
                      : activeThread.companionAvailabilityStatus === 'BUSY'
                      ? 'bg-amber-400'
                      : 'bg-white/20'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{activeThread.companionName}</p>
                <p className="text-xs text-white/40 capitalize">
                  {activeThread.companionAvailabilityStatus.toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/client/chat/${activeThread.companionId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white border border-charcoal-border hover:border-white/30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call
                </a>
                <Link
                  href={`/client/booking/${activeThread.companionId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white border border-charcoal-border hover:border-white/30 transition-colors"
                >
                  View Profile
                </Link>
              </div>
            </div>

            {/* Chat window */}
            <div className="flex-1 overflow-hidden">
              <ChatWindow
                key={activeThread.companionId}
                companionId={activeThread.companionId}
                companionName={activeThread.companionName}
                companionAvatar={activeThread.companionAvatar ?? undefined}
                currentUserId={currentUser.id}
                currentUserRole={currentUser.role}
                isClient={currentUser.role === 'CLIENT'}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <svg className="w-14 h-14 text-white/10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-white/40">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
