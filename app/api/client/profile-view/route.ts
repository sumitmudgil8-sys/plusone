import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  companionId: z.string().min(1),
  durationMs: z.number().int().min(0),
});

// POST /api/client/profile-view
// Called on companion profile page unmount to record time spent.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { companionId, durationMs } = parsed.data;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Upsert: increment durationMs if a recent view exists, otherwise create
    const existing = await prisma.companionProfileView.findFirst({
      where: {
        clientId: user.id,
        companionId,
        viewedAt: { gte: oneDayAgo },
      },
      orderBy: { viewedAt: 'desc' },
    });

    if (existing) {
      await prisma.companionProfileView.update({
        where: { id: existing.id },
        data: {
          durationMs: existing.durationMs + durationMs,
          viewedAt: new Date(),
        },
      });
    } else {
      await prisma.companionProfileView.create({
        data: { clientId: user.id, companionId, durationMs },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile view error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record view' }, { status: 500 });
  }
}
