'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

// ─── Callback types ───────────────────────────────────────────────────────────

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
  requestId?: string;
  sessionId?: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  ratePerMinute?: number;
  expiresAt?: string;
}) => void;

type ChatRequestResponseCallback = (data: {
  requestId?: string;
  sessionId?: string;
  companionId?: string;
  clientId?: string;
  status: 'ACCEPTED' | 'DECLINED';
}) => void;

type ChatEndedCallback = (data: {
  sessionId: string;
  totalCharged: number;
  endedBy?: 'CLIENT' | 'COMPANION' | 'SYSTEM';
}) => void;

type BalanceLowCallback = (data: {
  sessionId: string;
  balance: number;
  minutesRemaining: number;
}) => void;

// Room message/typing — used for the active chat channel
export type RoomMessageCallback = (data: {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
}) => void;

export type RoomTypingCallback = (data: {
  userId: string;
  isTyping: boolean;
}) => void;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Single Ably connection for a user.
 *
 * Subscribes to:
 *   - private:user-{userId}  — session events (chat:request, chat:accepted, etc.)
 *   - chatRoomId             — chat room messages + typing (optional)
 *
 * Passing a different chatRoomId re-subscribes to the new room without
 * recreating the underlying Ably connection.
 */
export function useSocket(userId?: string, _role?: string, chatRoomId?: string) {
  const realtimeRef = useRef<Ably.Realtime | null>(null);
  const privateChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const roomChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ── Callback sets ────────────────────────────────────────────────────────
  const messageCBs = useRef<Set<MessageCallback>>(new Set());
  const typingCBs = useRef<Set<TypingCallback>>(new Set());
  const incomingCallCBs = useRef<Set<IncomingCallCallback>>(new Set());
  const incomingChatRequestCBs = useRef<Set<IncomingChatRequestCallback>>(new Set());
  const chatRequestResponseCBs = useRef<Set<ChatRequestResponseCallback>>(new Set());
  const chatEndedCBs = useRef<Set<ChatEndedCallback>>(new Set());
  const balanceLowCBs = useRef<Set<BalanceLowCallback>>(new Set());
  const roomMessageCBs = useRef<Set<RoomMessageCallback>>(new Set());
  const roomTypingCBs = useRef<Set<RoomTypingCallback>>(new Set());

  // ── Main connection + private channel ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const realtime = new Ably.Realtime({ authUrl: '/api/ably/token', clientId: userId });
    realtimeRef.current = realtime;

    realtime.connection.on('connected', () => setIsConnected(true));
    realtime.connection.on('disconnected', () => setIsConnected(false));
    realtime.connection.on('closed', () => setIsConnected(false));

    const ch = realtime.channels.get(`private:user-${userId}`);
    privateChannelRef.current = ch;

    ch.subscribe('message', (msg) => messageCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('typing', (msg) => typingCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('call:incoming', (msg) => incomingCallCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('chat:request', (msg) => incomingChatRequestCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('chat:accepted', (msg) => {
      const d = msg.data as Record<string, unknown>;
      chatRequestResponseCBs.current.forEach(cb => cb({
        requestId: d.requestId as string | undefined,
        sessionId: d.sessionId as string | undefined,
        companionId: d.companionId as string | undefined,
        clientId: d.clientId as string | undefined,
        status: 'ACCEPTED',
      }));
    });
    ch.subscribe('chat:declined', (msg) => {
      const d = msg.data as Record<string, unknown>;
      chatRequestResponseCBs.current.forEach(cb => cb({
        requestId: d.requestId as string | undefined,
        sessionId: d.sessionId as string | undefined,
        status: 'DECLINED',
      }));
    });
    ch.subscribe('chat:ended', (msg) => chatEndedCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('chat:balance_low', (msg) => balanceLowCBs.current.forEach(cb => cb(msg.data)));

    return () => {
      ch.unsubscribe();
      realtime.close();
      realtimeRef.current = null;
      privateChannelRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  // ── Chat room subscription (reuses same connection) ───────────────────────
  useEffect(() => {
    if (!chatRoomId || !isConnected || !realtimeRef.current) return;

    const ch = realtimeRef.current.channels.get(chatRoomId);
    roomChannelRef.current = ch;

    ch.subscribe('message', (msg) => roomMessageCBs.current.forEach(cb => cb(msg.data)));
    ch.subscribe('typing', (msg) => roomTypingCBs.current.forEach(cb => cb(msg.data)));

    return () => {
      ch.unsubscribe();
      roomChannelRef.current = null;
    };
  }, [chatRoomId, isConnected]);

  // ── Publish to room ───────────────────────────────────────────────────────
  const publishToRoom = useCallback(async (text: string): Promise<string | null> => {
    const ch = roomChannelRef.current;
    if (!ch || !userId) return null;
    const id = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await ch.publish('message', { id, text, senderId: userId, createdAt: new Date().toISOString() });
    return id;
  }, [userId]);

  const publishRoomTyping = useCallback((isTyping: boolean) => {
    if (!roomChannelRef.current || !userId) return;
    roomChannelRef.current.publish('typing', { userId, isTyping }).catch(() => {});
  }, [userId]);

  // ── Legacy: send typing to receiver's private channel ────────────────────
  const sendTyping = useCallback((data: { threadId: string; userId: string; receiverId: string }) => {
    if (!isConnected || !realtimeRef.current) return;
    realtimeRef.current.channels
      .get(`private:user-${data.receiverId}`)
      .publish('typing', { userId: data.userId });
  }, [isConnected]);

  // ── Callback registers ────────────────────────────────────────────────────
  const onMessage = useCallback((cb: MessageCallback) => {
    messageCBs.current.add(cb);
    return () => { messageCBs.current.delete(cb); };
  }, []);

  const onTyping = useCallback((cb: TypingCallback) => {
    typingCBs.current.add(cb);
    return () => { typingCBs.current.delete(cb); };
  }, []);

  const onIncomingCall = useCallback((cb: IncomingCallCallback) => {
    incomingCallCBs.current.add(cb);
    return () => { incomingCallCBs.current.delete(cb); };
  }, []);

  const onIncomingChatRequest = useCallback((cb: IncomingChatRequestCallback) => {
    incomingChatRequestCBs.current.add(cb);
    return () => { incomingChatRequestCBs.current.delete(cb); };
  }, []);

  const onChatRequestResponse = useCallback((cb: ChatRequestResponseCallback) => {
    chatRequestResponseCBs.current.add(cb);
    return () => { chatRequestResponseCBs.current.delete(cb); };
  }, []);

  const onChatEnded = useCallback((cb: ChatEndedCallback) => {
    chatEndedCBs.current.add(cb);
    return () => { chatEndedCBs.current.delete(cb); };
  }, []);

  const onBalanceLow = useCallback((cb: BalanceLowCallback) => {
    balanceLowCBs.current.add(cb);
    return () => { balanceLowCBs.current.delete(cb); };
  }, []);

  const onRoomMessage = useCallback((cb: RoomMessageCallback) => {
    roomMessageCBs.current.add(cb);
    return () => { roomMessageCBs.current.delete(cb); };
  }, []);

  const onRoomTyping = useCallback((cb: RoomTypingCallback) => {
    roomTypingCBs.current.add(cb);
    return () => { roomTypingCBs.current.delete(cb); };
  }, []);

  return {
    isConnected,
    onlineUsers: new Set<string>(),
    // Legacy
    sendMessage: useCallback((_data?: unknown) => { void _data; }, []),
    sendTyping,
    onMessage,
    onTyping,
    // Session events
    onIncomingCall,
    onIncomingChatRequest,
    onChatRequestResponse,
    onChatEnded,
    onBalanceLow,
    // Chat room
    publishToRoom,
    publishRoomTyping,
    onRoomMessage,
    onRoomTyping,
  };
}
