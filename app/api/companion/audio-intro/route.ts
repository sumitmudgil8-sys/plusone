import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

// GET /api/companion/audio-intro
// Returns the companion's current audioIntroUrl
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const profile = await prisma.companionProfile.findUnique({
    where: { userId: auth.user.id },
    select: { audioIntroUrl: true },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Companion profile not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { audioIntroUrl: profile.audioIntroUrl },
  });
}

// DELETE /api/companion/audio-intro
// Deletes the audio intro from Cloudinary and clears the DB field
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const profile = await prisma.companionProfile.findUnique({
    where: { userId: auth.user.id },
    select: { audioIntroUrl: true },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Companion profile not found' },
      { status: 404 }
    );
  }

  if (!profile.audioIntroUrl) {
    return NextResponse.json(
      { success: false, error: 'No audio intro to delete' },
      { status: 404 }
    );
  }

  // Delete from Cloudinary (best-effort, non-fatal)
  const publicId = `plus-one/audio-intros/audio_intro_${auth.user.id}`;
  await deleteFromCloudinary(publicId);

  // Clear audioIntroUrl and set profileComplete to false
  await prisma.companionProfile.update({
    where: { userId: auth.user.id },
    data: { audioIntroUrl: null, profileComplete: false },
  });

  return NextResponse.json({ success: true });
}
