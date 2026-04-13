import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';

// GET /api/admin/users - Paginated list of users
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100)
    );
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    // Remove password hashes
    const usersWithoutPassword = (users as any[]).map((user) => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return NextResponse.json({
      users: usersWithoutPassword,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
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
    const { id, isBanned, subscriptionTier, subscriptionStatus, subscriptionPlan, subscriptionExpiresAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (isBanned !== undefined) updateData.isBanned = isBanned;
    if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier;
    if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan !== undefined) updateData.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined) {
      updateData.subscriptionExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { clientProfile: true, companionProfile: true },
    });

    // Audit the mutation. Ban/unban is the most important case; subscription
    // edits also get logged as generic updates for completeness.
    if (isBanned === true) {
      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.USER_BAN,
        targetType: 'User',
        targetId: id,
        metadata: { subscriptionTier, subscriptionStatus },
      });
    } else if (isBanned === false) {
      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.USER_UNBAN,
        targetType: 'User',
        targetId: id,
      });
    }

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

    // Delete in a transaction — clean up non-cascading relations first
    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: { OR: [{ senderId: id }, { receiverId: id }] },
      });
      await tx.review.deleteMany({
        where: { OR: [{ reviewerId: id }, { reviewedId: id }] },
      });
      await tx.scheduledSession.deleteMany({
        where: { OR: [{ clientId: id }, { companionId: id }] },
      });
      await tx.billingSession.deleteMany({
        where: { OR: [{ clientId: id }, { companionId: id }] },
      });
      await tx.booking.deleteMany({
        where: { OR: [{ clientId: id }, { companionId: id }] },
      });
      await tx.messageThread.deleteMany({
        where: { OR: [{ clientId: id }, { companionId: id }] },
      });
      await tx.user.delete({ where: { id } });
    });

    await recordAdminAction({
      adminId: auth.user.id,
      action: AdminAction.USER_DELETE,
      targetType: 'User',
      targetId: id,
    });

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
