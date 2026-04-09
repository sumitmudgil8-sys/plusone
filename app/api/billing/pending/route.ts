import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCallChannelName } from '@/lib/agora';

export const runtime = 'nodejs';

// GET /api/billing/pending — returns oldest non-expired PENDING BillingSession for companion
// Returns both CHAT and VOICE pending sessions with a `type` field so the
// companion layout can show the correct modal (IncomingChatRequestModal vs IncomingCallModal).
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const pending = await prisma.billingSession.findFirst({
    where: {
      companionId: auth.user.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      client: {
        include: {
          clientProfile: { select: { name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!pending) {
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({
    success: true,
    data: {
      type: pending.type,
      sessionId: pending.id,
      clientId: pending.clientId,
      clientName: pending.client.clientProfile?.name ?? 'A client',
      clientAvatar: pending.client.clientProfile?.avatarUrl ?? null,
      ratePerMinute: pending.ratePerMinute,
      expiresAt: pending.expiresAt?.toISOString() ?? null,
      ...(pending.type === 'VOICE' ? { channelName: getCallChannelName(pending.id) } : {}),
    },
  });
}
