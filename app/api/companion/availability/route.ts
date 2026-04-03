import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// POST /api/companion/availability — toggle isOnline
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const current = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { isOnline: true },
  });

  if (!current) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: auth.user.id },
    data: { isOnline: !current.isOnline },
    select: { isOnline: true },
  });

  return NextResponse.json({ success: true, data: { isOnline: updated.isOnline } });
}
