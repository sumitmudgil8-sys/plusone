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

    // Calculate total amount and deposit (both in paise).
    // The deposit is held on the client's wallet as an anti-no-show bond.
    // On REJECTED/CANCELLED it's released back. On COMPLETED it's retained
    // as platform revenue (not credited to anyone).
    const hourlyRate = companion.companionProfile.hourlyRate;
    const totalAmount = hourlyRate * parseInt(duration);
    const depositAmount = Math.ceil((totalAmount * DEPOSIT_PERCENTAGE) / 100);
    const companionDisplayName = companion.companionProfile.name;

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
            description: `Booking deposit · ${companionDisplayName}`,
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
            message: `You need ₹${(depositAmount / 100).toLocaleString('en-IN')} in your wallet for the booking deposit. Please recharge and try again.`,
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
