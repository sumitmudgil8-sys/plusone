export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Get admin dashboard stats
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get stats
    const [
      totalUsers,
      totalClients,
      totalCompanions,
      pendingCompanions,
      pendingVerifications,
      pendingClientReviews,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      todayBookings,
      pendingPayments,
      pendingWithdrawals,
      totalRevenue,
      recentUsers,
      recentBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'COMPANION' } }),
      prisma.companionProfile.count({
        where: { isApproved: false, verificationStatus: 'PENDING' },
      }),
      prisma.verificationDocument.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'CLIENT', clientStatus: 'PENDING_REVIEW' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.booking.count({ where: { date: { gte: todayStart } } }),
      prisma.manualPayment.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.booking.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          clientProfile: { select: { name: true } },
          companionProfile: { select: { name: true } },
        },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              clientProfile: { select: { name: true } },
            },
          },
          companion: {
            select: {
              companionProfile: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalUsers,
        totalClients,
        totalCompanions,
        pendingCompanions,
        pendingVerifications,
        pendingClientReviews,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        todayBookings,
        pendingPayments,
        pendingWithdrawals,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      },
      recentUsers,
      recentBookings,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
