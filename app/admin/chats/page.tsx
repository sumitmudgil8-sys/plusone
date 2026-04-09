'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';

interface Thread {
  threadId: string;
  clientId: string;
  companionId: string;
  clientName: string;
  clientAvatar: string | null;
  companionName: string;
  companionAvatar: string | null;
  messageCount: number;
  lastMessage: { content: string; senderId: string; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  isRead: boolean;
}

export default function AdminChatsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/chats');
      const data = await res.json();
      if (data.success) setThreads(data.data.threads);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/chats?threadId=${thread.threadId}`);
      const data = await res.json();
      if (data.success) setMessages(data.data.messages);
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const filteredThreads = search
    ? threads.filter(t =>
        t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.companionName.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffMs < 604800000) return d.toLocaleDateString('en-IN', { weekday: 'short' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
        <h1 className="text-2xl font-bold text-white">Chat Monitor</h1>
        <p className="text-white/60">View conversations between clients and companions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '70vh' }}>
        {/* Thread list */}
        <div className="lg:col-span-1 space-y-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />

          <div className="space-y-1 max-h-[65vh] overflow-y-auto pr-1">
            {filteredThreads.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">No conversations found</p>
            ) : (
              filteredThreads.map(thread => (
                <button
                  key={thread.threadId}
                  onClick={() => openThread(thread)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                    selectedThread?.threadId === thread.threadId
                      ? 'bg-gold/10 border border-gold/30'
                      : 'bg-charcoal-surface border border-charcoal-border hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {thread.clientName}
                    </span>
                    <span className="text-xs text-white/30 shrink-0 ml-2">
                      {thread.lastMessage ? formatTime(thread.lastMessage.createdAt) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-white/40">with</span>
                    <span className="text-xs text-gold truncate">{thread.companionName}</span>
                  </div>
                  {thread.lastMessage && (
                    <p className="text-xs text-white/40 truncate">
                      {thread.lastMessage.content}
                    </p>
                  )}
                  <p className="text-xs text-white/20 mt-1">{thread.messageCount} messages</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message viewer */}
        <Card className="lg:col-span-2 flex flex-col">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/30 text-sm">Select a conversation to view messages</p>
            </div>
          ) : messagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-charcoal-border pb-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {selectedThread.clientName}
                      <span className="text-white/30 mx-2">↔</span>
                      {selectedThread.companionName}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{messages.length} messages</p>
                  </div>
                  <button
                    onClick={() => openThread(selectedThread)}
                    className="text-xs text-gold hover:text-gold/80 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[55vh] pr-1">
                {messages.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-8">No messages yet</p>
                ) : (
                  messages.map(msg => {
                    const isClient = msg.senderId === selectedThread.clientId;
                    const senderName = isClient ? selectedThread.clientName : selectedThread.companionName;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                          isClient
                            ? 'bg-white/5 border border-charcoal-border'
                            : 'bg-gold/10 border border-gold/20'
                        }`}>
                          <p className={`text-xs font-medium mb-0.5 ${isClient ? 'text-blue-400' : 'text-gold'}`}>
                            {senderName}
                          </p>
                          <p className="text-sm text-white/90 break-words whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs text-white/30 mt-1 text-right">
                            {new Date(msg.createdAt).toLocaleString('en-IN', {
                              hour: '2-digit', minute: '2-digit',
                              day: 'numeric', month: 'short',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
