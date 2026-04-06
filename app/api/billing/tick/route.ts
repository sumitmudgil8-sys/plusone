import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { debitWallet, creditWallet } from '@/lib/wallet';
import { getCompanionRatePerMinute } from '@/lib/billing';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { BILLING_TICK_SECONDS, BILLING_MIN_BALANCE_MINUTES } from '@/lib/constants';

export const runtime = 'nodejs';

const tickSchema = z.object({
  sessionId: z.string().min(1),
});

// POST /api/billing/tick
// Called by the client every BILLING_TICK_SECONDS.
// Debits 1 minute from the client wallet, credits companion, updates session.
// Returns the updated balance and whether the session can continue.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = tickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  try {
    const session = await prisma.billingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.clientId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'SESSION_NOT_ACTIVE', data: { status: session.status } },
        { status: 409 }
      );
    }

    // Anti-double-billing: reject tick if too soon after last tick
    const minTickMs = (BILLING_TICK_SECONDS - 10) * 1000; // 50s minimum
    const msSinceLastTick = Date.now() - session.lastTickAt.getTime();
    if (msSinceLastTick < minTickMs) {
      return NextResponse.json(
        { success: false, error: 'TICK_TOO_SOON' },
        { status: 429 }
      );
    }

    const { ratePerMinute, companionId } = session;

    // Debit client wallet (throws INSUFFICIENT_BALANCE if low)
    try {
      await debitWallet(
        user.id,
        ratePerMinute,
        `Chat with companion — 1 minute`,
        { sessionId, companionId }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown';
      if (message === 'INSUFFICIENT_BALANCE') {
        // End session — client cannot continue
        await prisma.billingSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED', endedAt: new Date() },
        });
        // Notify both sides
        try {
          const ably = getAblyClient();
          const payload = { sessionId, totalCharged: session.totalCharged };
          await Promise.all([
            ably.channels.get(getUserChannelName(user.id)).publish('chat:ended', payload),
            ably.channels.get(getUserChannelName(companionId)).publish('chat:ended', payload),
          ]);
        } catch { /* non-fatal */ }
        return NextResponse.json({
          success: true,
          data: { ended: true, reason: 'INSUFFICIENT_BALANCE', balance: 0 },
        });
      }
      throw err;
    }

    // Credit companion wallet (best-effort — don't fail the tick if this errors)
    const companionEarning = getCompanionRatePerMinute(ratePerMinute);
    try {
      await creditWallet(
        companionId,
        companionEarning,
        `Earnings from chat — 1 minute`,
        { sessionId, clientId: user.id }
      );
    } catch (companionErr) {
      console.error('Companion credit error (non-fatal):', companionErr);
    }

    // Update session
    const updatedSession = await prisma.billingSession.update({
      where: { id: sessionId },
      data: {
        lastTickAt: new Date(),
        totalMinutes: { increment: 1 },
        totalCharged: { increment: ratePerMinute },
      },
    });

    // Check if client has enough balance for the next minute
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    const balance = wallet?.balance ?? 0;
    const canContinue = balance >= ratePerMinute * BILLING_MIN_BALANCE_MINUTES;

    if (!canContinue) {
      // Proactively end session — balance won't cover the next tick
      await prisma.billingSession.update({
        where: { id: sessionId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      // Notify both sides
      try {
        const ably = getAblyClient();
        const payload = { sessionId, totalCharged: updatedSession.totalCharged };
        await Promise.all([
          ably.channels.get(getUserChannelName(user.id)).publish('chat:ended', payload),
          ably.channels.get(getUserChannelName(companionId)).publish('chat:ended', payload),
        ]);
      } catch { /* non-fatal */ }
      return NextResponse.json({
        success: true,
        data: {
          ended: true,
          reason: 'BALANCE_TOO_LOW',
          balance,
          totalCharged: updatedSession.totalCharged,
          totalMinutes: updatedSession.totalMinutes,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ended: false,
        balance,
        totalCharged: updatedSession.totalCharged,
        totalMinutes: updatedSession.totalMinutes,
      },
    });
  } catch (error) {
    console.error('Billing tick error:', error);
    return NextResponse.json(
      { success: false, error: 'Billing tick failed' },
      { status: 500 }
    );
  }
}
