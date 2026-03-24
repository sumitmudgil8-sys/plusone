import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { MESSAGE_LIMIT } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/messages - Send a message
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    const body = await request.json();
    const { companionId, content } = body;

    if (!companionId || !content) {
      return NextResponse.json(
        { error: 'Companion ID and content are required' },
        { status: 400 }
      );
    }

    // Determine client and companion IDs based on role
    let clientId: string;
    let actualCompanionId: string;

    if (user.role === 'CLIENT') {
      clientId = user.id;
      actualCompanionId = companionId;
    } else {
      // If companion is sending, the companionId in body is actually the clientId
      clientId = companionId;
      actualCompanionId = user.id;
    }

    // Find or create message thread
    let thread = await prisma.messageThread.findUnique({
      where: {
        clientId_companionId: {
          clientId,
          companionId: actualCompanionId,
        },
      },
    });

    if (!thread) {
      thread = await prisma.messageThread.create({
        data: {
          clientId,
          companionId: actualCompanionId,
          messageCount: 0,
          isLocked: false,
        },
      });
    }

    // Check message limit for CLIENT sending messages
    if (user.role === 'CLIENT') {
      const clientUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });

      const isPremium = clientUser?.subscriptionTier === 'PREMIUM';

      if (!isPremium && thread.messageCount >= MESSAGE_LIMIT) {
        return NextResponse.json(
          {
            error: 'MESSAGE_LIMIT_REACHED',
            locked: true,
            message: `You've reached the limit of ${MESSAGE_LIMIT} messages. Upgrade to Premium to continue chatting.`,
          },
          { status: 403 }
        );
      }
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        receiverId: user.role === 'CLIENT' ? actualCompanionId : clientId,
        content,
      },
    });

    // Update thread
    const isClientSender = user.role === 'CLIENT';
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        messageCount: {
          increment: isClientSender ? 1 : 0,
        },
        isLocked: isClientSender && thread.messageCount + 1 >= MESSAGE_LIMIT,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
