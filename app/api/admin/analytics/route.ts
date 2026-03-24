import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/admin/analytics - Get dashboard analytics
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  try {
    // Get counts
    const totalUsers = await prisma.user.count({
      where: { role: 'CLIENT' },
    });

    const totalCompanions = await prisma.user.count({
      where: { role: 'COMPANION' },
    });

    const approvedCompanions = await prisma.companionProfile.count({
      where: { isApproved: true },
    });

    const totalBookings = await prisma.booking.count();

    const activeBookings = await prisma.booking.count({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    // Calculate total revenue (mock - sum of completed bookings)
    const completedBookings = await prisma.booking.findMany({
      where: { status: 'COMPLETED' },
      select: { totalAmount: true },
    });

    const totalRevenue = completedBookings.reduce(
      (sum, booking) => sum + booking.totalAmount,
      0
    );

    // Get recent bookings
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { include: { clientProfile: true } },
        companion: { include: { companionProfile: true } },
      },
    });

    // Get unapproved companions
    const unapprovedCompanions = await prisma.user.findMany({
      where: {
        role: 'COMPANION',
        companionProfile: { isApproved: false },
      },
      include: { companionProfile: true },
    });

    return NextResponse.json({
      totalUsers,
      totalCompanions,
      approvedCompanions,
      pendingCompanions: totalCompanions - approvedCompanions,
      totalBookings,
      activeBookings,
      totalRevenue,
      recentBookings,
      unapprovedCompanions: (unapprovedCompanions as any[]).map((u) => {
        const { passwordHash, ...rest } = u;
        return rest;
      }),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
