import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Checks that a CLIENT user has an approved profile picture.
 * Returns a NextResponse error if not approved, or null if OK.
 *
 * Usage:
 *   const block = await requireApprovedAvatar(userId);
 *   if (block) return block;
 */
export async function requireApprovedAvatar(userId: string): Promise<NextResponse | null> {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: { avatarStatus: true, avatarUrl: true },
  });

  if (!profile?.avatarUrl || profile.avatarStatus !== 'APPROVED') {
    const message =
      !profile?.avatarUrl
        ? 'Please upload a profile picture before interacting with companions.'
        : profile.avatarStatus === 'PENDING'
          ? 'Your profile picture is pending admin approval. You can browse companions, but interactions are locked until approved.'
          : profile.avatarStatus === 'REJECTED'
            ? 'Your profile picture was rejected. Please upload a new one.'
            : 'Please upload a profile picture to continue.';

    return NextResponse.json(
      { success: false, error: 'AVATAR_NOT_APPROVED', message },
      { status: 403 }
    );
  }

  return null;
}
