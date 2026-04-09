import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { BILLING_GRACE_SECONDS } from '@/lib/constants';

export const runtime = 'nodejs';

/**
 * POST /api/billing/cleanup
 *
 * Server-side watchdog for orphaned sessions.
 * Expires ACTIVE sessions where no billing tick has fired for longer than
 * BILLING_GRACE_SECONDS (e.g. client browser crashed, lost network).
 *
 * Also expires PENDING sessions past their expiresAt.
 *
 * Can be called periodically (e.g. cron every 2 min) or piggy-backed on
 * other billing endpoints.
 */
export async function POST(request: NextRequest) {
  // Simple auth: require a secret header to prevent public abuse
  const secret = request.headers.get('x-cleanup-secret');
  const expected = process.env.BILLING_CLEANUP_SECRET;

  // If secret is configured, enforce it. If not configured, allow (for dev).
  if (expected && secret !== expected) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const now = new Date();
  const graceThreshold = new Date(now.getTime() - BILLING_GRACE_SECONDS * 1000);

  try {
    // 1. Find orphaned ACTIVE sessions (no tick for > grace period)
    const orphanedSessions = await prisma.billingSession.findMany({
      where: {
        status: 'ACTIVE',
        lastTickAt: { lt: graceThreshold },
      },
      select: {
        id: true,
        clientId: true,
        companionId: true,
        totalCharged: true,
      },
    });

    // End each orphaned session
    if (orphanedSessions.length > 0) {
      await prisma.billingSession.updateMany({
        where: {
          id: { in: orphanedSessions.map(s => s.id) },
          status: 'ACTIVE', // re-check to avoid race
        },
        data: {
          status: 'ENDED',
          endedAt: now,
        },
      });

      // Notify participants (best-effort)
      try {
        const ably = getAblyClient();
        for (const s of orphanedSessions) {
          const payload = { sessionId: s.id, totalCharged: s.totalCharged, endedBy: 'SYSTEM' };
          await Promise.all([
            ably.channels.get(getUserChannelName(s.clientId)).publish('chat:ended', payload),
            ably.channels.get(getUserChannelName(s.companionId)).publish('chat:ended', payload),
          ]);
        }
      } catch {
        // non-fatal — sessions are already ended in DB
      }
    }

    // 2. Expire stale PENDING sessions
    const expiredPending = await prisma.billingSession.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    return NextResponse.json({
      success: true,
      data: {
        orphanedEnded: orphanedSessions.length,
        pendingExpired: expiredPending.count,
      },
    });
  } catch (error) {
    console.error('Billing cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
