import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const schema = z.object({ imageId: z.string().min(1) });

// POST /api/companion/images/set-primary
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { imageId } = parsed.data;

  // Verify ownership
  const image = await prisma.companionImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
  }
  if (image.companionId !== auth.user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Atomic: unset all primaries, then set selected one
  await prisma.$transaction([
    prisma.companionImage.updateMany({
      where: { companionId: auth.user.id },
      data: { isPrimary: false },
    }),
    prisma.companionImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
