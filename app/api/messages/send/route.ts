import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { sendPushToUser } from '@/lib/push';

export const runtime = 'nodejs';

const sendSchema = z.object({
  companionUserId: z.string().min(1),
  clientUserId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

// POST /api/messages/send — send a message using explicit client+companion IDs
// Caller must be either the client or the companion in the conversation.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { companionUserId, clientUserId, content } = parsed.data;

  // Verify caller is one of the participants
  if (user.id !== companionUserId && user.id !== clientUserId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Block check
    const block = await prisma.blockedUser.findUnique({
      where: { companionId_clientId: { companionId: companionUserId, clientId: clientUserId } },
    });
    if (block) {
      return NextResponse.json(
        { success: false, error: 'Unable to send messages' },
        { status: 403 }
      );
    }

    // Find or create thread
    let thread = await prisma.messageThread.findUnique({
      where: { clientId_companionId: { clientId: clientUserId, companionId: companionUserId } },
    });
    if (!thread) {
      thread = await prisma.messageThread.create({
        data: { clientId: clientUserId, companionId: companionUserId, messageCount: 0 },
      });
    }

    const receiverId = user.id === clientUserId ? companionUserId : clientUserId;

    const message = await prisma.message.create({
      data: { threadId: thread.id, senderId: user.id, receiverId, content },
      include: {
        sender: {
          select: {
            clientProfile: { select: { name: true, avatarUrl: true } },
            companionProfile: { select: { name: true, avatarUrl: true } },
          },
        },
      },
    });

    // Update thread timestamp (updatedAt auto-updates)
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { messageCount: user.id === clientUserId ? { increment: 1 } : undefined },
    });

    const senderName =
      message.sender.clientProfile?.name ??
      message.sender.companionProfile?.name ??
      'User';
    const senderAvatar =
      message.sender.clientProfile?.avatarUrl ??
      message.sender.companionProfile?.avatarUrl ??
      null;

    // Publish to receiver via Ably
    try {
      const ably = getAblyClient();
      await ably.channels.get(getUserChannelName(receiverId)).publish('message', {
        id: message.id,
        threadId: thread.id,
        senderId: user.id,
        senderName,
        senderAvatar,
        content,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('Ably publish error (non-fatal):', err);
    }

    // Push notification
    try {
      const inboxPath =
        user.role === 'CLIENT'
          ? `/companion/inbox/${clientUserId}`
          : `/client/inbox/${companionUserId}`;
      await sendPushToUser(receiverId, {
        title: `New message from ${senderName}`,
        body: content.slice(0, 100),
        url: inboxPath,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data: {
        id: message.id,
        threadId: thread.id,
        senderId: user.id,
        senderName,
        senderAvatar,
        content,
        createdAt: message.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}
