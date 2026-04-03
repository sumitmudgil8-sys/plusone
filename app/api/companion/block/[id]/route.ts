import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// DELETE /api/companion/block/[id] — unblock
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const block = await prisma.blockedUser.findUnique({ where: { id: params.id } });

  if (!block) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  if (block.companionId !== auth.user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  await prisma.blockedUser.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
