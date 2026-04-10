import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { debitWallet, creditWallet } from '@/lib/wallet';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { BILLING_TICK_SECONDS, BILLING_MIN_BALANCE_MINUTES, PLATFORM_COMMISSION_RATE } from '@/lib/constants';
import { billingTickLimiter } from '@/lib/rate-limit';

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

  // Per-user rate limit on top of the existing lastTickAt DB check below.
  // The DB check prevents double-billing within a session; this protects
  // against a single authenticated user hammering the endpoint across many
  // sessions or with invalid session IDs.
  const rl = billingTickLimiter.check(`tick:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many billing requests. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

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

    // Atomically claim the tick slot. This replaces the previous read-then-
    // check pattern, which had a TOCTOU window where two concurrent ticks
    // could both pass the lastTickAt check and both debit the wallet.
    //
    // The updateMany only advances lastTickAt if BOTH conditions hold:
    //   1. the session is still ACTIVE (not ended by another request)
    //   2. at least minTickMs has elapsed since the last recorded tick
    //
    // If count === 0, another tick beat us — bail out before touching wallets.
    const minTickMs = (BILLING_TICK_SECONDS - 5) * 1000; // 55s minimum
    const nowMs = Date.now();
    const tickCutoff = new Date(nowMs - minTickMs);
    const nowDate = new Date(nowMs);

    const claim = await prisma.billingSession.updateMany({
      where: {
        id: sessionId,
        clientId: user.id,
        status: 'ACTIVE',
        lastTickAt: { lte: tickCutoff },
      },
      data: { lastTickAt: nowDate },
    });

    if (claim.count === 0) {
      return NextResponse.json(
        { success: false, error: 'TICK_TOO_SOON' },
        { status: 429 }
      );
    }

    const { ratePerMinute, companionId } = session;

    // Debit client wallet (throws INSUFFICIENT_BALANCE if low).
    // Tagged by session type so earnings/transaction history can distinguish
    // chat charges from call charges.
    const debitType = session.type === 'VOICE' ? 'CALL_CHARGE' : 'CHAT_CHARGE';
    const chargeLabel = session.type === 'VOICE' ? 'Voice call' : 'Chat';
    try {
      await debitWallet(
        user.id,
        ratePerMinute,
        `${chargeLabel} with companion — 1 minute`,
        { sessionId, companionId },
        debitType
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
          const payload = { sessionId, totalCharged: session.totalCharged, endedBy: 'SYSTEM' };
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

    // Credit companion wallet after platform commission
    const companionEarning = Math.round(ratePerMinute * (1 - PLATFORM_COMMISSION_RATE));
    try {
      await creditWallet(
        companionId,
        companionEarning,
        `Earnings from ${session.type === 'VOICE' ? 'voice call' : 'chat'} — 1 minute`,
        { sessionId, clientId: user.id, sessionType: session.type },
        'EARNING'
      );
    } catch (companionErr) {
      console.error('Companion credit error (non-fatal):', companionErr);
    }

    // Update session totals. lastTickAt was already advanced by the atomic
    // claim above, so we only need to bump the counters here.
    const updatedSession = await prisma.billingSession.update({
      where: { id: sessionId },
      data: {
        totalMinutes: { increment: 1 },
        durationSeconds: { increment: BILLING_TICK_SECONDS },
        totalCharged: { increment: ratePerMinute },
        companionShare: { increment: companionEarning },
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
        const payload = { sessionId, totalCharged: updatedSession.totalCharged, endedBy: 'SYSTEM' };
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

    // Warn client when balance is low (≤ 2 minutes remaining)
    const balanceLow = balance <= ratePerMinute * 2;
    if (balanceLow) {
      try {
        const ably = getAblyClient();
        await ably.channels.get(getUserChannelName(user.id)).publish('chat:balance_low', {
          sessionId,
          balance,
          minutesRemaining: Math.floor(balance / ratePerMinute),
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      data: {
        ended: false,
        balance,
        balanceLow,
        totalCharged: updatedSession.totalCharged,
        totalMinutes: updatedSession.totalMinutes,
        durationSeconds: updatedSession.durationSeconds,
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
