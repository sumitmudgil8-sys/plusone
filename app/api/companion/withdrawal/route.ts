import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const withdrawalSchema = z.object({
  amount: z.number().int().min(50000, 'Minimum withdrawal is ₹500'),
  note: z.string().max(200).optional(),
});

// POST /api/companion/withdrawal — submit a withdrawal request
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { amount, note } = parsed.data;
  const companionId = auth.user.id;

  // Compute available balance.
  // The wallet is the live source of truth (credited on every billing tick,
  // debited when admin marks a withdrawal PAID). Subtract PENDING/APPROVED
  // withdrawal requests so companions cannot double-request in-flight amounts.
  const [wallet, heldWithdrawals] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: companionId } }),
    prisma.withdrawalRequest.aggregate({
      where: { companionId, status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { amount: true },
    }),
  ]);

  const walletBalance = wallet?.balance ?? 0;
  const heldAmount = heldWithdrawals._sum.amount ?? 0;
  const availableBalance = Math.max(0, walletBalance - heldAmount);

  if (amount > availableBalance) {
    return NextResponse.json(
      { success: false, error: 'Amount exceeds available balance' },
      { status: 400 }
    );
  }

  const withdrawal = await prisma.withdrawalRequest.create({
    data: { companionId, amount, note, status: 'PENDING' },
  });

  return NextResponse.json({ success: true, data: { withdrawal } }, { status: 201 });
}
