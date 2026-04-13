import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { creditWallet } from '@/lib/wallet';
import { SCHEDULED_NO_SHOW_WINDOW_MINUTES, PLATFORM_COMMISSION_RATE } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/scheduled-sessions/resolve
// Resolves no-shows for scheduled sessions past their grace period.
// Called by cron or admin. Also callable by any authenticated user (self-healing).
//
// Logic:
//   BOOKED + past grace → CLIENT_NO_SHOW (hold forfeited, companion gets share)
//   ACTIVE + billing PENDING → COMPANION_NO_SHOW (hold released to client)
//   ACTIVE + billing ACTIVE/ENDED → COMPLETED (normal flow, hold already released)
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  try {
    const graceThreshold = new Date(
      Date.now() - SCHEDULED_NO_SHOW_WINDOW_MINUTES * 60 * 1000
    );

    // Find sessions that need resolution
    const pendingSessions = await prisma.scheduledSession.findMany({
      where: {
        status: { in: ['BOOKED', 'ACTIVE'] },
        scheduledAt: { lt: graceThreshold },
      },
      include: {
        billingSession: { select: { id: true, status: true } },
      },
      take: 100,
    });

    const results: Array<{ sessionId: string; resolution: string }> = [];

    for (const session of pendingSessions) {
      if (session.status === 'BOOKED') {
        // Client never activated → CLIENT_NO_SHOW
        await prisma.scheduledSession.update({
          where: { id: session.id },
          data: { status: 'CLIENT_NO_SHOW', resolvedAt: new Date() },
        });

        // Forfeit hold: credit companion their share
        if (session.holdAmount > 0) {
          const companionShare = Math.round(session.holdAmount * (1 - PLATFORM_COMMISSION_RATE));
          try {
            await creditWallet(
              session.companionId,
              companionShare,
              'Client no-show — compensation from booking hold',
              { scheduledSessionId: session.id },
              'EARNING'
            );
          } catch (err) {
            console.error(`Companion credit for no-show ${session.id}:`, err);
          }
        }

        results.push({ sessionId: session.id, resolution: 'CLIENT_NO_SHOW' });
      } else if (session.status === 'ACTIVE') {
        const billingStatus = session.billingSession?.status;

        if (billingStatus === 'PENDING') {
          // Client activated but companion never accepted → COMPANION_NO_SHOW
          await prisma.scheduledSession.update({
            where: { id: session.id },
            data: { status: 'COMPANION_NO_SHOW', resolvedAt: new Date() },
          });

          // Expire the billing session
          if (session.billingSessionId) {
            await prisma.billingSession.update({
              where: { id: session.billingSessionId },
              data: { status: 'EXPIRED' },
            });
          }

          // Hold was already released on activation, no additional refund needed.
          // But if the hold release failed earlier, try again.
          results.push({ sessionId: session.id, resolution: 'COMPANION_NO_SHOW' });
        } else if (billingStatus === 'ACTIVE' || billingStatus === 'ENDED') {
          // Normal completion — billing ran its course
          await prisma.scheduledSession.update({
            where: { id: session.id },
            data: { status: 'COMPLETED', resolvedAt: new Date() },
          });
          results.push({ sessionId: session.id, resolution: 'COMPLETED' });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { resolved: results.length, results },
    });
  } catch (error) {
    console.error('Scheduled session resolve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve sessions' },
      { status: 500 }
    );
  }
}
