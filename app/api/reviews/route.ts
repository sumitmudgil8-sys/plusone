import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Get reviews for a companion
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companionId = searchParams.get('companionId');

    if (!companionId) {
      return NextResponse.json({ error: 'Companion ID required' }, { status: 400 });
    }

    const take = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const skip = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    const reviews = await prisma.review.findMany({
      where: {
        reviewedId: companionId,
        isPublic: true,
      },
      include: {
        reviewer: {
          select: {
            clientProfile: {
              select: { name: true, avatarUrl: true },
            },
          },
        },
        billingSession: {
          select: { type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    const mapped = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewerName: r.reviewer.clientProfile?.name ?? 'Anonymous',
      reviewerAvatar: r.reviewer.clientProfile?.avatarUrl ?? null,
      sessionType: r.billingSession?.type ?? (r.bookingId ? 'BOOKING' : null),
    }));

    return NextResponse.json({ reviews: mapped, hasMore: reviews.length === take });
  } catch (error) {
    console.error('Get reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// Create a review
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { bookingId, rating, comment } = await req.json();

    if (!bookingId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid review data' }, { status: 400 });
    }

    // Check if booking exists and is completed
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { review: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.clientId !== payload.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (booking.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only review completed bookings' }, { status: 400 });
    }

    if (booking.review) {
      return NextResponse.json({ error: 'Review already exists' }, { status: 400 });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        bookingId,
        reviewerId: payload.id,
        reviewedId: booking.companionId,
        rating,
        comment: comment || '',
      },
    });

    // Update companion average rating using aggregate (avoids fetching all rows)
    const stats = await prisma.review.aggregate({
      where: { reviewedId: booking.companionId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.companionProfile.update({
      where: { userId: booking.companionId },
      data: {
        averageRating: stats._avg.rating ?? 0,
        reviewCount: stats._count.rating,
      },
    });

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
