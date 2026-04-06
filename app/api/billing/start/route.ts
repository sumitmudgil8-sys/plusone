import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateWallet } from '@/lib/wallet';
import { getRatePerMinute } from '@/lib/billing';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { getCallChannelName } from '@/lib/agora';
import { BILLING_MIN_BALANCE_MINUTES } from '@/lib/constants';
import { sendPushToUser } from '@/lib/push';

export const runtime = 'nodejs';

const startSchema = z.object({
  companionId: z.string().min(1),
  type: z.enum(['CHAT', 'VOICE']),
});

// POST /api/billing/start
// Validates wallet balance, snapshots rate, creates or returns active BillingSession.
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
    // Check companion exists and is active
    const companion = await prisma.user.findUnique({
      where: { id: companionId, role: 'COMPANION', isActive: true, isBanned: false },
      include: { companionProfile: true },
    });

    if (!companion?.companionProfile) {
      return NextResponse.json(
        { success: false, error: 'Companion not found or unavailable' },
        { status: 404 }
      );
    }

    // Check if companion has blocked this client
    const block = await prisma.blockedUser.findUnique({
      where: { companionId_clientId: { companionId, clientId: user.id } },
    });
    if (block) {
      return NextResponse.json(
        { success: false, error: 'Unable to start session with this companion' },
        { status: 403 }
      );
    }

    // Return existing active session if one exists (idempotent)
    const existing = await prisma.billingSession.findFirst({
      where: { clientId: user.id, companionId, status: 'ACTIVE' },
    });

    if (existing) {
      const wallet = await getOrCreateWallet(user.id);
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existing.id,
          ratePerMinute: existing.ratePerMinute,
          balance: wallet.balance,
          resumed: true,
        },
      });
    }

    // Use the rate matching the session type (chat vs voice vs default hourly)
    const ratePerMinute =
      type === 'CHAT'
        ? (companion.companionProfile.chatRatePerMinute ?? getRatePerMinute(companion.companionProfile.hourlyRate))
        : type === 'VOICE'
        ? (companion.companionProfile.callRatePerMinute ?? getRatePerMinute(companion.companionProfile.hourlyRate))
        : getRatePerMinute(companion.companionProfile.hourlyRate);
    const minimumRequired = ratePerMinute * BILLING_MIN_BALANCE_MINUTES;

    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balance < minimumRequired) {
      return NextResponse.json(
        {
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          data: {
            balance: wallet.balance,
            required: minimumRequired,
            ratePerMinute,
          },
        },
        { status: 402 }
      );
    }

    // Create billing session
    const session = await prisma.billingSession.create({
      data: {
        clientId: user.id,
        companionId,
        type,
        ratePerMinute,
        status: 'ACTIVE',
      },
    });

    // Fetch caller profile once for use in both VOICE and CHAT notifications
    const callerProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
      select: { name: true, avatarUrl: true },
    });
    const callerName = callerProfile?.name ?? 'Client';

    // For voice calls, signal the companion via Ably so they can show incoming call UI
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

    // Push notification to companion for both CHAT and VOICE billing starts
    try {
      await sendPushToUser(companionId, {
        title: type === 'CHAT' ? `${callerName} wants to chat` : `Incoming call from ${callerName}`,
        body:
          type === 'CHAT'
            ? `Chat session at ₹${Math.round(ratePerMinute / 100)}/min`
            : `Voice call at ₹${Math.round(ratePerMinute / 100)}/min`,
        url: `/companion/inbox/${user.id}`,
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
