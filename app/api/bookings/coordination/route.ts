import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { FREE_CHAT_LIMIT } from '@/lib/constants';

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

  const booking = await prisma.booking.findFirst({
    where: {
      clientId,
      companionId,
      status: 'CONFIRMED',
      freeChatMsgCount: { lt: FREE_CHAT_LIMIT },
    },
    select: {
      id: true,
      freeChatMsgCount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!booking) {
    return NextResponse.json({
      success: true,
      data: { active: false, bookingId: null, msgsLeft: 0 },
    });
  }

  const msgsLeft = FREE_CHAT_LIMIT - booking.freeChatMsgCount;

  return NextResponse.json({
    success: true,
    data: {
      active: true,
      bookingId: booking.id,
      msgsLeft,
    },
  });
}
