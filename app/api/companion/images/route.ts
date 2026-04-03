import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// GET /api/companion/images — list all images for the logged-in companion
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const images = await prisma.companionImage.findMany({
    where: { companionId: auth.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: { images } });
}

// POST /api/companion/images — upload a new gallery image
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: 'Only JPG, PNG, and WebP images are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Image must be under 5 MB' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadToCloudinary(buffer, 'companion-gallery');

  const image = await prisma.companionImage.create({
    data: {
      companionId: auth.user.id,
      imageUrl: uploaded.url,
      publicId: uploaded.publicId,
    },
  });

  return NextResponse.json({ success: true, data: { image } }, { status: 201 });
}
