import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';
import { calculateDistance } from '@/lib/utils';

export const runtime = 'nodejs';

// GET /api/bookings - Get bookings for current user
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    let bookings;

    if (user.role === 'CLIENT') {
      bookings = await prisma.booking.findMany({
        where: { clientId: user.id },
        include: {
          companion: {
            include: { companionProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      bookings = await prisma.booking.findMany({
        where: { companionId: user.id },
        include: {
          client: {
            include: { clientProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    const body = await request.json();
    const { companionId, date, duration, notes } = body;

    // Validate input
    if (!companionId || !date || !duration) {
      return NextResponse.json(
        { error: 'Companion ID, date, and duration are required' },
        { status: 400 }
      );
    }

    // Get client profile
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
    });

    const clientLat = clientProfile?.lat || 28.6139;
    const clientLng = clientProfile?.lng || 77.2090;

    // Check subscription tier
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });

    const isPremium = currentUser?.subscriptionTier === 'PREMIUM';

    // Check if companion is accessible (first 20 only for free users)
    if (!isPremium) {
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

      const index = sortedCompanions.findIndex((c) => c.id === companionId);
      if (index >= MAX_FREE_COMPANIONS) {
        return NextResponse.json(
          { error: 'COMPANION_LOCKED', message: 'Upgrade to Premium to book this companion' },
          { status: 403 }
        );
      }
    }

    // Get companion profile for rate calculation
    const companion = await prisma.user.findUnique({
      where: {
        id: companionId,
        role: 'COMPANION',
        isActive: true,
        isBanned: false,
      },
      include: { companionProfile: true },
    });

    if (!companion || !companion.companionProfile) {
      return NextResponse.json(
        { error: 'Companion not found or unavailable' },
        { status: 404 }
      );
    }

    // Calculate total amount
    const hourlyRate = companion.companionProfile.hourlyRate;
    const totalAmount = hourlyRate * duration;

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        clientId: user.id,
        companionId,
        date: new Date(date),
        duration: parseInt(duration),
        totalAmount,
        notes: notes || '',
        status: 'PENDING',
      },
      include: {
        companion: {
          include: { companionProfile: true },
        },
      },
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
