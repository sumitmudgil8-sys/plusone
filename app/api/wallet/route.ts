import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOrCreateWallet } from '@/lib/wallet';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/wallet — current balance + last 10 transactions
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const wallet = await getOrCreateWallet(user.id);

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: wallet.balance,
        transactions,
      },
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}
