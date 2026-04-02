import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const endSchema = z.object({
  sessionId: z.string().min(1),
});

// POST /api/billing/end
// Ends an active billing session. Called when the client closes the chat/call.
// No additional billing — last tick already covers up to 1 minute.
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
