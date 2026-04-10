import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance } from '@/lib/utils';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { searchParams } = new URL(request.url);
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const date = searchParams.get('date');
  const gender = searchParams.get('gender');
  const minAge = searchParams.get('minAge');
  const maxAge = searchParams.get('maxAge');
  const languages = searchParams.get('languages');
  const interests = searchParams.get('interests');
  const search = searchParams.get('search');
  const sortBy = searchParams.get('sortBy') || 'distance';
  const userLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const userLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const radius = searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : 50;
  const availableDay = searchParams.get('availableDay');   // e.g. "mon"
  const availableSlot = searchParams.get('availableSlot'); // e.g. "EVENING"
  const availableNow = searchParams.get('availableNow');   // "true" to filter

  try {
    const [clientProfile, clientUser] = await Promise.all([
      prisma.clientProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true },
      }),
    ]);

    const clientLat = clientProfile?.lat ?? 28.6139;
    const clientLng = clientProfile?.lng ?? 77.2090;

    // Subscription check — ACTIVE and not yet expired
    const now = new Date();
    const isSubscribed =
      clientUser?.subscriptionStatus === 'ACTIVE' &&
      (clientUser.subscriptionExpiresAt == null || clientUser.subscriptionExpiresAt > now);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companionProfileFilter: any = {
      // Only approved profiles are visible in the public browse feed.
      // Un-approved profiles (pending admin review) must never leak here.
      isApproved: true,
    };

    if (minPrice || maxPrice) {
      companionProfileFilter.hourlyRate = {};
      if (minPrice) companionProfileFilter.hourlyRate.gte = parseInt(minPrice);
      if (maxPrice) companionProfileFilter.hourlyRate.lte = parseInt(maxPrice);
    }
    if (date) companionProfileFilter.availability = { contains: date };
    if (gender) companionProfileFilter.gender = gender;
    if (minAge || maxAge) {
      companionProfileFilter.age = {};
      if (minAge) companionProfileFilter.age.gte = parseInt(minAge);
      if (maxAge) companionProfileFilter.age.lte = parseInt(maxAge);
    }
    if (languages) companionProfileFilter.languages = { contains: languages.split(',')[0] };
    if (interests) companionProfileFilter.interests = { contains: interests.split(',')[0] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      role: 'COMPANION',
      isActive: true,
      isBanned: false,
      companionProfile: companionProfileFilter,
    };

    if (search) {
      whereClause.OR = [
        { companionProfile: { name: { contains: search, mode: 'insensitive' } } },
        { companionProfile: { bio: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const companions = await prisma.user.findMany({
      where: whereClause,
      include: {
        companionProfile: true,
        companionImages: {
          where: { isPrimary: true },
          take: 1,
        },
        favorites: {
          where: { clientId: user.id },
        },
      },
    });

    let companionsWithDistance = companions
      .filter((c) => c.companionProfile)
      .map((companion) => {
        const profile = companion.companionProfile!;
        const distance = calculateDistance(clientLat, clientLng, profile.lat, profile.lng);
        const primaryImageUrl = companion.companionImages[0]?.imageUrl ?? null;

        return {
          id: companion.id,
          name: profile.name,
          bio: profile.bio,
          tagline: profile.tagline,
          // Pricing — all in paise
          hourlyRatePaise: profile.hourlyRate,
          chatRatePerMinute: profile.chatRatePerMinute,
          callRatePerMinute: profile.callRatePerMinute,
          // Images
          avatarUrl: profile.avatarUrl,
          primaryImageUrl,
          images: JSON.parse(profile.images || '[]'),
          // Meta
          isApproved: profile.isApproved,
          isVerified: profile.isVerified,
          averageRating: profile.averageRating,
          reviewCount: profile.reviewCount,
          lat: profile.lat,
          lng: profile.lng,
          availability: JSON.parse(profile.availability || '[]'),
          availabilityStatus: profile.availabilityStatus,
          gender: profile.gender,
          age: profile.age,
          city: profile.city,
          languages: JSON.parse(profile.languages || '[]'),
          interests: JSON.parse(profile.interests || '[]'),
          tags: JSON.parse(profile.tags || '[]'),
          personalityTags: JSON.parse(profile.personalityTags || '[]'),
          weeklyAvailability: JSON.parse(profile.weeklyAvailability || '{}'),
          availableNow: profile.availableNow,
          distance,
          isFavorited: companion.favorites.length > 0,
        };
      });

    // If user provided real-time coordinates, compute distance from those and filter by radius
    if (userLat !== null && userLng !== null) {
      companionsWithDistance = companionsWithDistance
        .map((c) => ({
          ...c,
          distance: calculateDistance(userLat, userLng!, c.lat, c.lng),
        }))
        .filter((c) => c.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'price') {
      companionsWithDistance.sort((a, b) => a.hourlyRatePaise - b.hourlyRatePaise);
    } else if (sortBy === 'rating') {
      companionsWithDistance.sort((a, b) => b.averageRating - a.averageRating);
    } else {
      companionsWithDistance.sort((a, b) => a.distance - b.distance);
    }

    // Filter by availability if requested
    if (availableNow === 'true') {
      companionsWithDistance = companionsWithDistance.filter((c) => c.availableNow);
    }
    if (availableDay) {
      companionsWithDistance = companionsWithDistance.filter((c) => {
        const schedule = c.weeklyAvailability as Record<string, string[]>;
        const daySlots = schedule[availableDay];
        if (!daySlots || daySlots.length === 0) return false;
        if (availableSlot) return daySlots.includes(availableSlot);
        return true;
      });
    }

    // Free tier: first MAX_FREE_COMPANIONS accessible; rest are visible but locked.
    // Subscribed clients: all accessible.
    const result = companionsWithDistance.map((companion, index) => ({
      ...companion,
      accessible: isSubscribed || index < MAX_FREE_COMPANIONS,
    }));

    return NextResponse.json({
      companions: result,
      isSubscribed,
      total: result.length,
    });
  } catch (error) {
    console.error('Error fetching companions:', error);
    return NextResponse.json({ error: 'Failed to fetch companions' }, { status: 500 });
  }
}
