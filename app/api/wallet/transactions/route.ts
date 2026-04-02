import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/wallet/transactions?page=1&limit=20
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { page, limit } = parsed.data;

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

    if (!wallet) {
      return NextResponse.json({
        success: true,
        data: { transactions: [], total: 0, page, limit },
      });
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Wallet transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
