import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// PATCH /api/bookings/[id] - Update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { id } = params;

  try {
    const body = await request.json();
    const { status, action, lat, lng } = body;

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isClient = user.role === 'CLIENT' && booking.clientId === user.id;
    const isCompanion = user.role === 'COMPANION' && booking.companionId === user.id;

    if (!isClient && !isCompanion) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ── Mark Arrived action ───────────────────────────────────────────────────
    if (action === 'arrived') {
      if (!isCompanion) {
        return NextResponse.json({ error: 'Only the companion can mark arrival' }, { status: 403 });
      }
      if (booking.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Booking must be confirmed to mark arrival' }, { status: 400 });
      }
      const now = new Date();
      if (now < booking.date) {
        return NextResponse.json({ error: 'Meeting has not started yet' }, { status: 400 });
      }
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          arrivedAt: now,
          ...(typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0
            ? { arrivedLat: lat, arrivedLng: lng }
            : {}),
        },
        include: {
          companion: { include: { companionProfile: true } },
          client: { include: { clientProfile: true } },
        },
      });
      return NextResponse.json({ booking: updatedBooking });
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status or action is required' },
        { status: 400 }
      );
    }

    // State machine.
    //
    // Statuses: PENDING | CONFIRMED | REJECTED | COMPLETED | EXPIRED | CANCELLED
    //
    // Legal transitions and which role may trigger them:
    //
    //   PENDING   → CONFIRMED   (companion accepts)
    //   PENDING   → REJECTED    (companion rejects)
    //   PENDING   → CANCELLED   (client cancels before acceptance)
    //   CONFIRMED → COMPLETED   (companion marks meeting done)
    //   CONFIRMED → CANCELLED   (client or companion cancels)
    //
    // Terminal: REJECTED, COMPLETED, CANCELLED, EXPIRED — no further transitions.
    //
    // Specifically forbidden (previously allowed in code):
    //   PENDING → COMPLETED (skips CONFIRMED — enables review/metric fraud)
    //   <any terminal state> → anything
    type Transition = { from: string; to: string; roles: Array<'CLIENT' | 'COMPANION'> };
    const TRANSITIONS: Transition[] = [
      { from: 'PENDING', to: 'CONFIRMED', roles: ['COMPANION'] },
      { from: 'PENDING', to: 'REJECTED', roles: ['COMPANION'] },
      { from: 'PENDING', to: 'CANCELLED', roles: ['CLIENT'] },
      { from: 'CONFIRMED', to: 'COMPLETED', roles: ['COMPANION'] },
      { from: 'CONFIRMED', to: 'CANCELLED', roles: ['CLIENT', 'COMPANION'] },
    ];

    const allowed = TRANSITIONS.find(
      (t) =>
        t.from === booking.status &&
        t.to === status &&
        t.roles.includes(user.role as 'CLIENT' | 'COMPANION')
    );

    if (!allowed) {
      return NextResponse.json(
        {
          error: `Illegal transition: ${booking.status} → ${status} by ${user.role}`,
        },
        { status: 400 }
      );
    }

    // ── Time gate: COMPLETED only after meeting has ended ────────────────────
    if (status === 'COMPLETED') {
      const meetingEndMs = new Date(booking.date).getTime() + booking.duration * 60 * 60 * 1000;
      if (Date.now() < meetingEndMs) {
        return NextResponse.json(
          { error: 'Cannot mark complete before the meeting ends' },
          { status: 400 }
        );
      }
    }

    // Atomic update guarded on the current status — prevents TOCTOU where
    // two concurrent requests both see PENDING and both try to transition.
    // If the transition refunds the booking deposit, do it in the same
    // transaction so the status flip and the wallet credit are consistent.
    const refundsDeposit =
      (status === 'REJECTED' || status === 'CANCELLED') &&
      booking.depositAmount > 0 &&
      booking.holdTransactionId !== null;

    // When confirming, open a 20-minute free coordination chat window
    const confirmationData = status === 'CONFIRMED'
      ? { freeChatExpiresAt: new Date(Date.now() + 20 * 60 * 1000) }
      : {};

    const updateCount = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: refundsDeposit
          ? { status, holdTransactionId: null, ...confirmationData }
          : { status, ...confirmationData },
      });

      if (result.count === 0) return 0;

      if (refundsDeposit) {
        const wallet = await tx.wallet.upsert({
          where: { userId: booking.clientId },
          create: { userId: booking.clientId, balance: booking.depositAmount },
          update: { balance: { increment: booking.depositAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'HOLD_RELEASE',
            amount: booking.depositAmount,
            balanceAfter: wallet.balance,
            description: `Booking deposit refund · ${status === 'REJECTED' ? 'declined' : 'cancelled'}`,
            metadata: JSON.stringify({ bookingId: id, originalHoldTransactionId: booking.holdTransactionId }),
          },
        });
      }

      return result.count;
    });

    if (updateCount === 0) {
      return NextResponse.json(
        { error: 'Booking status changed concurrently. Please refresh.' },
        { status: 409 }
      );
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        companion: {
          include: { companionProfile: true },
        },
        client: {
          include: { clientProfile: true },
        },
      },
    });

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

// GET /api/bookings/[id] - Get specific booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { id } = params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        companion: {
          include: { companionProfile: true },
        },
        client: {
          include: { clientProfile: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this booking
    const isClient = user.role === 'CLIENT' && booking.clientId === user.id;
    const isCompanion = user.role === 'COMPANION' && booking.companionId === user.id;

    if (!isClient && !isCompanion) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}
