'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

interface ThreadRow {
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

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CompanionInboxPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, threadsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/messages/threads'),
        ]);

        if (userRes.ok) {
          const d = await userRes.json();
          setCurrentUserId(d.user.id ?? '');
        }

        if (threadsRes.ok) {
          const d = await threadsRes.json();
          const list = (d.data ?? []) as Array<{
            threadId: string;
            clientId: string;
            clientName: string;
            companionId: string;
            companionName: string;
            companionAvatar: string | null;
            lastMessage: ThreadRow['lastMessage'];
            unreadCount: number;
            updatedAt: string;
          }>;

          // The threads API returns companion-centric rows for COMPANION role.
          setThreads(
            list.map((t) => ({
              threadId: t.threadId,
              clientId: t.clientId,
              clientName: t.clientName,
              clientAvatar: null,
              lastMessage: t.lastMessage,
              unreadCount: t.unreadCount,
              updatedAt: t.updatedAt,
            }))
          );
        }
      } catch (err) {
        console.error('Companion inbox load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        <p className="text-white/60">Messages from your clients</p>
      </div>

      <div className="space-y-2">
        {threads.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-white/60">No messages yet</p>
            <p className="text-sm text-white/40 mt-1">
              Messages will appear here once clients contact you
            </p>
          </Card>
        ) : (
          threads.map((thread) => (
            <Link key={thread.threadId} href={`/companion/inbox/${thread.clientId}`}>
              <Card className="flex items-center gap-4 hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-charcoal-border flex items-center justify-center text-white font-medium overflow-hidden">
                    {thread.clientAvatar ? (
                      <img src={thread.clientAvatar} alt={thread.clientName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{thread.clientName.charAt(0)}</span>
                    )}
                  </div>
                  {thread.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold text-black text-xs font-bold flex items-center justify-center">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-white truncate">{thread.clientName}</p>
                    {thread.lastMessage && (
                      <span className="text-xs text-white/40 shrink-0">
                        {relTime(thread.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50 truncate mt-0.5">
                    {thread.lastMessage
                      ? (thread.lastMessage.senderId === currentUserId ? 'You: ' : '') +
                        thread.lastMessage.content
                      : 'No messages yet'}
                  </p>
                </div>

                <svg className="w-5 h-5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
