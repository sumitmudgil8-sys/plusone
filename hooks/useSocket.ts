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

type IncomingChatRequestCallback = (data: {
  requestId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
}) => void;

type ChatRequestResponseCallback = (data: {
  requestId: string;
  companionId: string;
  status: 'ACCEPTED' | 'DECLINED';
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
      const data = msg.data as Parameters<ChatRequestResponseCallback>[0];
      chatRequestResponseCallbacksRef.current.forEach((cb) => cb({ ...data, status: 'ACCEPTED' }));
    });

    channel.subscribe('chat:declined', (msg) => {
      const data = msg.data as Parameters<ChatRequestResponseCallback>[0];
      chatRequestResponseCallbacksRef.current.forEach((cb) => cb({ ...data, status: 'DECLINED' }));
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
  };
}
