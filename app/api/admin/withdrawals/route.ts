import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WithdrawalStatus } from '@prisma/client';

export const runtime = 'nodejs';

// GET /api/admin/withdrawals?status=PENDING
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100)
  );
  const skip = (page - 1) * limit;

  const where: { status?: WithdrawalStatus } = {};
  if (statusParam && Object.values(WithdrawalStatus).includes(statusParam as WithdrawalStatus)) {
    where.status = statusParam as WithdrawalStatus;
  }

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        companion: {
          include: {
            companionProfile: {
              select: { name: true, avatarUrl: true },
            },
          },
          select: {
            id: true,
            email: true,
            companionProfile: true,
          },
        },
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + withdrawals.length < total,
      },
    },
  });
}
