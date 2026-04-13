import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { debitWallet } from '@/lib/wallet';
import { getAblyClient, getUserChannelName } from '@/lib/ably';
import { sendPushToUser } from '@/lib/push';
import {
  SCHEDULED_DURATIONS,
  SCHEDULED_HOLD_RATE,
  SCHEDULED_MIN_ADVANCE_MINUTES,
  SCHEDULED_MAX_ADVANCE_DAYS,
  PLATFORM_COMMISSION_RATE,
} from '@/lib/constants';

export const runtime = 'nodejs';

const bookSchema = z.object({
  companionId: z.string().min(1),
  duration: z.number().refine((v) => (SCHEDULED_DURATIONS as readonly number[]).includes(v), {
    message: `Duration must be one of: ${SCHEDULED_DURATIONS.join(', ')} minutes`,
  }),
  scheduledAt: z.string().datetime(),
});

// POST /api/scheduled-sessions — Book a scheduled chat session
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const body = await request.json().catch(() => ({}));
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { companionId, duration, scheduledAt: scheduledAtStr } = parsed.data;
  const scheduledAt = new Date(scheduledAtStr);

  // Validate time constraints
  const now = Date.now();
  const minTime = now + SCHEDULED_MIN_ADVANCE_MINUTES * 60 * 1000;
  const maxTime = now + SCHEDULED_MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000;

  if (scheduledAt.getTime() < minTime) {
    return NextResponse.json(
      { success: false, error: `Must book at least ${SCHEDULED_MIN_ADVANCE_MINUTES} minutes in advance` },
      { status: 400 }
    );
  }

  if (scheduledAt.getTime() > maxTime) {
    return NextResponse.json(
      { success: false, error: `Cannot book more than ${SCHEDULED_MAX_ADVANCE_DAYS} days in advance` },
      { status: 400 }
    );
  }

  try {
    // Parallel lookups
    const [companion, block, existingScheduled] = await Promise.all([
      prisma.user.findUnique({
        where: { id: companionId, role: 'COMPANION', isActive: true, isBanned: false },
        include: { companionProfile: { select: { chatRatePerMinute: true, hourlyRate: true, name: true } } },
      }),
      prisma.blockedUser.findUnique({
        where: { companionId_clientId: { companionId, clientId: user.id } },
      }),
      // Check for overlapping scheduled sessions (within 30 min of requested time)
      prisma.scheduledSession.findFirst({
        where: {
          clientId: user.id,
          status: 'BOOKED',
          scheduledAt: {
            gte: new Date(scheduledAt.getTime() - 30 * 60 * 1000),
            lte: new Date(scheduledAt.getTime() + 30 * 60 * 1000),
          },
        },
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
        { success: false, error: 'Unable to book with this companion' },
        { status: 403 }
      );
    }

    if (existingScheduled) {
      return NextResponse.json(
        { success: false, error: 'You already have a session scheduled around this time' },
        { status: 409 }
      );
    }

    // Calculate costs
    const ratePerMinute = companion.companionProfile.chatRatePerMinute
      ?? Math.round(companion.companionProfile.hourlyRate / 60);
    const estimatedTotal = ratePerMinute * duration;
    const holdAmount = Math.round(estimatedTotal * SCHEDULED_HOLD_RATE);

    // Debit hold from wallet
    let holdTransaction;
    try {
      holdTransaction = await debitWallet(
        user.id,
        holdAmount,
        `Booking hold — ${duration}min chat with ${companion.companionProfile.name}`,
        { companionId, duration, scheduledAt: scheduledAtStr },
        'HOLD'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'INSUFFICIENT_BALANCE' || message === 'WALLET_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_BALANCE',
            required: holdAmount,
            estimatedTotal,
            ratePerMinute,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // Create scheduled session
    const session = await prisma.scheduledSession.create({
      data: {
        clientId: user.id,
        companionId,
        duration,
        ratePerMinute,
        estimatedTotal,
        holdAmount,
        holdTransactionId: holdTransaction.id,
        scheduledAt,
        status: 'BOOKED',
      },
    });

    // Fetch client name for notifications
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
      select: { name: true },
    });
    const clientName = clientProfile?.name ?? 'A client';

    // Notify companion via Ably
    try {
      const ably = getAblyClient();
      await ably.channels.get(getUserChannelName(companionId)).publish('scheduled:booked', {
        sessionId: session.id,
        clientId: user.id,
        clientName,
        duration,
        scheduledAt: scheduledAt.toISOString(),
        ratePerMinute,
        estimatedTotal,
        companionEarning: Math.round(estimatedTotal * (1 - PLATFORM_COMMISSION_RATE)),
      });
    } catch { /* non-fatal */ }

    // Push notification to companion
    try {
      const scheduledTime = scheduledAt.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      await sendPushToUser(companionId, {
        title: `${clientName} booked a ${duration}min chat`,
        body: `Scheduled for ${scheduledTime}`,
        url: '/companion/dashboard',
        type: 'SCHEDULED_SESSION',
        tag: `scheduled-${session.id}`,
        extra: { sessionId: session.id },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        duration,
        ratePerMinute,
        estimatedTotal,
        holdAmount,
        scheduledAt: scheduledAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Scheduled session booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to book session' },
      { status: 500 }
    );
  }
}

// GET /api/scheduled-sessions — List scheduled sessions for the current user
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // optional: BOOKED, ACTIVE, etc.

  try {
    const where = user.role === 'CLIENT'
      ? { clientId: user.id }
      : { companionId: user.id };

    const sessions = await prisma.scheduledSession.findMany({
      where: {
        ...where,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        client: {
          select: { id: true, clientProfile: { select: { name: true, avatarUrl: true } } },
        },
        companion: {
          select: { id: true, companionProfile: { select: { name: true, avatarUrl: true } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    const data = sessions.map((s) => ({
      id: s.id,
      duration: s.duration,
      ratePerMinute: s.ratePerMinute,
      estimatedTotal: s.estimatedTotal,
      holdAmount: s.holdAmount,
      scheduledAt: s.scheduledAt.toISOString(),
      status: s.status,
      companionId: s.companionId,
      companionName: s.companion.companionProfile?.name ?? 'Companion',
      companionAvatar: s.companion.companionProfile?.avatarUrl ?? null,
      clientId: s.clientId,
      clientName: s.client.clientProfile?.name ?? 'Client',
      clientAvatar: s.client.clientProfile?.avatarUrl ?? null,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Scheduled sessions list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
