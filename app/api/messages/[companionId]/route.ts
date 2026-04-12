import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/messages/[companionId] - Get messages for a thread
export async function GET(
  request: NextRequest,
  { params }: { params: { companionId: string } }
) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { companionId } = params;

  try {
    // Determine client and companion IDs
    let clientId: string;
    let actualCompanionId: string;

    if (user.role === 'CLIENT') {
      clientId = user.id;
      actualCompanionId = companionId;
    } else {
      clientId = companionId;
      actualCompanionId = user.id;
    }

    // Pagination: latest N messages (default 100)
    const { searchParams } = new URL(request.url);
    const take = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
    const cursor = searchParams.get('before'); // message ID cursor for older messages

    // Find the thread
    const thread = await prisma.messageThread.findUnique({
      where: {
        clientId_companionId: {
          clientId,
          companionId: actualCompanionId,
        },
      },
      include: {
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                clientProfile: { select: { name: true, avatarUrl: true } },
                companionProfile: { select: { name: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        },
      },
    });

    if (!thread) {
      // Return empty thread data — chat is per-minute billed, no free message limit
      return NextResponse.json({
        messages: [],
        messageCount: 0,
      });
    }

    // Messages fetched desc for pagination — reverse to chronological for client
    const messages = thread.messages.reverse();

    return NextResponse.json({
      messages: messages.map((msg: { id: string; content: string; senderId: string; createdAt: Date; sender: { clientProfile: { name: string | null; avatarUrl: string | null } | null; companionProfile: { name: string | null; avatarUrl: string | null } | null } }) => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        senderName:
          msg.sender.clientProfile?.name || msg.sender.companionProfile?.name,
        senderAvatar:
          msg.sender.clientProfile?.avatarUrl ||
          msg.sender.companionProfile?.avatarUrl,
        createdAt: msg.createdAt,
      })),
      messageCount: thread.messageCount,
      hasMore: thread.messages.length === take,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
