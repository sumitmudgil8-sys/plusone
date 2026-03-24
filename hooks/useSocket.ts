import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(userId?: string, role?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const socket = io({
      path: '/api/socket',
      addTrailingSlash: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      socket.emit('join', { userId, role });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, role]);

  const sendMessage = useCallback((data: {
    threadId: string;
    senderId: string;
    receiverId: string;
    content: string;
  }) => {
    socketRef.current?.emit('send_message', data);
  }, []);

  const sendTyping = useCallback((data: {
    threadId: string;
    userId: string;
    receiverId: string;
  }) => {
    socketRef.current?.emit('typing', data);
  }, []);

  const onMessage = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('receive_message', callback);
    return () => {
      socketRef.current?.off('receive_message', callback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('user_typing', callback);
    return () => {
      socketRef.current?.off('user_typing', callback);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    sendMessage,
    sendTyping,
    onMessage,
    onTyping,
  };
}
