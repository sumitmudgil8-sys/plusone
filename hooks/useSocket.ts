'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
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
 *   The room subscription depends on BOTH chatRoomId AND isConnected.
 *   isConnected is needed so that if chatRoomId is set before the Ably
 *   connection completes, the subscription is retried once connected.
 *   A subscribedRoomRef prevents clearing messages on mere reconnections
 *   (only clears when switching to a DIFFERENT room).
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

  // Track which room we're currently subscribed to — survives effect cleanup so
  // we can distinguish "reconnect to same room" from "switch to different room".
  const subscribedRoomRef = useRef<string | null>(null);

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
    // Voice call declined — route through same callback set as chat:declined
    ch.subscribe('call:declined', (msg) => {
      const d = msg.data as Record<string, unknown>;
      chatRequestResponseCBs.current.forEach(cb => cb({
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
  // Depends on BOTH chatRoomId AND isConnected:
  //
  //   - chatRoomId: when the room changes, tear down old subscription and create new one
  //   - isConnected: when the connection comes up, retry subscription that failed due
  //     to the Ably instance not being ready yet
  //
  // subscribedRoomRef tracks which room we last subscribed to. This lets us
  // distinguish "reconnect to the same room" (don't clear messages) from
  // "switch to a different room" (clear messages).
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!chatRoomId || !realtimeRef.current) return;

    // Only clear messages when switching to a DIFFERENT room.
    // On reconnection to the same room, keep existing messages so the UI
    // doesn't flash empty. Historical messages from the brief disconnect
    // window will be loaded from DB by the component's history fetch.
    const isRoomChange = subscribedRoomRef.current !== chatRoomId;
    if (isRoomChange) {
      setRoomMessages([]);
      setIsOtherTyping(false);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    }

    subscribedRoomRef.current = chatRoomId;

    const ch = realtimeRef.current.channels.get(chatRoomId);
    roomChannelRef.current = ch;

    // Direct state update — forced synchronous via flushSync so React 18's
    // scheduler does not defer the render in background/inactive tabs.
    const onMessage = (msg: Ably.Message) => {
      const data = msg.data as RoomMessage;
      if (!data?.id) return;
      console.log('[useSocket] room message received:', data.id, 'sender:', data.senderId, 'channel:', chatRoomId);
      flushSync(() => {
        setRoomMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev; // deduplicate
          return [...prev, data];
        });
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

    // Monitor channel state for debugging — helps trace attachment failures
    const onStateChange = (stateChange: Ably.ChannelStateChange) => {
      console.log(`[useSocket] room channel ${chatRoomId}: ${stateChange.previous} → ${stateChange.current}`,
        stateChange.reason ? `reason: ${stateChange.reason.message}` : '');
      // If the channel enters a failed/suspended state, try to re-attach
      if (stateChange.current === 'suspended' || stateChange.current === 'failed') {
        console.warn(`[useSocket] room channel ${chatRoomId} entered ${stateChange.current}, attempting reattach`);
        ch.attach().catch((err: Error) => {
          console.error('[useSocket] reattach failed:', err.message);
        });
      }
    };
    ch.on(onStateChange);

    console.log('[useSocket] subscribed to room channel:', chatRoomId,
      isRoomChange ? '(new room)' : '(reconnect)',
      'connection state:', realtimeRef.current.connection.state);

    return () => {
      // Unsubscribe only our specific handlers — safe if channel is shared
      ch.unsubscribe('message', onMessage);
      ch.unsubscribe('typing', onTyping);
      ch.off(onStateChange);
      roomChannelRef.current = null;
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      // Don't clear subscribedRoomRef — needed to detect room changes vs reconnections
    };
  }, [chatRoomId, isConnected]); // isConnected ensures we retry when the connection comes up

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
