import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hashPassword } from '@/lib/auth';
import { sendCompanionCredentialsEmail } from '@/lib/email';
import { getAblyClient } from '@/lib/ably';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';
import crypto from 'crypto';

export const runtime = 'nodejs';

// GET /api/admin/companions - Paginated list of companions
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

    const where = { role: 'COMPANION' as const };
    const [companions, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { companionProfile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Remove password hashes
    const companionsWithoutPassword = (companions as any[]).map((user) => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return NextResponse.json({
      companions: companionsWithoutPassword,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + companions.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching companions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/companions - Create companion account
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const body = await request.json();
    const { email, name, password, hourlyRate = 2000, chatRatePerMinute, callRatePerMinute } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // Use admin-provided password or generate a random one
    const tempPassword = password || crypto.randomBytes(6).toString('hex');
    const passwordHash = await hashPassword(tempPassword);

    // hourlyRate param is kept in the API for backwards compat but now in paise.
    // Default 200000 paise = ₹2000/hr.
    const hourlyRatePaise =
      typeof hourlyRate === 'number' && hourlyRate > 0 ? hourlyRate : 200000;

    // Compute per-minute rates in paise (admin inputs in ₹)
    const chatRatePaise = typeof chatRatePerMinute === 'number' && chatRatePerMinute > 0
      ? chatRatePerMinute * 100 : null;
    const callRatePaise = typeof callRatePerMinute === 'number' && callRatePerMinute > 0
      ? callRatePerMinute * 100 : null;

    const companion = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'COMPANION',
        isTemporaryPassword: true,
        companionProfile: {
          create: {
            name,
            hourlyRate: hourlyRatePaise,
            ...(chatRatePaise !== null ? { chatRatePerMinute: chatRatePaise } : {}),
            ...(callRatePaise !== null ? { callRatePerMinute: callRatePaise } : {}),
            bio: '',
            lat: 28.6139,
            lng: 77.209,
            isApproved: false,
            availability: '[]',
            images: '[]',
          },
        },
      },
      include: { companionProfile: true },
    });

    // Send credentials by email — tempPassword is NOT returned in the response
    sendCompanionCredentialsEmail(email, name, tempPassword);

    // Publish real-time event so browse page shows the new companion immediately
    try {
      const ably = getAblyClient();
      const feedChannel = ably.channels.get('companions-feed');
      await feedChannel.publish('companion.added', {
        id: companion.id,
        name,
        city: null,
        primaryImage: null,
        hourlyRate: hourlyRatePaise,
        chatRatePerMinute: chatRatePaise,
        callRatePerMinute: callRatePaise,
        availabilityStatus: 'OFFLINE',
      });
    } catch (ablyErr) {
      console.warn('[admin/companions] Ably publish failed (non-fatal):', ablyErr);
    }

    const { passwordHash: _, ...companionWithoutPassword } = companion;

    return NextResponse.json({
      success: true,
      companion: companionWithoutPassword,
      tempPassword,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating companion:', error);
    return NextResponse.json(
      { error: 'Failed to create companion' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/companions - Approve/reject companion
export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const body = await request.json();
    const { id, isApproved } = body;

    if (!id || isApproved === undefined) {
      return NextResponse.json(
        { error: 'Companion ID and isApproved status are required' },
        { status: 400 }
      );
    }

    const companion = await prisma.companionProfile.update({
      where: { userId: id },
      data: { isApproved },
    });

    await recordAdminAction({
      adminId: auth.user.id,
      action: isApproved ? AdminAction.COMPANION_APPROVE : AdminAction.COMPANION_REJECT,
      targetType: 'CompanionProfile',
      targetId: id,
    });

    return NextResponse.json({ companion });
  } catch (error) {
    console.error('Error updating companion:', error);
    return NextResponse.json(
      { error: 'Failed to update companion' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/companions/[id] - Delete companion
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Companion ID is required' },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });

    await recordAdminAction({
      adminId: auth.user.id,
      action: AdminAction.USER_DELETE,
      targetType: 'User',
      targetId: id,
      metadata: { role: 'COMPANION' },
    });

    return NextResponse.json({
      success: true,
      message: 'Companion deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting companion:', error);
    return NextResponse.json(
      { error: 'Failed to delete companion' },
      { status: 500 }
    );
  }
}
