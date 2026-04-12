import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { debitWallet, creditWallet } from '@/lib/wallet';
import { getCompanionRatePerMinute } from '@/lib/billing';
import { BILLING_GRACE_SECONDS } from '@/lib/constants';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/cron/billing-sweep
// Safety net: finds ACTIVE billing sessions that haven't been ticked within
// the grace period, charges for any uncharged complete minutes, and ends them.
// This prevents sessions from running forever if the client disconnects.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const staleThreshold = new Date(Date.now() - BILLING_GRACE_SECONDS * 1000);

    // Find all ACTIVE sessions that haven't been ticked recently
    const staleSessions = await prisma.billingSession.findMany({
      where: {
        status: 'ACTIVE',
        lastTickAt: { lt: staleThreshold },
      },
    });

    let ended = 0;
    let charged = 0;

    for (const session of staleSessions) {
      // Calculate uncharged minutes since lastTickAt
      const elapsedSinceLastTick = Math.floor(
        (staleThreshold.getTime() - session.lastTickAt.getTime()) / 60_000
      );
      const unchargedMinutes = Math.max(0, elapsedSinceLastTick);

      // Charge for uncharged complete minutes (best-effort — skip if insufficient balance)
      if (unchargedMinutes > 0) {
        const companionEarning = getCompanionRatePerMinute(session.ratePerMinute);
        for (let i = 0; i < unchargedMinutes; i++) {
          try {
            await debitWallet(
              session.clientId,
              session.ratePerMinute,
              `${session.type === 'VOICE' ? 'Voice' : 'Chat'} · sweep charge`,
              { sessionId: session.id },
              session.type === 'VOICE' ? 'CALL_CHARGE' : 'CHAT_CHARGE'
            );
            await creditWallet(
              session.companionId,
              companionEarning,
              `${session.type === 'VOICE' ? 'Voice call' : 'Chat'} earning (sweep)`,
              { sessionId: session.id },
              'EARNING'
            );
            charged++;
          } catch {
            // Insufficient balance or wallet not found — stop charging
            break;
          }
        }
      }

      // End the session
      const endedSession = await prisma.billingSession.update({
        where: { id: session.id },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
          totalMinutes: session.totalMinutes + unchargedMinutes,
          durationSeconds: session.durationSeconds + unchargedMinutes * 60,
          totalCharged: session.totalCharged + unchargedMinutes * session.ratePerMinute,
          companionShare:
            session.companionShare + unchargedMinutes * getCompanionRatePerMinute(session.ratePerMinute),
        },
      });

      // Update companion's lastSessionAt for ranking
      await prisma.companionProfile.update({
        where: { userId: session.companionId },
        data: { lastSessionAt: new Date() },
      }).catch(() => {}); // non-fatal

      // Notify both parties via Ably
      try {
        const ably = getAblyClient();
        const payload = {
          sessionId: endedSession.id,
          totalCharged: endedSession.totalCharged,
          endedBy: 'SYSTEM',
        };
        await Promise.all([
          ably.channels.get(getUserChannelName(endedSession.clientId)).publish('chat:ended', payload),
          ably.channels.get(getUserChannelName(endedSession.companionId)).publish('chat:ended', payload),
        ]);
      } catch {
        // non-fatal
      }

      ended++;
    }

    return NextResponse.json({
      success: true,
      staleSessions: staleSessions.length,
      ended,
      minutesCharged: charged,
    });
  } catch (error) {
    console.error('Billing sweep error:', error);
    return NextResponse.json({ success: false, error: 'Billing sweep failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
