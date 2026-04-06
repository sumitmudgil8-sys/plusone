import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/companion/active-session
// Returns the currently active billing session for this companion, if any.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const session = await prisma.billingSession.findFirst({
    where: { companionId: auth.user.id, status: 'ACTIVE' },
    include: {
      client: {
        include: { clientProfile: { select: { name: true } } },
      },
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
      type: session.type,
      totalCharged: session.totalCharged,
      totalMinutes: session.totalMinutes,
      ratePerMinute: session.ratePerMinute,
      clientName: session.client.clientProfile?.name ?? 'Client',
      clientId: session.clientId,
      startedAt: session.startedAt,
    },
  });
}
