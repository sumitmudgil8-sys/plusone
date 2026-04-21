import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const COMPANION_REVIEW_HOURS = 8;

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: {
        clientProfile: true,
        companionProfile: true,
        companionImages: {
          where: { isPrimary: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Compute whether the 8-hour companion review window has elapsed.
    // accessGranted=true means the client can proceed to the dashboard.
    let accessGranted = false;
    if (
      user.role === 'CLIENT' &&
      user.clientStatus === 'APPROVED' &&
      user.adminApprovedAt
    ) {
      const elapsed = Date.now() - user.adminApprovedAt.getTime();
      accessGranted = elapsed >= COMPANION_REVIEW_HOURS * 60 * 60 * 1000;
    }

    // Remove password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: userWithoutPassword,
      ...(user.role === 'CLIENT' && { accessGranted }),
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
