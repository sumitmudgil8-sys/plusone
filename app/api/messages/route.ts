import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { MESSAGE_LIMIT } from '@/lib/constants';

export const runtime = 'nodejs';

const sendMessageSchema = z.object({
  companionId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

// POST /api/messages - Send a message
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { companionId, content } = parsed.data;

  // Determine client and companion IDs based on role
  let clientId: string;
  let actualCompanionId: string;

  if (user.role === 'CLIENT') {
    clientId = user.id;
    actualCompanionId = companionId;
  } else {
    // Companion sending: the passed companionId is actually the clientId
    clientId = companionId;
    actualCompanionId = user.id;
  }

  try {
    // Find or create message thread
    let thread = await prisma.messageThread.findUnique({
      where: {
        clientId_companionId: { clientId, companionId: actualCompanionId },
      },
    });

    if (!thread) {
      thread = await prisma.messageThread.create({
        data: { clientId, companionId: actualCompanionId, messageCount: 0, isLocked: false },
      });
    }

    // Check message limit for CLIENT senders
    if (user.role === 'CLIENT') {
      const clientUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });

      const isPremium = clientUser?.subscriptionTier === 'PREMIUM';

      if (!isPremium && thread.messageCount >= MESSAGE_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            error: 'MESSAGE_LIMIT_REACHED',
            locked: true,
            message: `You've reached the limit of ${MESSAGE_LIMIT} messages. Upgrade to Premium to continue chatting.`,
          },
          { status: 403 }
        );
      }
    }

    // Determine receiver
    const receiverId = user.role === 'CLIENT' ? actualCompanionId : clientId;

    // Save message to DB
    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        receiverId,
        content,
      },
      include: {
        sender: {
          select: {
            clientProfile: { select: { name: true, avatarUrl: true } },
            companionProfile: { select: { name: true, avatarUrl: true } },
          },
        },
      },
    });

    // Update thread count / lock status
    const isClientSender = user.role === 'CLIENT';
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        messageCount: { increment: isClientSender ? 1 : 0 },
        isLocked: isClientSender && thread.messageCount + 1 >= MESSAGE_LIMIT,
      },
    });

    // Publish to receiver's Ably channel (best-effort — don't fail the request)
    try {
      const ably = getAblyClient();
      const channel = ably.channels.get(getUserChannelName(receiverId));
      await channel.publish('message', {
        id: message.id,
        threadId: thread.id,
        senderId: user.id,
        senderName:
          message.sender.clientProfile?.name ??
          message.sender.companionProfile?.name ??
          'User',
        senderAvatar:
          message.sender.clientProfile?.avatarUrl ??
          message.sender.companionProfile?.avatarUrl ??
          null,
        content,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (ablyError) {
      console.error('Ably publish error (non-fatal):', ablyError);
    }

    return NextResponse.json(
      { success: true, data: { message: { ...message, threadId: thread.id } } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
