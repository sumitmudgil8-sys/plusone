import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['ACCEPTED', 'DECLINED']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }

  const { action } = parsed.data;
  const { id } = params;

  const chatRequest = await prisma.chatRequest.findUnique({ where: { id } });

  if (!chatRequest) {
    return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
  }

  if (chatRequest.companionId !== auth.user.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  if (chatRequest.status !== 'PENDING') {
    return NextResponse.json({ success: false, error: 'Request is no longer pending' }, { status: 400 });
  }

  if (new Date() > chatRequest.expiresAt) {
    await prisma.chatRequest.update({ where: { id }, data: { status: 'EXPIRED' } });
    return NextResponse.json({ success: false, error: 'Request has expired' }, { status: 400 });
  }

  await prisma.chatRequest.update({ where: { id }, data: { status: action } });

  // Notify the client via Ably
  try {
    const ably = getAblyClient();
    const event = action === 'ACCEPTED' ? 'chat:accepted' : 'chat:declined';
    await ably.channels.get(getUserChannelName(chatRequest.clientId)).publish(event, {
      requestId: id,
      companionId: auth.user.id,
      status: action,
    });
  } catch (err) {
    console.error('Ably publish error (non-fatal):', err);
  }

  return NextResponse.json({ success: true });
}
