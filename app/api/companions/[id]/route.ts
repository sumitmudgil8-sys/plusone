import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance, formatCurrency } from '@/lib/utils';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { id } = params;

  try {
    // Get client profile
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
    });

    const clientLat = clientProfile?.lat || 28.6139;
    const clientLng = clientProfile?.lng || 77.2090;

    // Get current user subscription
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });

    const isPremium = currentUser?.subscriptionTier === 'PREMIUM';

    // Get companion
    const companion = await prisma.user.findUnique({
      where: {
        id,
        role: 'COMPANION',
        isActive: true,
        isBanned: false,
      },
      include: {
        companionProfile: true,
        favorites: {
          where: { clientId: user.id },
        },
      },
    });

    if (!companion || !companion.companionProfile) {
      return NextResponse.json(
        { error: 'Companion not found' },
        { status: 404 }
      );
    }

    // Check position in list for accessibility
    const allCompanions = await prisma.user.findMany({
      where: {
        role: 'COMPANION',
        isActive: true,
        isBanned: false,
        companionProfile: { isApproved: true },
      },
      include: { companionProfile: true },
    });

    const sortedCompanions = allCompanions
      .filter((c) => c.companionProfile)
      .sort((a, b) => {
        const distA = calculateDistance(
          clientLat,
          clientLng,
          a.companionProfile!.lat,
          a.companionProfile!.lng
        );
        const distB = calculateDistance(
          clientLat,
          clientLng,
          b.companionProfile!.lat,
          b.companionProfile!.lng
        );
        return distA - distB;
      });

    const index = sortedCompanions.findIndex((c) => c.id === id);
    const accessible = isPremium || index < MAX_FREE_COMPANIONS || index === -1;

    const profile = companion.companionProfile;
    const distance = calculateDistance(
      clientLat,
      clientLng,
      profile.lat,
      profile.lng
    );

    return NextResponse.json({
      companion: {
        id: companion.id,
        name: profile.name,
        bio: profile.bio,
        hourlyRate: profile.hourlyRate,
        avatarUrl: profile.avatarUrl,
        images: JSON.parse(profile.images || '[]'),
        isApproved: profile.isApproved,
        lat: profile.lat,
        lng: profile.lng,
        availability: JSON.parse(profile.availability || '[]'),
        distance,
        isFavorited: companion.favorites.length > 0,
        accessible,
        formattedPrice: formatCurrency(profile.hourlyRate),
      },
    });
  } catch (error) {
    console.error('Error fetching companion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companion' },
      { status: 500 }
    );
  }
}
