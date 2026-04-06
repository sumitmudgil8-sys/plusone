import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/messages/thread?companionUserId=&clientUserId=
// Returns full thread with messages. Marks received messages as read.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const companionUserId = searchParams.get('companionUserId');
  const clientUserId = searchParams.get('clientUserId');

  if (!companionUserId || !clientUserId) {
    return NextResponse.json(
      { success: false, error: 'companionUserId and clientUserId query params required' },
      { status: 400 }
    );
  }

  // Caller must be one of the participants
  if (user.id !== companionUserId && user.id !== clientUserId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const thread = await prisma.messageThread.findUnique({
      where: { clientId_companionId: { clientId: clientUserId, companionId: companionUserId } },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                clientProfile: { select: { name: true, avatarUrl: true } },
                companionProfile: { select: { name: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ success: true, data: { messages: [], threadId: null } });
    }

    // Mark unread messages from the other side as read
    await prisma.message.updateMany({
      where: {
        threadId: thread.id,
        receiverId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    const messages = thread.messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      senderName:
        msg.sender.clientProfile?.name ??
        msg.sender.companionProfile?.name ??
        'User',
      senderAvatar:
        msg.sender.clientProfile?.avatarUrl ??
        msg.sender.companionProfile?.avatarUrl ??
        null,
      createdAt: msg.createdAt.toISOString(),
      isRead: msg.isRead,
    }));

    return NextResponse.json({ success: true, data: { messages, threadId: thread.id } });
  } catch (error) {
    console.error('Thread fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch thread' }, { status: 500 });
  }
}
