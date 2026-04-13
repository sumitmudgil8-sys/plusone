import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { DEPOSIT_PERCENTAGE, MAX_FREE_COMPANIONS } from '@/lib/constants';
import { calculateDistance } from '@/lib/utils';

export const runtime = 'nodejs';

// GET /api/bookings - Get bookings for current user
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    let bookings;

    if (user.role === 'CLIENT') {
      bookings = await prisma.booking.findMany({
        where: { clientId: user.id },
        select: {
          id: true, date: true, duration: true, status: true, totalAmount: true,
          depositAmount: true, paymentStatus: true, notes: true, createdAt: true,
          venueName: true, venueAddress: true, venueLat: true, venueLng: true,
          companion: {
            select: { id: true, companionProfile: { select: { name: true, avatarUrl: true, city: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
    } else {
      bookings = await prisma.booking.findMany({
        where: { companionId: user.id },
        select: {
          id: true, date: true, duration: true, status: true, totalAmount: true,
          depositAmount: true, paymentStatus: true, notes: true, createdAt: true,
          venueName: true, venueAddress: true, venueLat: true, venueLng: true,
          client: {
            select: { id: true, clientProfile: { select: { name: true, avatarUrl: true, city: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
    }

    return NextResponse.json({ bookings, hasMore: bookings.length === take });
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
    const { companionId, date, duration, notes, venueName, venueAddress, venueLat, venueLng } = body;

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

    const isPremium = currentUser?.subscriptionTier === 'GOLD';

    // Check if companion is accessible (first 20 only for free users)
    if (!isPremium) {
      const allCompanions = await prisma.user.findMany({
        where: {
          role: 'COMPANION',
          isActive: true,
          isBanned: false,
          companionProfile: { isApproved: true },
        },
        select: { id: true, companionProfile: { select: { lat: true, lng: true } } },
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

    // Verify the booking date falls on a day the companion is available.
    // The client UI already hides unavailable days, but an attacker can POST
    // any date directly — this enforces the constraint server-side.
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid booking date' },
        { status: 400 }
      );
    }
    // Must be today or in the future (strip time portion for comparison)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return NextResponse.json(
        { error: 'Booking date must be today or in the future' },
        { status: 400 }
      );
    }
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const dayKey = DAY_KEYS[bookingDate.getDay()];
    let schedule: Record<string, string[]> = {};
    try {
      schedule = JSON.parse(companion.companionProfile.weeklyAvailability || '{}');
    } catch {
      schedule = {};
    }
    const hasWeeklyData = Object.values(schedule).some((slots) => Array.isArray(slots) && slots.length > 0);
    if (hasWeeklyData) {
      const daySlots = schedule[dayKey];
      if (!daySlots || daySlots.length === 0) {
        return NextResponse.json(
          { error: 'Companion is not available on the selected date' },
          { status: 400 }
        );
      }
    } else {
      // Fall back to legacy availability array (list of ISO date strings)
      let legacyAvailability: string[] = [];
      try {
        legacyAvailability = JSON.parse(companion.companionProfile.availability || '[]');
      } catch {
        legacyAvailability = [];
      }
      if (legacyAvailability.length > 0) {
        const dateStr = bookingDate.toISOString().split('T')[0];
        if (!legacyAvailability.includes(dateStr)) {
          return NextResponse.json(
            { error: 'Companion is not available on the selected date' },
            { status: 400 }
          );
        }
      }
      // If neither data source is populated, skip the check (legacy accounts).
    }

    // Calculate total amount and hold (both in paise).
    // The full amount is held on the client's wallet.
    // On REJECTED/CANCELLED it's released back. On COMPLETED it's retained
    // as platform revenue (not credited to anyone).
    const hourlyRate = companion.companionProfile.hourlyRate;
    const totalAmount = hourlyRate * parseInt(duration);
    const depositAmount = Math.ceil((totalAmount * DEPOSIT_PERCENTAGE) / 100);
    const companionDisplayName = companion.companionProfile.name;

    // --- Overlap prevention ---
    // Check if companion has existing offline bookings at the same time
    const bookingStart = bookingDate.getTime();
    const bookingDurationHours = parseInt(duration);
    const bookingEnd = bookingStart + bookingDurationHours * 60 * 60 * 1000;

    const [existingBookings, scheduledSessions] = await Promise.all([
      // Other offline bookings for this companion that could overlap
      prisma.booking.findFirst({
        where: {
          companionId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          date: {
            gte: new Date(bookingStart - 8 * 60 * 60 * 1000), // max 8h prior booking could overlap
            lte: new Date(bookingEnd),
          },
        },
        select: { date: true, duration: true },
      }),
      // Scheduled chat sessions for this companion in the booking window
      prisma.scheduledSession.findMany({
        where: {
          companionId,
          status: 'BOOKED',
          scheduledAt: {
            gte: new Date(bookingStart),
            lt: new Date(bookingEnd),
          },
        },
        select: { id: true, scheduledAt: true, duration: true },
      }),
    ]);

    // Check offline booking overlap
    if (existingBookings) {
      const existStart = existingBookings.date.getTime();
      const existEnd = existStart + existingBookings.duration * 60 * 60 * 1000;
      if (bookingStart < existEnd && bookingEnd > existStart) {
        return NextResponse.json(
          { error: 'This companion already has a booking during this time slot' },
          { status: 409 }
        );
      }
    }

    // If scheduled chat sessions overlap, reject — client should reschedule
    // Offline bookings take priority, but we don't auto-cancel chat sessions;
    // we prevent the conflict from being created in the first place.
    if (scheduledSessions.length > 0) {
      return NextResponse.json(
        {
          error: 'This companion has scheduled chat sessions during this time. Please pick a different time.',
          conflicts: scheduledSessions.map((s) => ({
            scheduledAt: s.scheduledAt.toISOString(),
            duration: s.duration,
          })),
        },
        { status: 409 }
      );
    }

    // Atomic: debit the hold AND create the booking in one transaction.
    // If either fails the wallet is untouched.
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) throw new Error('WALLET_NOT_FOUND');
        if (wallet.balance < depositAmount) throw new Error('INSUFFICIENT_BALANCE');

        const newBalance = wallet.balance - depositAmount;
        await tx.wallet.update({
          where: { userId: user.id },
          data: { balance: newBalance },
        });

        const holdTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'HOLD',
            amount: depositAmount,
            balanceAfter: newBalance,
            description: `Booking hold · ${companionDisplayName}`,
            metadata: JSON.stringify({ companionId, bookingDate: date, duration }),
          },
        });

        return tx.booking.create({
          data: {
            clientId: user.id,
            companionId,
            date: new Date(date),
            duration: parseInt(duration),
            totalAmount,
            depositAmount,
            holdTransactionId: holdTx.id,
            notes: notes || '',
            status: 'PENDING',
            venueName: typeof venueName === 'string' ? venueName.slice(0, 200) : undefined,
            venueAddress: typeof venueAddress === 'string' ? venueAddress.slice(0, 500) : undefined,
            venueLat: typeof venueLat === 'number' ? venueLat : undefined,
            venueLng: typeof venueLng === 'number' ? venueLng : undefined,
          },
          include: {
            companion: {
              include: { companionProfile: true },
            },
          },
        });
      });

      return NextResponse.json({ booking }, { status: 201 });
    } catch (txError) {
      const msg = (txError as Error)?.message;
      if (msg === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json(
          {
            error: 'INSUFFICIENT_BALANCE',
            message: `You need ₹${(depositAmount / 100).toLocaleString('en-IN')} in your wallet. Full amount is held until the booking is confirmed. Please recharge and try again.`,
            depositAmount,
          },
          { status: 402 }
        );
      }
      if (msg === 'WALLET_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Wallet not found. Please recharge to continue.' },
          { status: 402 }
        );
      }
      throw txError;
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
