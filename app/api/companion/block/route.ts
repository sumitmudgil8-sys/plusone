import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const blockSchema = z.object({ clientId: z.string().min(1) });

// GET /api/companion/block — list blocked clients
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const blocked = await prisma.blockedUser.findMany({
    where: { companionId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      client: {
        select: { clientProfile: { select: { name: true, avatarUrl: true } } },
      },
    },
  });

  const data = blocked.map((b) => ({
    id: b.id,
    clientId: b.clientId,
    clientName: b.client.clientProfile?.name ?? 'Client',
    clientAvatar: b.client.clientProfile?.avatarUrl ?? null,
    blockedAt: b.createdAt,
  }));

  return NextResponse.json({ success: true, data: { blocked: data } });
}

// POST /api/companion/block — block a client
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { clientId } = parsed.data;

  // Verify client exists
  const client = await prisma.user.findUnique({
    where: { id: clientId, role: 'CLIENT' },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  }

  // Upsert — idempotent
  const block = await prisma.blockedUser.upsert({
    where: { companionId_clientId: { companionId: auth.user.id, clientId } },
    update: {},
    create: { companionId: auth.user.id, clientId },
  });

  return NextResponse.json({ success: true, data: { id: block.id } }, { status: 201 });
}
