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
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

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

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      CLIENT: ['CANCELLED'],
      COMPANION: ['CONFIRMED', 'REJECTED', 'COMPLETED'],
    };

    const allowedStatuses = validTransitions[user.role];
    if (!allowedStatuses?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot update to status: ${status}` },
        { status: 400 }
      );
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
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
