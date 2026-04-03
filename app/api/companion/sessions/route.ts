import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/companion/sessions — paginated session history
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

  const sessions = await prisma.billingSession.findMany({
    where: { companionId: auth.user.id, status: 'ENDED' },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: {
      client: {
        select: {
          clientProfile: { select: { name: true, avatarUrl: true } },
        },
      },
    },
  });

  const data = sessions.map((s) => ({
    id: s.id,
    type: s.type,
    clientName: s.client.clientProfile?.name ?? 'Client',
    clientAvatar: s.client.clientProfile?.avatarUrl ?? null,
    durationMinutes: Math.round(s.totalMinutes),
    earned: s.totalCharged,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
  }));

  return NextResponse.json({ success: true, data: { sessions: data } });
}
