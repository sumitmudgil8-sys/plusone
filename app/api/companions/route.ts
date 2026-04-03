import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance, formatCurrency } from '@/lib/utils';
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

  try {
    const [clientProfile, wallet] = await Promise.all([
      prisma.clientProfile.findUnique({ where: { userId: user.id } }),
      prisma.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
    ]);

    const clientLat = clientProfile?.lat ?? 28.6139;
    const clientLng = clientProfile?.lng ?? 77.2090;
    const hasWalletBalance = (wallet?.balance ?? 0) > 0;

    // Show all active, non-banned companions.
    // isApproved is intentionally NOT required so newly created companions are visible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companionProfileFilter: any = {};

    if (minPrice || maxPrice) {
      companionProfileFilter.hourlyRate = {};
      if (minPrice) companionProfileFilter.hourlyRate.gte = parseFloat(minPrice);
      if (maxPrice) companionProfileFilter.hourlyRate.lte = parseFloat(maxPrice);
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
          hourlyRate: profile.hourlyRate,
          avatarUrl: profile.avatarUrl,
          primaryImageUrl,
          images: JSON.parse(profile.images || '[]'),
          isApproved: profile.isApproved,
          isVerified: profile.isVerified,
          averageRating: profile.averageRating,
          reviewCount: profile.reviewCount,
          lat: profile.lat,
          lng: profile.lng,
          availability: JSON.parse(profile.availability || '[]'),
          gender: profile.gender,
          age: profile.age,
          languages: JSON.parse(profile.languages || '[]'),
          interests: JSON.parse(profile.interests || '[]'),
          distance,
          isFavorited: companion.favorites.length > 0,
        };
      });

    if (sortBy === 'price') {
      companionsWithDistance.sort((a, b) => a.hourlyRate - b.hourlyRate);
    } else if (sortBy === 'rating') {
      companionsWithDistance.sort((a, b) => b.averageRating - a.averageRating);
    } else {
      companionsWithDistance.sort((a, b) => a.distance - b.distance);
    }

    // First MAX_FREE_COMPANIONS are always accessible.
    // Beyond that, requires wallet balance > 0.
    const result = companionsWithDistance.map((companion, index) => ({
      ...companion,
      accessible: index < MAX_FREE_COMPANIONS || hasWalletBalance,
      formattedPrice: formatCurrency(companion.hourlyRate),
    }));

    return NextResponse.json({ companions: result });
  } catch (error) {
    console.error('Error fetching companions:', error);
    return NextResponse.json({ error: 'Failed to fetch companions' }, { status: 500 });
  }
}
