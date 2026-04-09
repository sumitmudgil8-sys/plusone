import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const tokenSchema = z.object({
  token: z.string().min(1),
  device: z.string().optional(),
});

/**
 * POST /api/push/fcm-token
 * Register or refresh an FCM token for the authenticated user.
 * Upserts by token — if the token already exists for another user,
 * it's reassigned (device changed hands / user logged out and back in).
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { token, device } = parsed.data;

  await prisma.fcmToken.upsert({
    where: { token },
    update: {
      userId: auth.user.id,
      device: device ?? null,
      updatedAt: new Date(),
    },
    create: {
      userId: auth.user.id,
      token,
      device: device ?? null,
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/push/fcm-token
 * Remove an FCM token (e.g. on logout).
 */
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const { token } = body as { token?: string };

  if (!token) {
    return NextResponse.json({ success: false, error: 'token required' }, { status: 400 });
  }

  await prisma.fcmToken
    .delete({ where: { token } })
    .catch(() => { /* already deleted */ });

  return NextResponse.json({ success: true });
}
