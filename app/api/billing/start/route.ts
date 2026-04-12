import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateWallet } from '@/lib/wallet';
import { getRatePerMinute } from '@/lib/billing';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { getCallChannelName } from '@/lib/agora';
import { BILLING_MIN_BALANCE_MINUTES, BILLING_GRACE_SECONDS } from '@/lib/constants';
import { sendPushToUser } from '@/lib/push';

export const runtime = 'nodejs';

const startSchema = z.object({
  companionId: z.string().min(1),
  type: z.enum(['CHAT', 'VOICE']),
});

// POST /api/billing/start
// CHAT: Creates a PENDING BillingSession and publishes chat:request to companion.
//       Billing does not start until companion accepts via /api/billing/accept.
// VOICE: Creates an ACTIVE BillingSession immediately and publishes call:incoming.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { companionId, type } = parsed.data;

  try {
    // Opportunistic cleanup: end any stale ACTIVE sessions for this client
    // (compensates for daily-only billing-sweep cron on Hobby plan)
    const staleThreshold = new Date(Date.now() - BILLING_GRACE_SECONDS * 1000);
    prisma.billingSession.updateMany({
      where: { clientId: user.id, status: 'ACTIVE', lastTickAt: { lt: staleThreshold } },
      data: { status: 'ENDED', endedAt: new Date() },
    }).catch(() => {}); // fire-and-forget, non-blocking

    // Run all three lookups in parallel — they are independent
    const [companion, block, existing] = await Promise.all([
      prisma.user.findUnique({
        where: { id: companionId, role: 'COMPANION', isActive: true, isBanned: false },
        include: { companionProfile: true },
      }),
      prisma.blockedUser.findUnique({
        where: { companionId_clientId: { companionId, clientId: user.id } },
      }),
      prisma.billingSession.findFirst({
        where: { clientId: user.id, companionId, status: { in: ['PENDING', 'ACTIVE'] } },
      }),
    ]);

    if (!companion?.companionProfile) {
      return NextResponse.json(
        { success: false, error: 'Companion not found or unavailable' },
        { status: 404 }
      );
    }

    if (block) {
      return NextResponse.json(
        { success: false, error: 'Unable to start session with this companion' },
        { status: 403 }
      );
    }

    if (existing) {
      // Auto-expire if pending and past expiry time
      if (existing.status === 'PENDING' && existing.expiresAt && existing.expiresAt < new Date()) {
        await prisma.billingSession.update({ where: { id: existing.id }, data: { status: 'EXPIRED' } });
      } else {
        const wallet = await getOrCreateWallet(user.id);
        return NextResponse.json({
          success: true,
          data: {
            sessionId: existing.id,
            ratePerMinute: existing.ratePerMinute,
            balance: wallet.balance,
            resumed: true,
            pending: existing.status === 'PENDING',
            expiresAt: existing.expiresAt?.toISOString() ?? null,
          },
        });
      }
    }

    // Use the rate matching the session type
    const ratePerMinute =
      type === 'CHAT'
        ? (companion.companionProfile.chatRatePerMinute ?? getRatePerMinute(companion.companionProfile.hourlyRate))
        : type === 'VOICE'
        ? (companion.companionProfile.callRatePerMinute ?? getRatePerMinute(companion.companionProfile.hourlyRate))
        : getRatePerMinute(companion.companionProfile.hourlyRate);
    const minimumRequired = ratePerMinute * 10; // require 10 minutes worth upfront

    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balance < minimumRequired) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_BALANCE',
          required: minimumRequired,
          current: wallet.balance,
          ratePerMinute,
        },
        { status: 400 }
      );
    }

    // Both CHAT and VOICE start PENDING — billing only starts after companion accepts.
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 min to answer

    const session = await prisma.billingSession.create({
      data: {
        clientId: user.id,
        companionId,
        type,
        ratePerMinute,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Fetch caller profile for notifications
    const callerProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
      select: { name: true, avatarUrl: true },
    });
    const callerName = callerProfile?.name ?? 'Client';

    // VOICE: signal companion via Ably with call:incoming
    if (type === 'VOICE') {
      try {
        const ably = getAblyClient();
        const channel = ably.channels.get(getUserChannelName(companionId));
        await channel.publish('call:incoming', {
          sessionId: session.id,
          clientId: user.id,
          callerName,
          callerAvatar: callerProfile?.avatarUrl ?? null,
          channelName: getCallChannelName(session.id),
          ratePerMinute,
        });
      } catch (ablyErr) {
        console.error('Ably call signal error (non-fatal):', ablyErr);
      }
    }

    // CHAT: publish chat:request to companion — companion must accept to activate billing
    if (type === 'CHAT') {
      try {
        const ably = getAblyClient();
        const channel = ably.channels.get(getUserChannelName(companionId));
        await channel.publish('chat:request', {
          sessionId: session.id,
          clientId: user.id,
          clientName: callerName,
          clientAvatar: callerProfile?.avatarUrl ?? null,
          ratePerMinute,
          expiresAt: expiresAt?.toISOString(),
        });
      } catch (ablyErr) {
        console.error('Ably chat request signal error (non-fatal):', ablyErr);
      }
    }

    // Push notification to companion
    try {
      await sendPushToUser(companionId, {
        title: type === 'CHAT' ? `${callerName} wants to chat` : `Incoming call from ${callerName}`,
        body:
          type === 'CHAT'
            ? `Chat session at ₹${Math.round(ratePerMinute * 0.4 / 100)}/min`
            : `Voice call at ₹${Math.round(ratePerMinute * 0.4 / 100)}/min`,
        url: `/companion/inbox/${user.id}`,
        type: type === 'VOICE' ? 'INCOMING_CALL' : 'CHAT_REQUEST',
        tag: `session-${session.id}`,
        extra: { sessionId: session.id },
      });
    } catch (pushErr) {
      console.error('Billing start push error (non-fatal):', pushErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        ratePerMinute,
        balance: wallet.balance,
        resumed: false,
        pending: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Billing start error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start billing session' },
      { status: 500 }
    );
  }
}
