import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';

const schema = z.object({ sessionId: z.string().min(1) });

// POST /api/billing/decline
// Companion declines a PENDING chat session.
// Marks the BillingSession as CANCELLED and notifies the client via Ably.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  const session = await prisma.billingSession.findUnique({ where: { id: sessionId } });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  if (session.companionId !== auth.user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  if (session.status !== 'PENDING') {
    return NextResponse.json(
      { success: false, error: 'Session is no longer pending' },
      { status: 409 }
    );
  }

  await prisma.billingSession.update({
    where: { id: sessionId },
    data: { status: 'DECLINED' },
  });

  try {
    const ably = getAblyClient();
    const eventName = session.type === 'VOICE' ? 'call:declined' : 'chat:declined';
    await ably.channels.get(getUserChannelName(session.clientId)).publish(eventName, {
      sessionId,
    });
  } catch (err) {
    console.error('Ably publish error (non-fatal):', err);
  }

  return NextResponse.json({ success: true });
}
