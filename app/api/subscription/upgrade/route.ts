import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/subscription/upgrade - Mock subscription upgrade
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    // In a real app, this would verify payment
    // For MVP, we just upgrade the user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: 'GOLD' },
      include: { clientProfile: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription upgraded successfully!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        subscriptionTier: updatedUser.subscriptionTier,
        name: updatedUser.clientProfile?.name,
      },
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}
