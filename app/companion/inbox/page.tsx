'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';

export default function InboxPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    try {
      // Fetch all bookings to get client list
      const res = await fetch('/api/bookings');
      const data = await res.json();

      // Get unique clients
      const clientMap = new Map();
      data.bookings?.forEach((booking: any) => {
        if (!clientMap.has(booking.client.id)) {
          clientMap.set(booking.client.id, {
            clientId: booking.client.id,
            clientName: booking.client.clientProfile?.name || 'Unknown',
            clientAvatar: booking.client.clientProfile?.avatarUrl,
            lastMessage: null,
            unreadCount: 0,
          });
        }
      });

      setThreads(Array.from(clientMap.values()));
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

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
          (threads as any[]).map((thread) => (
            <Link key={thread.clientId} href={`/companion/inbox/${thread.clientId}`}>
              <Card className="flex items-center gap-4 hover:bg-white/5 transition-colors">
                {thread.clientAvatar ? (
                  <img
                    src={thread.clientAvatar}
                    alt={thread.clientName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-charcoal-border flex items-center justify-center text-white font-medium">
                    {thread.clientName.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-white">{thread.clientName}</p>
                  <p className="text-sm text-white/50">Click to open chat</p>
                </div>
                <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
