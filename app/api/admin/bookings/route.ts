import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/bookings - Paginated list of bookings
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['ADMIN']);
    if (auth.user === null) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100)
    );
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: {
          client: {
            select: { id: true, email: true, clientProfile: { select: { name: true, avatarUrl: true } } },
          },
          companion: {
            select: { id: true, email: true, companionProfile: { select: { name: true, avatarUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count(),
    ]);

    return NextResponse.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + bookings.length < total,
      },
    });
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