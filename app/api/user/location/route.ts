import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { latitude, longitude } = parsed.data;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { latitude, longitude, locationUpdatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
