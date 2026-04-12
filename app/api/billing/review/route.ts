import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MIN_SESSION_DURATION_FOR_REVIEW } from '@/lib/constants';

export const runtime = 'nodejs';

const reviewSchema = z.object({
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// POST /api/billing/review
// Submit a rating/review after a chat or voice session.
// Only the client can review. Session must be ENDED and ≥ 2 minutes.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId, rating, comment } = parsed.data;

  try {
    const session = await prisma.billingSession.findUnique({
      where: { id: sessionId },
      include: { review: true },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (session.clientId !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'ENDED') {
      return NextResponse.json({ success: false, error: 'Can only review ended sessions' }, { status: 400 });
    }

    if (session.durationSeconds < MIN_SESSION_DURATION_FOR_REVIEW) {
      return NextResponse.json(
        { success: false, error: 'Session too short to review' },
        { status: 400 }
      );
    }

    if (session.review) {
      return NextResponse.json({ success: false, error: 'Already reviewed' }, { status: 409 });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        billingSessionId: sessionId,
        reviewerId: auth.user.id,
        reviewedId: session.companionId,
        rating,
        comment: comment ?? null,
      },
    });

    // Update companion aggregate rating using all reviews (bookings + sessions)
    const stats = await prisma.review.aggregate({
      where: { reviewedId: session.companionId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Count only session reviews for totalRatedSessions
    const sessionReviewCount = await prisma.review.count({
      where: { reviewedId: session.companionId, billingSessionId: { not: null } },
    });

    await prisma.companionProfile.update({
      where: { userId: session.companionId },
      data: {
        averageRating: stats._avg.rating ?? 0,
        reviewCount: stats._count.rating,
        totalRatedSessions: sessionReviewCount,
      },
    });

    return NextResponse.json({ success: true, data: { reviewId: review.id } });
  } catch (error) {
    console.error('Session review error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}
