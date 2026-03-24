import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/bookings - Get all bookings
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['ADMIN']);
    if (auth.user === null) return auth.response;

    const bookings = await prisma.booking.findMany({
      include: {
        client: {
          include: { clientProfile: true },
        },
        companion: {
          include: { companionProfile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/bookings - Delete booking
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['ADMIN']);
    if (auth.user === null) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}