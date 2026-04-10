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
  //
  // IMPORTANT: billing sessions must use `companionShare` (net, after the
  // 20% platform commission), NOT `totalCharged` (gross). Using totalCharged
  // would let companions withdraw the platform's cut too.
  //
  // This must match the calculation in /api/companion/earnings.
  const [chatAgg, callAgg, bookingAgg, heldWithdrawals] = await Promise.all([
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT' },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE' },
      _sum: { companionShare: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    // Deduct both PAID and non-terminal requests (PENDING + APPROVED) so
    // companions cannot double-withdraw while an admin is processing payout.
    // REJECTED is terminal and does NOT deduct.
    prisma.withdrawalRequest.aggregate({
      where: { companionId, status: { in: ['PENDING', 'APPROVED', 'PAID'] } },
      _sum: { amount: true },
    }),
  ]);

  const totalEarned =
    (chatAgg._sum.companionShare ?? 0) +
    (callAgg._sum.companionShare ?? 0) +
    (bookingAgg._sum.totalAmount ?? 0);
  const heldOrPaidOut = heldWithdrawals._sum.amount ?? 0;
  const availableBalance = totalEarned - heldOrPaidOut;

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
