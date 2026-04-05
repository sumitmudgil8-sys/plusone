import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/messages/threads — list all conversation threads for the current user
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const isClient = user.role === 'CLIENT';

    const threads = await prisma.messageThread.findMany({
      where: isClient ? { clientId: user.id } : { companionId: user.id },
      include: {
        client: {
          select: {
            id: true,
            clientProfile: { select: { name: true, avatarUrl: true } },
          },
        },
        companion: {
          select: {
            id: true,
            isOnline: true,
            companionProfile: {
              select: {
                name: true,
                avatarUrl: true,
                availabilityStatus: true,
              },
            },
            companionImages: {
              where: { isPrimary: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = threads.map((t) => {
      const lastMessage = t.messages[0] ?? null;
      const companionName =
        t.companion.companionProfile?.name ?? 'Unknown';
      const companionAvatar =
        t.companion.companionImages[0]?.imageUrl ??
        t.companion.companionProfile?.avatarUrl ??
        null;
      const clientName = t.client.clientProfile?.name ?? 'Unknown';

      // For clients: unread = messages from companion not yet read
      // Simple approximation: if last message was from companion and !isRead → 1 unread
      const hasUnread =
        lastMessage &&
        lastMessage.senderId !== user.id &&
        !lastMessage.isRead;

      return {
        threadId: t.id,
        companionId: t.companion.id,
        clientId: t.client.id,
        companionName,
        companionAvatar,
        companionAvailabilityStatus:
          t.companion.companionProfile?.availabilityStatus ?? 'OFFLINE',
        clientName,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              isRead: lastMessage.isRead,
            }
          : null,
        unreadCount: hasUnread ? 1 : 0,
        updatedAt: t.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Threads fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch threads' }, { status: 500 });
  }
}
