import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/client/recently-viewed
// Returns the 6 most recently viewed companion profiles.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    // Get the most recent distinct view per companion (ordered by viewedAt DESC)
    const views = await prisma.companionProfileView.findMany({
      where: { clientId: user.id },
      orderBy: { viewedAt: 'desc' },
      distinct: ['companionId'],
      take: 6,
      include: {
        companion: {
          select: {
            id: true,
            companionProfile: {
              select: {
                name: true,
                avatarUrl: true,
                chatRatePerMinute: true,
                callRatePerMinute: true,
                hourlyRate: true,
              },
            },
            companionImages: {
              where: { isPrimary: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
        },
      },
    });

    const result = views
      .filter((v) => v.companion.companionProfile)
      .map((v) => ({
        companionId: v.companionId,
        name: v.companion.companionProfile!.name,
        primaryImage:
          v.companion.companionImages[0]?.imageUrl ??
          v.companion.companionProfile!.avatarUrl ??
          null,
        chatRatePerMinute: v.companion.companionProfile!.chatRatePerMinute,
        callRatePerMinute: v.companion.companionProfile!.callRatePerMinute,
        hourlyRatePaise: v.companion.companionProfile!.hourlyRate,
        viewedAt: v.viewedAt,
      }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Recently viewed error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch recently viewed' }, { status: 500 });
  }
}
