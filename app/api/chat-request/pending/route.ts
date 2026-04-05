import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/chat-request/pending — returns the oldest non-expired pending chat
// request for the authenticated companion, if one exists.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const pending = await prisma.chatRequest.findFirst({
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
      requestId: pending.id,
      clientId: pending.clientId,
      clientName: pending.client.clientProfile?.name ?? 'A client',
      clientAvatar: pending.client.clientProfile?.avatarUrl ?? null,
      expiresAt: pending.expiresAt.toISOString(),
    },
  });
}
