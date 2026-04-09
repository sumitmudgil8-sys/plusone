'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { MessageBubble } from './MessageBubble';
import { MessageLockBanner } from './MessageLockBanner';
import { useSocket } from '@/hooks/useSocket';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
}

interface ChatWindowProps {
  companionId: string;
  companionName: string;
  companionAvatar?: string;
  currentUserId: string;
  currentUserRole: string;
  isClient: boolean;
}

export function ChatWindow({
  companionId,
  companionName,
  companionAvatar,
  currentUserId,
  currentUserRole,
  isClient,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [threadInfo, setThreadInfo] = useState({
    messageCount: 0,
    isLocked: false,
    limit: 8,
  });

  // Initialize socket
  const { isConnected, sendMessage, sendTyping, onMessage, onTyping } = useSocket(
    currentUserId,
    currentUserRole
  );

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${companionId}`);
      const data = await res.json();

      if (data.messages) {
        setMessages(data.messages);
        setThreadInfo({
          messageCount: data.messageCount,
          isLocked: data.isLocked,
          limit: data.limit,
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [companionId]);

  // Handle incoming messages via WebSocket
  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        content: data.content,
        senderId: data.senderId,
        senderName: isClient ? companionName : 'Client',
        createdAt: data.createdAt,
      }]);
      setIsTyping(false);
    });

    return unsubscribe;
  }, [onMessage, isClient, companionName]);

  // Handle typing indicators
  useEffect(() => {
    const unsubscribe = onTyping(() => {
      setIsTyping(true);
      // Clear typing after 3 seconds
      setTimeout(() => setIsTyping(false), 3000);
    });

    return unsubscribe;
  }, [onTyping]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          content: newMessage.trim(),
        }),
      });

      const data = await res.json();

      if (data.error === 'MESSAGE_LIMIT_REACHED') {
        setThreadInfo((prev) => ({ ...prev, isLocked: true }));
        return;
      }

      if (data.message) {
        // Send via WebSocket for real-time delivery
        sendMessage({
          threadId: data.threadId,
          senderId: currentUserId,
          receiverId: companionId,
          content: newMessage.trim(),
        });

        // Add to local state
        setMessages((prev) => [...prev, {
          id: data.message.id,
          content: newMessage.trim(),
          senderId: currentUserId,
          senderName: 'You',
          createdAt: new Date().toISOString(),
        }]);

        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Send typing indicator
    if (isConnected) {
      sendTyping({
        threadId: companionId,
        userId: currentUserId,
        receiverId: companionId,
      });
    }
  };

  // Determine if input should be disabled
  const isInputDisabled = isClient && threadInfo.isLocked;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-charcoal-border">
        {companionAvatar ? (
          <img
            src={companionAvatar}
            alt={companionName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-white font-medium">
            {companionName.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-medium text-white">{companionName}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/50">{isClient ? 'Message' : 'Client'}</p>
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Online
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                isOwn={message.senderId === currentUserId}
                senderName={message.senderName}
                senderAvatar={message.senderAvatar}
                timestamp={message.createdAt}
              />
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <span className="animate-pulse">{companionName} is typing</span>
                <span className="flex gap-1">
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Limit Banner (clients only) */}
      {isClient && (
        <MessageLockBanner
          messageCount={threadInfo.messageCount}
          limit={threadInfo.limit}
          isLocked={threadInfo.isLocked}
        />
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-charcoal-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder={
              isInputDisabled
                ? 'Upgrade to Premium to continue'
                : 'Type a message...'
            }
            disabled={isInputDisabled || sending}
            className="flex-1 bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isInputDisabled || sending || !newMessage.trim()}
            isLoading={sending}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
