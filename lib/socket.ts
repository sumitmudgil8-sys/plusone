import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';

export type SocketUser = {
  userId: string;
  socketId: string;
  role: string;
};

export const connectedUsers = new Map<string, SocketUser>();

export function initSocket(server: NetServer) {
  const io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', ({ userId, role }: { userId: string; role: string }) => {
      connectedUsers.set(userId, { userId, socketId: socket.id, role });
      socket.join(userId);
      console.log(`User ${userId} joined with socket ${socket.id}`);
    });

    socket.on('send_message', (data: {
      threadId: string;
      senderId: string;
      receiverId: string;
      content: string;
    }) => {
      const { threadId, senderId, receiverId, content } = data;

      // Send to receiver if online
      io.to(receiverId).emit('receive_message', {
        threadId,
        senderId,
        content,
        createdAt: new Date().toISOString(),
      });

      // Confirm to sender
      socket.emit('message_sent', { threadId });
    });

    socket.on('typing', ({ threadId, userId, receiverId }: {
      threadId: string;
      userId: string;
      receiverId: string;
    }) => {
      io.to(receiverId).emit('user_typing', { threadId, userId });
    });

    socket.on('disconnect', () => {
      for (const [userId, user] of Array.from(connectedUsers.entries())) {
        if (user.socketId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  const user = connectedUsers.get(userId);
  if (user) {
    // Use io to emit if available
    // This is a placeholder - in production, store io instance globally
  }
}

export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId);
}
