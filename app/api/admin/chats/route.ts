import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/admin/chats — list all message threads (admin only)
// Optional ?threadId=xxx to fetch messages for a specific thread
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');

  try {
    // If threadId provided, return messages for that thread
    if (threadId) {
      const messages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          isRead: true,
        },
        take: 500,
      });

      return NextResponse.json({ success: true, data: { messages } });
    }

    // Otherwise return all threads
    const threads = await prisma.messageThread.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        client: {
          include: { clientProfile: { select: { name: true, avatarUrl: true } } },
        },
        companion: {
          include: { companionProfile: { select: { name: true, avatarUrl: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, senderId: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const data = threads.map(t => ({
      threadId: t.id,
      clientId: t.clientId,
      companionId: t.companionId,
      clientName: t.client.clientProfile?.name ?? t.client.email,
      clientAvatar: t.client.clientProfile?.avatarUrl ?? null,
      companionName: t.companion.companionProfile?.name ?? t.companion.email,
      companionAvatar: t.companion.companionProfile?.avatarUrl ?? null,
      messageCount: t._count.messages,
      lastMessage: t.messages[0] ?? null,
      updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: { threads: data } });
  } catch (error) {
    console.error('Admin chats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}
