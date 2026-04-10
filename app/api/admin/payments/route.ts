import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/payments
 * Admin views all manual payment requests, with optional status filter.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (!auth.user) return auth.response;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // PENDING | APPROVED | REJECTED | EXPIRED
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100)
  );
  const skip = (page - 1) * limit;

  // Auto-expire stale PENDING payments before returning
  await prisma.manualPayment.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = statusFilter;
  }

  const [payments, total] = await Promise.all([
    prisma.manualPayment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            clientProfile: { select: { name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.manualPayment.count({ where }),
  ]);

  // Summary stats
  const [pendingCount, pendingSum, approvedTodayCount, approvedTodaySum] = await Promise.all([
    prisma.manualPayment.count({ where: { status: 'PENDING', expiresAt: { gt: new Date() } } }),
    prisma.manualPayment.aggregate({
      where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      _sum: { uniqueAmount: true },
    }),
    prisma.manualPayment.count({
      where: {
        status: 'APPROVED',
        resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.manualPayment.aggregate({
      where: {
        status: 'APPROVED',
        resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { uniqueAmount: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      payments,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + payments.length < total,
      },
      stats: {
        pendingCount,
        pendingAmount: pendingSum._sum.uniqueAmount ?? 0,
        approvedTodayCount,
        approvedTodayAmount: approvedTodaySum._sum.uniqueAmount ?? 0,
      },
    },
  });
}
