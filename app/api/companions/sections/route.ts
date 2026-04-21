import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance } from '@/lib/utils';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';
import { markStaleCompanionsOffline } from '@/lib/auto-offline';

export const runtime = 'nodejs';

// Shared select for companion card data — avoids over-fetching
const companionCardSelect = {
  id: true,
  companionProfile: {
    select: {
      name: true,
      bio: true,
      tagline: true,
      avatarUrl: true,
      hourlyRate: true,
      chatRatePerMinute: true,
      callRatePerMinute: true,
      isVerified: true,
      averageRating: true,
      reviewCount: true,
      rankingScore: true,
      availableNow: true,
      availabilityStatus: true,
      gender: true,
      age: true,
      city: true,
      lat: true,
      lng: true,
      personalityTags: true,
      interests: true,
      audioIntroUrl: true,
      lastSessionAt: true,
      badges: {
        where: { isActive: true },
        select: { type: true },
      },
    },
  },
  companionImages: {
    where: { isPrimary: true },
    take: 1,
    select: { imageUrl: true },
  },
} as const;

type CompanionRow = Awaited<ReturnType<typeof prisma.user.findMany<{ select: typeof companionCardSelect }>>>[0];

function mapCompanionCard(
  c: CompanionRow,
  clientLat: number,
  clientLng: number,
  isSubscribed: boolean,
  index: number,
  favoriteSet: Set<string>,
) {
  const p = c.companionProfile!;
  return {
    id: c.id,
    name: p.name,
    tagline: p.tagline,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    primaryImageUrl: c.companionImages[0]?.imageUrl ?? null,
    hourlyRatePaise: p.hourlyRate,
    chatRatePerMinute: p.chatRatePerMinute,
    callRatePerMinute: p.callRatePerMinute,
    isVerified: p.isVerified,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    rankingScore: p.rankingScore,
    availableNow: p.availableNow,
    availabilityStatus: p.availabilityStatus,
    gender: p.gender,
    age: p.age,
    city: p.city,
    personalityTags: JSON.parse(p.personalityTags || '[]'),
    interests: JSON.parse(p.interests || '[]'),
    audioIntroUrl: p.audioIntroUrl,
    badges: p.badges.map((b) => b.type),
    distance: calculateDistance(clientLat, clientLng, p.lat, p.lng),
    isFavorited: favoriteSet.has(c.id),
    accessible: isSubscribed || index < MAX_FREE_COMPANIONS,
  };
}

// GET /api/companions/sections
// Returns categorized companion sections for the homepage:
//   availableNow, recentlyActive, topRated, newCompanions
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { searchParams } = new URL(request.url);
  const userLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const userLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;

  try {
    // Lazy auto-offline: mark stale companions as unavailable (fire-and-forget)
    markStaleCompanionsOffline().catch(() => {});

    // Parallel lookups
    const [clientProfile, clientUser, favorites, rejectedIds] = await Promise.all([
      prisma.clientProfile.findUnique({
        where: { userId: user.id },
        select: { lat: true, lng: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true },
      }),
      prisma.favorite.findMany({
        where: { clientId: user.id },
        select: { companionId: true },
      }),
      prisma.clientVisibility.findMany({
        where: { clientId: user.id, status: 'REJECTED' },
        select: { companionId: true },
      }),
    ]);

    const clientLat = userLat ?? clientProfile?.lat ?? 28.6139;
    const clientLng = userLng ?? clientProfile?.lng ?? 77.2090;
    const now = new Date();
    const isSubscribed =
      clientUser?.subscriptionStatus === 'ACTIVE' &&
      (clientUser.subscriptionExpiresAt == null || clientUser.subscriptionExpiresAt > now);

    const favoriteSet = new Set(favorites.map((f) => f.companionId));
    const rejectedSet = new Set(rejectedIds.map((r) => r.companionId));

    const baseWhere = {
      role: 'COMPANION' as const,
      isActive: true,
      isBanned: false,
      companionProfile: { isApproved: true },
      companionImages: { some: { isPrimary: true } },
      id: rejectedSet.size > 0 ? { notIn: Array.from(rejectedSet) } : undefined,
    };

    // Fetch all five sections in parallel
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60_000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);

    const [availableNowRaw, recentlyActiveRaw, topRatedRaw, newCompanionsRaw, allCompanionsRaw] = await Promise.all([
      // Available Now — online, sorted by ranking
      prisma.user.findMany({
        where: {
          ...baseWhere,
          companionProfile: { ...baseWhere.companionProfile, availableNow: true },
        },
        select: companionCardSelect,
        orderBy: { companionProfile: { rankingScore: 'desc' } },
        take: 20,
      }),
      // Recently Active — had session in last 72h, not currently online
      prisma.user.findMany({
        where: {
          ...baseWhere,
          companionProfile: {
            ...baseWhere.companionProfile,
            availableNow: false,
            lastSessionAt: { gte: seventyTwoHoursAgo },
          },
        },
        select: companionCardSelect,
        orderBy: { companionProfile: { lastSessionAt: 'desc' } },
        take: 20,
      }),
      // Top Rated — highest quality, regardless of availability
      prisma.user.findMany({
        where: {
          ...baseWhere,
          companionProfile: { ...baseWhere.companionProfile, averageRating: { gte: 4.0 }, reviewCount: { gte: 3 } },
        },
        select: companionCardSelect,
        orderBy: { companionProfile: { averageRating: 'desc' } },
        take: 10,
      }),
      // New Companions — joined in last 30 days
      prisma.user.findMany({
        where: {
          ...baseWhere,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: companionCardSelect,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // All Companions — sorted by ranking, fallback section
      prisma.user.findMany({
        where: {
          ...baseWhere,
          companionProfile: { ...baseWhere.companionProfile, availableNow: false },
        },
        select: companionCardSelect,
        orderBy: { companionProfile: { rankingScore: 'desc' } },
        take: 20,
      }),
    ]);

    // Track global index for subscription gating across all sections
    let globalIndex = 0;
    const mapSection = (rows: CompanionRow[]) =>
      rows
        .filter((c) => c.companionProfile)
        .map((c) => {
          const card = mapCompanionCard(c, clientLat, clientLng, isSubscribed, globalIndex, favoriteSet);
          globalIndex++;
          return card;
        });

    const availableNow = mapSection(availableNowRaw);
    const recentlyActive = mapSection(recentlyActiveRaw);
    const topRated = isSubscribed ? mapSection(topRatedRaw) : [];
    const newCompanions = isSubscribed ? mapSection(newCompanionsRaw) : [];

    // Deduplicate allCompanions — exclude IDs already shown in other sections
    const shownIds = new Set([
      ...availableNow.map((c) => c.id),
      ...recentlyActive.map((c) => c.id),
      ...topRated.map((c) => c.id),
      ...newCompanions.map((c) => c.id),
    ]);
    const allCompanions = mapSection(
      allCompanionsRaw.filter((c) => !shownIds.has(c.id))
    );

    const response = NextResponse.json({
      success: true,
      data: {
        availableNow,
        recentlyActive,
        topRated,
        newCompanions,
        allCompanions,
      },
      isSubscribed,
    });
    // Allow CDN/browser to cache for 30s, serve stale for 60s while revalidating
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Sections fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch companion sections' },
      { status: 500 }
    );
  }
}
