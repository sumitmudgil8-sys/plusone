'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

type MessageCallback = (data: {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  createdAt: string;
}) => void;

type TypingCallback = (data: { userId: string }) => void;

type IncomingCallCallback = (data: {
  sessionId: string;
  clientId: string;
  callerName: string;
  callerAvatar: string | null;
  channelName: string;
  ratePerMinute: number;
}) => void;

// Used by companions — payload from both old ChatRequest flow and new BillingSession flow
type IncomingChatRequestCallback = (data: {
  requestId?: string;    // old ChatRequest flow
  sessionId?: string;    // new BillingSession flow
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  ratePerMinute?: number;
  expiresAt?: string;    // ISO timestamp for countdown
}) => void;

type BalanceLowCallback = (data: {
  sessionId: string;
  balance: number;
  minutesRemaining: number;
}) => void;

// Used by clients (chat:accepted / chat:declined) and companions (chat:accepted from billing/accept)
type ChatRequestResponseCallback = (data: {
  requestId?: string;
  sessionId?: string;
  companionId?: string;  // present on client-side accepted event
  clientId?: string;     // present on companion-side accepted event
  status: 'ACCEPTED' | 'DECLINED';
}) => void;

type ChatEndedCallback = (data: {
  sessionId: string;
  totalCharged: number;
  endedBy?: 'CLIENT' | 'COMPANION' | 'SYSTEM';
}) => void;

export function useSocket(userId?: string, _role?: string) {
  const realtimeRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const messageCallbacksRef = useRef<Set<MessageCallback>>(new Set());
  const typingCallbacksRef = useRef<Set<TypingCallback>>(new Set());
  const incomingCallCallbacksRef = useRef<Set<IncomingCallCallback>>(new Set());
  const incomingChatRequestCallbacksRef = useRef<Set<IncomingChatRequestCallback>>(new Set());
  const chatRequestResponseCallbacksRef = useRef<Set<ChatRequestResponseCallback>>(new Set());
  const chatEndedCallbacksRef = useRef<Set<ChatEndedCallback>>(new Set());
  const balanceLowCallbacksRef = useRef<Set<BalanceLowCallback>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const realtime = new Ably.Realtime({
      authUrl: '/api/ably/token',
      clientId: userId,
    });

    realtimeRef.current = realtime;

    realtime.connection.on('connected', () => setIsConnected(true));
    realtime.connection.on('disconnected', () => setIsConnected(false));
    realtime.connection.on('closed', () => setIsConnected(false));

    const channel = realtime.channels.get(`private:user-${userId}`);
    channelRef.current = channel;

    channel.subscribe('message', (msg) => {
      const data = msg.data as MessageCallback extends (d: infer D) => void ? D : never;
      messageCallbacksRef.current.forEach((cb) => cb(data));
    });

    channel.subscribe('typing', (msg) => {
      const data = msg.data as { userId: string };
      typingCallbacksRef.current.forEach((cb) => cb(data));
    });

    channel.subscribe('call:incoming', (msg) => {
      const data = msg.data as Parameters<IncomingCallCallback>[0];
      incomingCallCallbacksRef.current.forEach((cb) => cb(data));
    });

    channel.subscribe('chat:request', (msg) => {
      const data = msg.data as Parameters<IncomingChatRequestCallback>[0];
      incomingChatRequestCallbacksRef.current.forEach((cb) => cb(data));
    });

    channel.subscribe('chat:accepted', (msg) => {
      const data = msg.data as Record<string, unknown>;
      chatRequestResponseCallbacksRef.current.forEach((cb) =>
        cb({
          requestId: data.requestId as string | undefined,
          sessionId: data.sessionId as string | undefined,
          companionId: data.companionId as string | undefined,
          clientId: data.clientId as string | undefined,
          status: 'ACCEPTED',
        })
      );
    });

    channel.subscribe('chat:declined', (msg) => {
      const data = msg.data as Record<string, unknown>;
      chatRequestResponseCallbacksRef.current.forEach((cb) =>
        cb({
          requestId: data.requestId as string | undefined,
          sessionId: data.sessionId as string | undefined,
          status: 'DECLINED',
        })
      );
    });

    channel.subscribe('chat:ended', (msg) => {
      const data = msg.data as { sessionId: string; totalCharged: number; endedBy?: 'CLIENT' | 'COMPANION' | 'SYSTEM' };
      chatEndedCallbacksRef.current.forEach((cb) => cb(data));
    });

    channel.subscribe('chat:balance_low', (msg) => {
      const data = msg.data as { sessionId: string; balance: number; minutesRemaining: number };
      balanceLowCallbacksRef.current.forEach((cb) => cb(data));
    });

    return () => {
      channel.unsubscribe();
      realtime.close();
      realtimeRef.current = null;
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  // No-op: server publishes to receiver after HTTP POST
  const sendMessage = useCallback(
    (_data: { threadId: string; senderId: string; receiverId: string; content: string }) => {
      // Delivery handled server-side via Ably publish in POST /api/messages
    },
    []
  );

  const sendTyping = useCallback(
    (data: { threadId: string; userId: string; receiverId: string }) => {
      if (!isConnected) return;
      const receiverChannel = realtimeRef.current?.channels.get(
        `private:user-${data.receiverId}`
      );
      receiverChannel?.publish('typing', { userId: data.userId });
    },
    [isConnected]
  );

  const onMessage = useCallback((callback: MessageCallback) => {
    messageCallbacksRef.current.add(callback);
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  const onTyping = useCallback((callback: TypingCallback) => {
    typingCallbacksRef.current.add(callback);
    return () => {
      typingCallbacksRef.current.delete(callback);
    };
  }, []);

  const onIncomingCall = useCallback((callback: IncomingCallCallback) => {
    incomingCallCallbacksRef.current.add(callback);
    return () => {
      incomingCallCallbacksRef.current.delete(callback);
    };
  }, []);

  const onIncomingChatRequest = useCallback((callback: IncomingChatRequestCallback) => {
    incomingChatRequestCallbacksRef.current.add(callback);
    return () => {
      incomingChatRequestCallbacksRef.current.delete(callback);
    };
  }, []);

  const onChatRequestResponse = useCallback((callback: ChatRequestResponseCallback) => {
    chatRequestResponseCallbacksRef.current.add(callback);
    return () => {
      chatRequestResponseCallbacksRef.current.delete(callback);
    };
  }, []);

  const onChatEnded = useCallback((callback: ChatEndedCallback) => {
    chatEndedCallbacksRef.current.add(callback);
    return () => {
      chatEndedCallbacksRef.current.delete(callback);
    };
  }, []);

  const onBalanceLow = useCallback((callback: BalanceLowCallback) => {
    balanceLowCallbacksRef.current.add(callback);
    return () => {
      balanceLowCallbacksRef.current.delete(callback);
    };
  }, []);

  return {
    socket: realtimeRef.current,
    isConnected,
    onlineUsers: new Set<string>(),
    sendMessage,
    sendTyping,
    onMessage,
    onTyping,
    onIncomingCall,
    onIncomingChatRequest,
    onChatRequestResponse,
    onChatEnded,
    onBalanceLow,
  };
}
