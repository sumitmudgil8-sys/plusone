import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

// DELETE /api/companion/images/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const image = await prisma.companionImage.findUnique({
    where: { id: params.id },
  });

  if (!image) {
    return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
  }

  // Ownership check — companion can only delete their own images
  if (image.companionId !== auth.user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Delete from Cloudinary (best-effort, non-fatal)
  if (image.publicId) {
    await deleteFromCloudinary(image.publicId);
  }

  await prisma.companionImage.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
