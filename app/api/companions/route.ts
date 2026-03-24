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
  const sortBy = searchParams.get('sortBy') || 'distance'; // distance, price, rating

  try {
    // Get client profile for location
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
    });

    const clientLat = clientProfile?.lat || 28.6139;
    const clientLng = clientProfile?.lng || 77.2090;

    // Get current user with subscription
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });

    const isPremium = currentUser?.subscriptionTier === 'PREMIUM';

    // Build where clause
    const where: any = {
      role: 'COMPANION',
      isActive: true,
      isBanned: false,
      companionProfile: {
        isApproved: true,
      },
    };

    if (minPrice || maxPrice) {
      where.companionProfile.hourlyRate = {};
      if (minPrice) where.companionProfile.hourlyRate.gte = parseFloat(minPrice);
      if (maxPrice) where.companionProfile.hourlyRate.lte = parseFloat(maxPrice);
    }

    if (date) {
      where.companionProfile.availability = {
        contains: date,
      };
    }

    if (gender) {
      where.companionProfile.gender = gender;
    }

    if (minAge || maxAge) {
      where.companionProfile.age = {};
      if (minAge) where.companionProfile.age.gte = parseInt(minAge);
      if (maxAge) where.companionProfile.age.lte = parseInt(maxAge);
    }

    if (languages) {
      const langList = languages.split(',');
      where.companionProfile.languages = {
        contains: langList[0], // SQLite doesn't support array operations well
      };
    }

    if (interests) {
      const interestList = interests.split(',');
      where.companionProfile.interests = {
        contains: interestList[0], // SQLite doesn't support array operations well
      };
    }

    if (search) {
      where.OR = [
        { companionProfile: { name: { contains: search, mode: 'insensitive' } } },
        { companionProfile: { bio: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get companions with favorites for this client
    const companions = await prisma.user.findMany({
      where,
      include: {
        companionProfile: true,
        favorites: {
          where: { clientId: user.id },
        },
      },
    });

    // Calculate distance and add computed fields
    let companionsWithDistance: any[] = companions
      .filter((c) => c.companionProfile)
      .map((companion) => {
        const profile = companion.companionProfile!;
        const distance = calculateDistance(
          clientLat,
          clientLng,
          profile.lat,
          profile.lng
        );

        return {
          id: companion.id,
          name: profile.name,
          bio: profile.bio,
          hourlyRate: profile.hourlyRate,
          avatarUrl: profile.avatarUrl,
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

    // Sort based on sortBy parameter
    if (sortBy === 'price') {
      companionsWithDistance.sort((a, b) => a.hourlyRate - b.hourlyRate);
    } else if (sortBy === 'rating') {
      companionsWithDistance.sort((a, b) => b.averageRating - a.averageRating);
    } else {
      companionsWithDistance.sort((a, b) => a.distance - b.distance);
    }

    // Apply accessibility limits
    const companionsWithAccessibility = companionsWithDistance.map((companion: any, index: number) => ({
      ...companion,
      accessible: isPremium || index < MAX_FREE_COMPANIONS,
      formattedPrice: formatCurrency(companion.hourlyRate),
    }));

    return NextResponse.json({ companions: companionsWithAccessibility });
  } catch (error) {
    console.error('Error fetching companions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companions' },
      { status: 500 }
    );
  }
}
