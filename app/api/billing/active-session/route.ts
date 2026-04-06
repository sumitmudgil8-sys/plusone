import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/billing/active-session?companionId={id}
// Returns the client's active billing session with a specific companion, if any.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const companionId = searchParams.get('companionId');

  if (!companionId) {
    return NextResponse.json(
      { success: false, error: 'companionId is required' },
      { status: 400 }
    );
  }

  const session = await prisma.billingSession.findFirst({
    where: {
      clientId: auth.user.id,
      companionId,
      status: 'ACTIVE',
    },
  });

  if (!session) {
    return NextResponse.json({ success: true, data: { active: false } });
  }

  return NextResponse.json({
    success: true,
    data: {
      active: true,
      sessionId: session.id,
      ratePerMinute: session.ratePerMinute,
      totalCharged: session.totalCharged,
      startedAt: session.startedAt,
    },
  });
}
