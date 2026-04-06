import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';

const endSchema = z.object({
  sessionId: z.string().min(1),
});

// POST /api/billing/end
// Ends an active billing session. Either participant can end it.
// Publishes chat:ended to both client and companion via Ably.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  try {
    const session = await prisma.billingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Allow either participant to end the session
    if (session.clientId !== user.id && session.companionId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (session.status !== 'ACTIVE') {
      // Already ended — return current state (idempotent)
      return NextResponse.json({
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          totalMinutes: session.totalMinutes,
          totalCharged: session.totalCharged,
          endedAt: session.endedAt,
        },
      });
    }

    const ended = await prisma.billingSession.update({
      where: { id: sessionId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // Notify both participants that the session has ended
    try {
      const ably = getAblyClient();
      const payload = {
        sessionId: ended.id,
        totalCharged: ended.totalCharged,
        endedBy: user.role as 'CLIENT' | 'COMPANION',
      };
      await Promise.all([
        ably.channels.get(getUserChannelName(ended.clientId)).publish('chat:ended', payload),
        ably.channels.get(getUserChannelName(ended.companionId)).publish('chat:ended', payload),
      ]);
    } catch (ablyErr) {
      console.error('Ably publish error (non-fatal):', ablyErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: ended.id,
        status: ended.status,
        totalMinutes: ended.totalMinutes,
        totalCharged: ended.totalCharged,
        endedAt: ended.endedAt,
      },
    });
  } catch (error) {
    console.error('Billing end error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to end billing session' },
      { status: 500 }
    );
  }
}
