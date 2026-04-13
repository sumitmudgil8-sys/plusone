import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/bookings - Paginated list with optional status filter & search
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
    const status = searchParams.get('status'); // PENDING | CONFIRMED | COMPLETED | CANCELLED | REJECTED
    const search = searchParams.get('search')?.trim();

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { client: { clientProfile: { name: { contains: search, mode: 'insensitive' } } } },
        { companion: { companionProfile: { name: { contains: search, mode: 'insensitive' } } } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const selectProfile = {
      select: { id: true, email: true, clientProfile: { select: { name: true, avatarUrl: true } } },
    };
    const selectCompanionProfile = {
      select: { id: true, email: true, companionProfile: { select: { name: true, avatarUrl: true } } },
    };

    const [bookings, total, stats] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { client: selectProfile, companion: selectCompanionProfile },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
      // Always return aggregate stats (unfiltered)
      Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: 'PENDING' } }),
        prisma.booking.count({ where: { status: 'CONFIRMED' } }),
        prisma.booking.count({ where: { status: 'COMPLETED' } }),
        prisma.booking.count({ where: { status: 'CANCELLED' } }),
        prisma.booking.count({ where: { status: 'REJECTED' } }),
        prisma.booking.aggregate({ _sum: { totalAmount: true } }),
      ]).then(([all, pending, confirmed, completed, cancelled, rejected, rev]) => ({
        total: all,
        pending,
        confirmed,
        completed,
        cancelled,
        rejected,
        totalRevenue: rev._sum.totalAmount ?? 0,
      })),
    ]);

    return NextResponse.json({
      bookings,
      stats,
      pagination: { page, limit, total, hasMore: skip + bookings.length < total },
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