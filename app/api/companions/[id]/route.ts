import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance } from '@/lib/utils';

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
    const [clientProfile, clientUser] = await Promise.all([
      prisma.clientProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true },
      }),
    ]);

    const clientLat = clientProfile?.lat ?? 28.6139;
    const clientLng = clientProfile?.lng ?? 77.2090;

    const now = new Date();
    const isSubscribed =
      clientUser?.subscriptionStatus === 'ACTIVE' &&
      (clientUser.subscriptionExpiresAt == null || clientUser.subscriptionExpiresAt > now);

    const companion = await prisma.user.findUnique({
      where: { id, role: 'COMPANION', isActive: true, isBanned: false },
      include: {
        companionProfile: true,
        companionImages: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        favorites: { where: { clientId: user.id } },
      },
    });

    if (!companion || !companion.companionProfile) {
      return NextResponse.json({ error: 'Companion not found' }, { status: 404 });
    }

    const profile = companion.companionProfile;
    const distance = calculateDistance(clientLat, clientLng, profile.lat, profile.lng);

    // Determine accessibility via subscription status
    let accessible = isSubscribed;
    if (!accessible) {
      // Also accessible if within free limit (by distance order)
      const { MAX_FREE_COMPANIONS } = await import('@/lib/constants');
      const allCompanions = await prisma.user.findMany({
        where: { role: 'COMPANION', isActive: true, isBanned: false },
        include: { companionProfile: { select: { lat: true, lng: true } } },
      });
      const sorted = allCompanions
        .filter((c) => c.companionProfile)
        .sort((a, b) => {
          const dA = calculateDistance(clientLat, clientLng, a.companionProfile!.lat, a.companionProfile!.lng);
          const dB = calculateDistance(clientLat, clientLng, b.companionProfile!.lat, b.companionProfile!.lng);
          return dA - dB;
        });
      const idx = sorted.findIndex((c) => c.id === id);
      accessible = idx === -1 || idx < MAX_FREE_COMPANIONS;
    }

    // Build image list: CompanionImages first (ordered by isPrimary), then legacy avatarUrl
    const images = companion.companionImages.length > 0
      ? companion.companionImages.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          isPrimary: img.isPrimary,
        }))
      : profile.avatarUrl
        ? [{ id: 'legacy', url: profile.avatarUrl, isPrimary: true }]
        : [];

    return NextResponse.json({
      companion: {
        id: companion.id,
        name: profile.name,
        bio: profile.bio,
        tagline: profile.tagline,
        hourlyRate: profile.hourlyRate,       // paise — legacy compat for BookingForm
        hourlyRatePaise: profile.hourlyRate,   // paise — explicit
        chatRatePerMinute: profile.chatRatePerMinute,
        callRatePerMinute: profile.callRatePerMinute,
        availabilityStatus: profile.availabilityStatus,
        avatarUrl: profile.avatarUrl,
        images,
        isApproved: profile.isApproved,
        isVerified: profile.isVerified,
        averageRating: profile.averageRating,
        reviewCount: profile.reviewCount,
        gender: profile.gender,
        age: profile.age,
        languages: JSON.parse(profile.languages || '[]'),
        interests: JSON.parse(profile.interests || '[]'),
        tags: JSON.parse(profile.tags || '[]'),
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
        availability: JSON.parse(profile.availability || '[]'),
        distance,
        isFavorited: companion.favorites.length > 0,
        accessible,
        formattedPrice: `₹${Math.round(profile.hourlyRate / 100).toLocaleString('en-IN')}/hr`,
      },
    });
  } catch (error) {
    console.error('Error fetching companion:', error);
    return NextResponse.json({ error: 'Failed to fetch companion' }, { status: 500 });
  }
}
