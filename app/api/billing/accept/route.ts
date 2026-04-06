import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';

const schema = z.object({ sessionId: z.string().min(1) });

// POST /api/billing/accept
// Companion accepts a PENDING chat session.
// Activates the BillingSession and notifies both client and companion via Ably.
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
    // Idempotent — if already ACTIVE, return success
    if (session.status === 'ACTIVE') {
      return NextResponse.json({
        success: true,
        data: { sessionId, clientId: session.clientId },
      });
    }
    return NextResponse.json(
      { success: false, error: 'Session is no longer pending' },
      { status: 409 }
    );
  }

  const now = new Date();
  await prisma.billingSession.update({
    where: { id: sessionId },
    data: { status: 'ACTIVE', startedAt: now, lastTickAt: now },
  });

  // Notify client: session is active, redirect to inbox
  // Notify companion (self): confirmed, redirect to chat
  try {
    const ably = getAblyClient();
    await Promise.all([
      ably.channels.get(getUserChannelName(session.clientId)).publish('chat:accepted', {
        sessionId,
        companionId: auth.user.id,
      }),
      ably.channels.get(getUserChannelName(auth.user.id)).publish('chat:accepted', {
        sessionId,
        clientId: session.clientId,
      }),
    ]);
  } catch (err) {
    console.error('Ably publish error (non-fatal):', err);
  }

  return NextResponse.json({
    success: true,
    data: { sessionId, clientId: session.clientId },
  });
}
