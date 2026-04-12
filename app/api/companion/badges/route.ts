import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/companion/badges
// Returns the companion's badges, ranking score, and progress metrics
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const [profile, badgeRecords] = await Promise.all([
    prisma.companionProfile.findUnique({
      where: { userId: auth.user.id },
      select: {
        rankingScore: true,
        averageRating: true,
        reviewCount: true,
        totalRatedSessions: true,
        avgResponseTime: true,
      },
    }),
    prisma.companionBadge.findMany({
      where: { companionId: auth.user.id },
      select: { type: true, isActive: true, earnedAt: true },
      orderBy: { earnedAt: 'desc' },
    }),
  ]);

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Companion profile not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      rankingScore: profile.rankingScore,
      badges: badgeRecords.map((b) => ({
        type: b.type,
        isActive: b.isActive,
        earnedAt: b.earnedAt,
      })),
      progress: {
        averageRating: profile.averageRating,
        reviewCount: profile.reviewCount,
        totalRatedSessions: profile.totalRatedSessions,
        avgResponseTime: profile.avgResponseTime,
      },
    },
  });
}
