import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';

// Get pending companions
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const companions = await prisma.user.findMany({
      where: {
        role: 'COMPANION',
        OR: [
          { companionProfile: { isApproved: false } },
          { companionProfile: { verificationStatus: 'PENDING' } },
        ],
      },
      include: {
        companionProfile: true,
      },
    });

    return NextResponse.json({ companions });
  } catch (error) {
    console.error('Get pending companions error:', error);
    return NextResponse.json({ error: 'Failed to fetch companions' }, { status: 500 });
  }
}

// Approve or reject companion
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, action, notes } = await req.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isApproved = action === 'approve';
    const verificationStatus = isApproved ? 'APPROVED' : 'REJECTED';

    await prisma.companionProfile.update({
      where: { userId },
      data: {
        isApproved,
        verificationStatus,
      },
    });

    // Update documents if any
    await prisma.verificationDocument.updateMany({
      where: { userId, status: 'PENDING' },
      data: {
        status: verificationStatus,
        adminNotes: notes || '',
        reviewedAt: new Date(),
      },
    });

    // Create notification for companion
    await prisma.notification.create({
      data: {
        userId,
        type: 'VERIFICATION',
        title: isApproved ? 'Profile Approved!' : 'Verification Update',
        message: isApproved
          ? 'Your profile has been approved and is now visible to clients.'
          : notes || 'Your verification was not approved.',
      },
    });

    await recordAdminAction({
      adminId: payload.id,
      action: isApproved ? AdminAction.VERIFICATION_APPROVE : AdminAction.VERIFICATION_REJECT,
      targetType: 'CompanionProfile',
      targetId: userId,
      reason: notes || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update companion error:', error);
    return NextResponse.json({ error: 'Failed to update companion' }, { status: 500 });
  }
}
