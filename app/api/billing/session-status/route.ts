import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/billing/session-status?companionId=<User.id>
// CLIENT: pass companionId — returns PENDING or ACTIVE session with that companion
// COMPANION: pass clientId — returns PENDING or ACTIVE session with that client
// Also auto-expires stale PENDING sessions past their expiresAt.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { searchParams } = new URL(request.url);

  let clientId: string;
  let companionId: string;

  if (user.role === 'CLIENT') {
    const qCompanionId = searchParams.get('companionId');
    if (!qCompanionId) {
      return NextResponse.json(
        { success: false, error: 'companionId query param required' },
        { status: 400 }
      );
    }
    clientId = user.id;
    companionId = qCompanionId;
  } else {
    const qClientId = searchParams.get('clientId');
    if (!qClientId) {
      return NextResponse.json(
        { success: false, error: 'clientId query param required' },
        { status: 400 }
      );
    }
    clientId = qClientId;
    companionId = user.id;
  }

  const session = await prisma.billingSession.findFirst({
    where: {
      clientId,
      companionId,
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    return NextResponse.json({ success: true, data: { status: 'NONE' } });
  }

  // Auto-expire stale PENDING sessions
  if (session.status === 'PENDING' && session.expiresAt && session.expiresAt < new Date()) {
    await prisma.billingSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ success: true, data: { status: 'EXPIRED', sessionId: session.id } });
  }

  return NextResponse.json({
    success: true,
    data: {
      status: session.status,
      type: session.type,
      sessionId: session.id,
      ratePerMinute: session.ratePerMinute,
      totalCharged: session.totalCharged,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt?.toISOString() ?? null,
      clientId,
      companionId,
    },
  });
}
