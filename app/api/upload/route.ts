import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { uploadToCloudinary, deleteFromCloudinary, type UploadFolder } from '@/lib/cloudinary';
import { prisma } from '@/lib/prisma';
import {
  UPLOAD_MAX_IMAGE_BYTES,
  UPLOAD_MAX_DOCUMENT_BYTES,
  UPLOAD_ALLOWED_IMAGE_TYPES,
  UPLOAD_ALLOWED_DOCUMENT_TYPES,
  COMPANION_GALLERY_MAX_IMAGES,
} from '@/lib/constants';

export const runtime = 'nodejs';

// Disable Next.js body parsing — we handle the multipart stream directly.
export const dynamic = 'force-dynamic';

type UploadType = 'avatar' | 'gallery' | 'document';

const UPLOAD_TYPE_CONFIG: Record<
  UploadType,
  { folder: UploadFolder; maxBytes: number; allowedTypes: string[] }
> = {
  avatar: {
    folder: 'avatars',
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    allowedTypes: UPLOAD_ALLOWED_IMAGE_TYPES,
  },
  gallery: {
    folder: 'companion-gallery',
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    allowedTypes: UPLOAD_ALLOWED_IMAGE_TYPES,
  },
  document: {
    folder: 'verification-docs',
    maxBytes: UPLOAD_MAX_DOCUMENT_BYTES,
    allowedTypes: UPLOAD_ALLOWED_DOCUMENT_TYPES,
  },
};

// POST /api/upload
// Body: multipart/form-data with fields:
//   file  — the binary file
//   type  — "avatar" | "gallery" | "document"
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION', 'ADMIN']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid multipart form data' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  const typeRaw = formData.get('type');

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: 'No file provided' },
      { status: 400 }
    );
  }

  if (!typeRaw || typeof typeRaw !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Upload type is required (avatar | gallery | document)' },
      { status: 400 }
    );
  }

  const uploadType = typeRaw as UploadType;
  const config = UPLOAD_TYPE_CONFIG[uploadType];

  if (!config) {
    return NextResponse.json(
      { success: false, error: `Invalid type. Must be one of: avatar, gallery, document` },
      { status: 400 }
    );
  }

  // Validate MIME type
  if (!config.allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: `File type ${file.type} not allowed for ${uploadType}` },
      { status: 415 }
    );
  }

  // Validate file size
  if (file.size > config.maxBytes) {
    const maxMB = config.maxBytes / (1024 * 1024);
    return NextResponse.json(
      { success: false, error: `File too large. Maximum size is ${maxMB}MB` },
      { status: 413 }
    );
  }

  // Role restrictions
  if (uploadType === 'gallery' && user.role !== 'COMPANION') {
    return NextResponse.json(
      { success: false, error: 'Only companions can upload gallery images' },
      { status: 403 }
    );
  }

  if (uploadType === 'document' && user.role !== 'COMPANION') {
    return NextResponse.json(
      { success: false, error: 'Only companions can upload verification documents' },
      { status: 403 }
    );
  }

  // Gallery cap check
  if (uploadType === 'gallery') {
    const profile = await prisma.companionProfile.findUnique({
      where: { userId: user.id },
      select: { images: true },
    });
    const currentImages: string[] = JSON.parse(profile?.images ?? '[]');
    if (currentImages.length >= COMPANION_GALLERY_MAX_IMAGES) {
      return NextResponse.json(
        { success: false, error: `Gallery is full. Maximum ${COMPANION_GALLERY_MAX_IMAGES} images allowed` },
        { status: 409 }
      );
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // For avatars, use a deterministic public_id so re-uploading replaces the old one.
    const publicId = uploadType === 'avatar' ? `avatar_${user.id}` : undefined;

    // If replacing avatar, clean up old one from Cloudinary (best-effort)
    if (uploadType === 'avatar') {
      const profile =
        user.role === 'CLIENT'
          ? await prisma.clientProfile.findUnique({ where: { userId: user.id }, select: { avatarUrl: true } })
          : await prisma.companionProfile.findUnique({ where: { userId: user.id }, select: { avatarUrl: true } });

      if (profile?.avatarUrl) {
        // Extract public_id from existing Cloudinary URL if present
        const match = profile.avatarUrl.match(/plus-one\/avatars\/([^.]+)/);
        if (match) await deleteFromCloudinary(`plus-one/avatars/${match[1]}`);
      }
    }

    const result = await uploadToCloudinary(buffer, config.folder, publicId);

    // Persist the URL to the DB immediately after upload
    if (uploadType === 'avatar') {
      if (user.role === 'CLIENT') {
        await prisma.clientProfile.update({
          where: { userId: user.id },
          data: { avatarUrl: result.url },
        });
      } else if (user.role === 'COMPANION') {
        await prisma.companionProfile.update({
          where: { userId: user.id },
          data: { avatarUrl: result.url },
        });
      }
    } else if (uploadType === 'gallery') {
      const profile = await prisma.companionProfile.findUnique({
        where: { userId: user.id },
        select: { images: true },
      });
      const current: string[] = JSON.parse(profile?.images ?? '[]');
      await prisma.companionProfile.update({
        where: { userId: user.id },
        data: { images: JSON.stringify([...current, result.url]) },
      });
    }
    // For 'document', the caller submits to POST /api/verification/documents with the returned URL.

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
