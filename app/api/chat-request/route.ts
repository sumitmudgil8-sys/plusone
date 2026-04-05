import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { sendPushToUser } from '@/lib/push';

export const runtime = 'nodejs';

const bodySchema = z.object({
  companionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const { companionId } = parsed.data;
  const clientId = auth.user.id;

  const companion = await prisma.user.findUnique({
    where: { id: companionId, role: 'COMPANION', isActive: true, isBanned: false },
    include: {
      companionProfile: { select: { chatRatePerMinute: true, name: true } },
    },
  });

  if (!companion?.companionProfile) {
    return NextResponse.json({ success: false, error: 'Companion not found' }, { status: 404 });
  }

  if (!companion.companionProfile.chatRatePerMinute) {
    return NextResponse.json({ success: false, error: 'Companion does not support chat' }, { status: 400 });
  }

  // Expire any existing pending requests from this client to this companion
  await prisma.chatRequest.updateMany({
    where: { clientId, companionId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: { name: true, avatarUrl: true },
  });

  const clientName = clientProfile?.name ?? 'A client';
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  const chatRequest = await prisma.chatRequest.create({
    data: { clientId, companionId, status: 'PENDING', expiresAt },
  });

  // Publish to companion's Ably channel
  try {
    const ably = getAblyClient();
    await ably.channels.get(getUserChannelName(companionId)).publish('chat:request', {
      requestId: chatRequest.id,
      clientId,
      clientName,
      clientAvatar: clientProfile?.avatarUrl ?? null,
    });
  } catch (err) {
    console.error('Ably publish error (non-fatal):', err);
  }

  // Push notification to companion (works even if app is closed)
  try {
    await sendPushToUser(companionId, {
      title: `Chat request from ${clientName}`,
      body: 'Tap to accept and start chatting',
      url: '/companion/dashboard',
    });
  } catch (err) {
    console.error('Push notification error (non-fatal):', err);
  }

  return NextResponse.json({ success: true, data: { requestId: chatRequest.id } });
}
