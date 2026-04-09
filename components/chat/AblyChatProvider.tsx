'use client';

import { useState, useEffect } from 'react';
import * as Ably from 'ably';
import { ChatClient } from '@ably/chat';
import { ChatClientProvider, ChatRoomProvider } from '@ably/chat/react';

interface AblyChatProviderProps {
  roomId: string;
  children: React.ReactNode;
}

/**
 * Provides Ably Chat context for a specific room.
 * Creates a dedicated Ably Realtime + ChatClient on mount, closes on unmount.
 * roomId must be stable — don't change it after mounting.
 */
export function AblyChatProvider({ roomId, children }: AblyChatProviderProps) {
  // Use lazy state initializer so clients are created once per mount
  const [{ realtime, chat }] = useState(() => {
    const realtime = new Ably.Realtime({ authUrl: '/api/ably/token' });
    const chat = new ChatClient(realtime);
    return { realtime, chat };
  });

  useEffect(() => {
    return () => {
      realtime.close();
    };
  }, [realtime]);

  return (
    <ChatClientProvider client={chat}>
      <ChatRoomProvider name={roomId}>
        {children}
      </ChatRoomProvider>
    </ChatClientProvider>
  );
}
