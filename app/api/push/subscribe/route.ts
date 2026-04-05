import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { endpoint, p256dh, auth: authKey, userAgent } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth: authKey, userAgent: userAgent ?? null, userId: auth.user.id },
    create: {
      userId: auth.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const { endpoint } = body as { endpoint?: string };

  if (!endpoint) {
    return NextResponse.json({ success: false, error: 'endpoint required' }, { status: 400 });
  }

  await prisma.pushSubscription
    .delete({ where: { endpoint } })
    .catch(() => {/* already deleted */});

  return NextResponse.json({ success: true });
}
