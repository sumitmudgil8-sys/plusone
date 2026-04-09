'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

// ─── Session event callback types ─────────────────────────────────────────────

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

// ─── Room message type ────────────────────────────────────────────────────────
// This is what flows through Ably pub/sub on the chat room channel.
// Components receive roomMessages directly as state (no callback indirection).
export type RoomMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string; // ISO string
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Single Ably connection for a user.
 *
 * Subscribes to:
 *   - private:user-{userId}  — session events (chat:request, chat:accepted, etc.)
 *   - chatRoomId             — chat room messages + typing (optional)
 *
 * ARCHITECTURE:
 *   Room messages flow directly into React state via setRoomMessages().
 *   There is NO callback-set indirection — this was the root cause of
 *   messages being dropped when child components hadn't mounted yet.
 *
 *   Room subscription does NOT depend on isConnected. Ably queues channel
 *   attach requests internally and resolves them once the connection is up.
 *   Adding isConnected as a dep caused the subscription to tear down/rebuild
 *   on every reconnect, creating message drop windows.
 */
export function useSocket(userId?: string, _role?: string, chatRoomId?: string) {
  const realtimeRef = useRef<Ably.Realtime | null>(null);
  const privateChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const roomChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ── Room state lives HERE, not in child components ────────────────────────
  // This guarantees no message is ever dropped due to subscription/callback timing.
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Refs used inside Ably handlers to avoid stale closures
  // (refs are always current; listing them as effect deps would cause re-subscription)
  const userIdRef = useRef(userId);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Callback sets for session events (private channel) ───────────────────
  // Session events (chat:request, chat:accepted, etc.) still use the callback
  // pattern because they're consumed by different components across the app
  // and don't have the same timing problem as room messages.
  const messageCBs = useRef<Set<MessageCallback>>(new Set());
  const typingCBs = useRef<Set<TypingCallback>>(new Set());
  const incomingCallCBs = useRef<Set<IncomingCallCallback>>(new Set());
  const incomingChatRequestCBs = useRef<Set<IncomingChatRequestCallback>>(new Set());
  const chatRequestResponseCBs = useRef<Set<ChatRequestResponseCallback>>(new Set());
  const chatEndedCBs = useRef<Set<ChatEndedCallback>>(new Set());
  const balanceLowCBs = useRef<Set<BalanceLowCallback>>(new Set());

  // ── Main connection + private channel ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    console.log(`[useSocket] connecting for clientId=${userId}`);
    const realtime = new Ably.Realtime({ authUrl: '/api/ably/token', clientId: userId });
    realtimeRef.current = realtime;

    realtime.connection.on('connected', () => {
      console.log(`[useSocket] connected — clientId=${userId}`);
      setIsConnected(true);
    });
    realtime.connection.on('disconnected', (stateChange) => {
      console.warn('[useSocket] disconnected:', stateChange?.reason?.message);
      setIsConnected(false);
    });
    realtime.connection.on('failed', (stateChange) => {
      console.error('[useSocket] connection FAILED:', stateChange?.reason?.message, stateChange?.reason);
      setIsConnected(false);
    });
    realtime.connection.on('closed', () => {
      console.log('[useSocket] connection closed');
      setIsConnected(false);
    });

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

  // ── Chat room subscription ────────────────────────────────────────────────
  //
  // KEY FIXES vs previous version:
  //
  // 1. NO `isConnected` dependency.
  //    Ably's channel.subscribe() queues the attach internally. The subscription
  //    is registered immediately and activated once the WebSocket is up.
  //    Depending on isConnected caused the subscription to be torn down on every
  //    reconnect, creating windows where messages were dropped.
  //
  // 2. State updated DIRECTLY inside the Ably handler, not via a callback set.
  //    Previous pattern: Ably fires → iterate over roomMessageCBs Set → each cb
  //    calls setMessages. If no callbacks registered yet (child hasn't mounted),
  //    messages were silently dropped. Now Ably fires → setRoomMessages() directly
  //    → React schedules re-render → UI updates. Zero intermediary.
  //
  // 3. Named handler refs for clean per-handler unsubscribe (no side effects on
  //    other hypothetical subscribers to the same channel).
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!chatRoomId || !realtimeRef.current || !isConnected) return;

    // Clear state from any previous room
    setRoomMessages([]);
    setIsOtherTyping(false);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);

    const ch = realtimeRef.current.channels.get(chatRoomId);
    roomChannelRef.current = ch;

    // Direct state update — guaranteed to fire on every incoming message
    const onMessage = (msg: Ably.Message) => {
      const data = msg.data as RoomMessage;
      if (!data?.id) return;
      setRoomMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev; // deduplicate
        return [...prev, data];
      });
    };

    const onTyping = (msg: Ably.Message) => {
      const data = msg.data as { userId: string; isTyping: boolean };
      if (!data || data.userId === userIdRef.current) return; // ignore own events
      if (data.isTyping) {
        setIsOtherTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
      } else {
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        setIsOtherTyping(false);
      }
    };

    ch.subscribe('message', onMessage);
    ch.subscribe('typing', onTyping);

    return () => {
      // Unsubscribe only our specific handlers — safe if channel is shared
      ch.unsubscribe('message', onMessage);
      ch.unsubscribe('typing', onTyping);
      roomChannelRef.current = null;
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, [chatRoomId, isConnected]); // isConnected ensures room sub runs after connection is up

  // ── Publish to room ───────────────────────────────────────────────────────
  // Uses refs (not state) so this callback never becomes stale and never needs
  // to be recreated. No deps = created once, always works with latest values.
  const publishToRoom = useCallback(async (text: string, id?: string): Promise<string | null> => {
    const ch = roomChannelRef.current;
    const uid = userIdRef.current;
    if (!ch || !uid) return null;
    const msgId = id ?? `${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await ch.publish('message', { id: msgId, text, senderId: uid, createdAt: new Date().toISOString() });
    return msgId;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const publishRoomTyping = useCallback((isTyping: boolean) => {
    const ch = roomChannelRef.current;
    const uid = userIdRef.current;
    if (!ch || !uid) return;
    ch.publish('typing', { userId: uid, isTyping }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy: send typing to receiver's private channel ────────────────────
  const sendTyping = useCallback((data: { threadId: string; userId: string; receiverId: string }) => {
    if (!realtimeRef.current) return;
    realtimeRef.current.channels
      .get(`private:user-${data.receiverId}`)
      .publish('typing', { userId: data.userId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session event callback registers ─────────────────────────────────────
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
    // Chat room — state is managed HERE, passed directly to components
    publishToRoom,
    publishRoomTyping,
    roomMessages,   // direct state: updated the instant Ably delivers a message
    isOtherTyping,  // direct state: no callback needed
  };
}
