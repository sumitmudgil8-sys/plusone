import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { creditWallet } from '@/lib/wallet';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { SCHEDULED_ACTIVATION_WINDOW_MINUTES } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/scheduled-sessions/[id]/activate
// Client activates a scheduled session near its scheduled time.
// Creates a PENDING BillingSession and notifies the companion (same flow as chat:request).
// The hold is released back to the client since billing will run per-minute.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { id } = await params;

  try {
    const session = await prisma.scheduledSession.findUnique({ where: { id } });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (session.clientId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'BOOKED') {
      return NextResponse.json(
        { success: false, error: 'Session cannot be activated', data: { status: session.status } },
        { status: 409 }
      );
    }

    // Check if within activation window (±10 min of scheduled time)
    const now = Date.now();
    const scheduledMs = session.scheduledAt.getTime();
    const windowMs = SCHEDULED_ACTIVATION_WINDOW_MINUTES * 60 * 1000;

    if (now < scheduledMs - windowMs) {
      return NextResponse.json(
        { success: false, error: 'Too early — session starts at ' + session.scheduledAt.toISOString() },
        { status: 400 }
      );
    }

    if (now > scheduledMs + windowMs) {
      // Past the activation window — this will be resolved as no-show by the cron
      return NextResponse.json(
        { success: false, error: 'Activation window has passed' },
        { status: 410 }
      );
    }

    // Check for any other active billing sessions for this client
    const existingActive = await prisma.billingSession.findFirst({
      where: { clientId: user.id, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { id: true },
    });

    if (existingActive) {
      return NextResponse.json(
        { success: false, error: 'You already have an active session. End it first.' },
        { status: 409 }
      );
    }

    // Create a PENDING BillingSession (companion must accept)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 min to accept

    const billingSession = await prisma.billingSession.create({
      data: {
        clientId: user.id,
        companionId: session.companionId,
        type: 'CHAT',
        ratePerMinute: session.ratePerMinute,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Link billing session to scheduled session and mark ACTIVE
    await prisma.scheduledSession.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        billingSessionId: billingSession.id,
      },
    });

    // Release the hold — billing will run per-minute from here
    if (session.holdAmount > 0) {
      try {
        await creditWallet(
          user.id,
          session.holdAmount,
          'Booking hold released — session activated',
          { scheduledSessionId: id, billingSessionId: billingSession.id },
          'HOLD_RELEASE'
        );
      } catch (err) {
        console.error('Hold release on activation error (non-fatal):', err);
      }
    }

    // Fetch client profile for companion notification
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
      select: { name: true, avatarUrl: true },
    });
    const clientName = clientProfile?.name ?? 'Client';

    // Notify companion via Ably — same event as a regular chat request
    try {
      const ably = getAblyClient();
      const channel = ably.channels.get(getUserChannelName(session.companionId));
      await channel.publish('chat:request', {
        sessionId: billingSession.id,
        clientId: user.id,
        clientName,
        clientAvatar: clientProfile?.avatarUrl ?? null,
        ratePerMinute: session.ratePerMinute,
        expiresAt: expiresAt.toISOString(),
        scheduled: true,
        scheduledSessionId: id,
        duration: session.duration,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data: {
        scheduledSessionId: id,
        billingSessionId: billingSession.id,
        expiresAt: expiresAt.toISOString(),
        ratePerMinute: session.ratePerMinute,
        holdReleased: session.holdAmount,
      },
    });
  } catch (error) {
    console.error('Scheduled session activation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate session' },
      { status: 500 }
    );
  }
}
