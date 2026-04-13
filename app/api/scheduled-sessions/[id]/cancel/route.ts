import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { creditWallet } from '@/lib/wallet';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { SCHEDULED_CANCEL_WINDOW_MINUTES } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/scheduled-sessions/[id]/cancel
// Either client or companion can cancel a BOOKED session.
// Hold is returned if cancelled > 1h before, forfeited otherwise.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { id } = await params;

  try {
    const session = await prisma.scheduledSession.findUnique({ where: { id } });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (session.clientId !== user.id && session.companionId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'BOOKED') {
      return NextResponse.json(
        { success: false, error: 'Session cannot be cancelled', data: { status: session.status } },
        { status: 409 }
      );
    }

    const cancelledBy = session.clientId === user.id ? 'CLIENT' : 'COMPANION';
    const minutesUntilSession = (session.scheduledAt.getTime() - Date.now()) / (60 * 1000);

    // Companion cancels → always release hold to client
    // Client cancels > 1h before → release hold
    // Client cancels < 1h before → hold forfeited (no refund)
    const shouldRefund = cancelledBy === 'COMPANION' || minutesUntilSession > SCHEDULED_CANCEL_WINDOW_MINUTES;

    await prisma.scheduledSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledBy,
        cancelledAt: new Date(),
      },
    });

    if (shouldRefund && session.holdAmount > 0) {
      try {
        await creditWallet(
          session.clientId,
          session.holdAmount,
          `Booking hold released — session cancelled by ${cancelledBy.toLowerCase()}`,
          { scheduledSessionId: id },
          'HOLD_RELEASE'
        );
      } catch (err) {
        console.error('Hold release error:', err);
      }
    }

    // Notify the other party
    const otherUserId = cancelledBy === 'CLIENT' ? session.companionId : session.clientId;
    try {
      const ably = getAblyClient();
      await ably.channels.get(getUserChannelName(otherUserId)).publish('scheduled:cancelled', {
        sessionId: id,
        cancelledBy,
        refunded: shouldRefund,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: id,
        cancelledBy,
        holdRefunded: shouldRefund,
        holdAmount: session.holdAmount,
      },
    });
  } catch (error) {
    console.error('Scheduled session cancel error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel session' },
      { status: 500 }
    );
  }
}
