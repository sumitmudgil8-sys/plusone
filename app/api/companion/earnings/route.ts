import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/companion/earnings
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const now = new Date();

  // Start of today (midnight local, approximated in UTC)
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Start of this week (Monday)
  const weekStart = new Date(now);
  const day = weekStart.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const [all, today, week] = await Promise.all([
    prisma.billingSession.aggregate({
      where: { companionId: auth.user.id, status: 'ENDED' },
      _sum: { totalCharged: true },
      _count: { id: true },
    }),
    prisma.billingSession.aggregate({
      where: {
        companionId: auth.user.id,
        status: 'ENDED',
        endedAt: { gte: todayStart },
      },
      _sum: { totalCharged: true },
    }),
    prisma.billingSession.aggregate({
      where: {
        companionId: auth.user.id,
        status: 'ENDED',
        endedAt: { gte: weekStart },
      },
      _sum: { totalCharged: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      total: all._sum.totalCharged ?? 0,
      today: today._sum.totalCharged ?? 0,
      thisWeek: week._sum.totalCharged ?? 0,
      completedSessions: all._count.id,
    },
  });
}
