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

  // Compute available balance
  const [chatAgg, callAgg, bookingAgg, paidWithdrawals] = await Promise.all([
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT' },
      _sum: { totalCharged: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE' },
      _sum: { totalCharged: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { companionId, status: 'PAID' },
      _sum: { amount: true },
    }),
  ]);

  const totalEarned =
    (chatAgg._sum.totalCharged ?? 0) +
    (callAgg._sum.totalCharged ?? 0) +
    (bookingAgg._sum.totalAmount ?? 0);
  const paidOut = paidWithdrawals._sum.amount ?? 0;
  const availableBalance = totalEarned - paidOut;

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
