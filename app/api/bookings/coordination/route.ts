import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/bookings/coordination?withUserId=X
// Returns the active coordination chat window (if any) for the caller
// and the specified other party.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const withUserId = searchParams.get('withUserId');

  if (!withUserId) {
    return NextResponse.json(
      { success: false, error: 'withUserId is required' },
      { status: 400 }
    );
  }

  const clientId = user.role === 'CLIENT' ? user.id : withUserId;
  const companionId = user.role === 'COMPANION' ? user.id : withUserId;

  const now = new Date();

  const booking = await prisma.booking.findFirst({
    where: {
      clientId,
      companionId,
      status: 'CONFIRMED',
      freeChatExpiresAt: { gt: now },
    },
    select: {
      id: true,
      freeChatExpiresAt: true,
    },
    orderBy: { freeChatExpiresAt: 'desc' },
  });

  if (!booking || !booking.freeChatExpiresAt) {
    return NextResponse.json({
      success: true,
      data: { active: false, bookingId: null, expiresAt: null, remainingSeconds: 0 },
    });
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((booking.freeChatExpiresAt.getTime() - now.getTime()) / 1000)
  );

  return NextResponse.json({
    success: true,
    data: {
      active: true,
      bookingId: booking.id,
      expiresAt: booking.freeChatExpiresAt.toISOString(),
      remainingSeconds,
    },
  });
}
