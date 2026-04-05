import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/subscription/status — return current subscription state for the logged-in client
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        subscriptionPlan: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    let status = dbUser.subscriptionStatus;

    // Auto-correct stale ACTIVE records where expiry has passed
    if (status === 'ACTIVE' && dbUser.subscriptionExpiresAt && dbUser.subscriptionExpiresAt < now) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'EXPIRED' },
      });
      status = 'EXPIRED';
    }

    const daysRemaining =
      status === 'ACTIVE' && dbUser.subscriptionExpiresAt
        ? Math.max(0, Math.ceil((dbUser.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    return NextResponse.json({
      success: true,
      data: {
        status,
        subscriptionExpiresAt: dbUser.subscriptionExpiresAt,
        subscriptionPlan: dbUser.subscriptionPlan,
        daysRemaining,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
