import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/admin/users - Get all users
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const users = await prisma.user.findMany({
      include: {
        clientProfile: true,
        companionProfile: true,
        _count: {
          select: {
            clientBookings: true,
            companionBookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove password hashes
    const usersWithoutPassword = (users as any[]).map((user) => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return NextResponse.json({ users: usersWithoutPassword });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users - Update user (ban, subscription, etc.)
export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const body = await request.json();
    const { id, isBanned, subscriptionTier } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (isBanned !== undefined) updateData.isBanned = isBanned;
    if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { clientProfile: true, companionProfile: true },
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
