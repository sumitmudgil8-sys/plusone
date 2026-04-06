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

  const where: { status?: WithdrawalStatus } = {};
  if (statusParam && Object.values(WithdrawalStatus).includes(statusParam as WithdrawalStatus)) {
    where.status = statusParam as WithdrawalStatus;
  }

  const withdrawals = await prisma.withdrawalRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
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
  });

  return NextResponse.json({ success: true, data: { withdrawals } });
}
