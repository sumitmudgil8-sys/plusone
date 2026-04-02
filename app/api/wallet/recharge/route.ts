import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createOrder, getKeyId } from '@/lib/payment';
import { prisma } from '@/lib/prisma';
import { WALLET_MIN_RECHARGE, WALLET_MAX_RECHARGE } from '@/lib/constants';

export const runtime = 'nodejs';

const rechargeSchema = z.object({
  amount: z
    .number()
    .min(WALLET_MIN_RECHARGE, `Minimum recharge is ₹${WALLET_MIN_RECHARGE}`)
    .max(WALLET_MAX_RECHARGE, `Maximum recharge is ₹${WALLET_MAX_RECHARGE}`),
});

// POST /api/wallet/recharge — create a Razorpay order for wallet top-up
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = rechargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  try {
    const receipt = `wallet_${Date.now()}`;
    const order = await createOrder(amount, receipt, {
      userId: user.id,
      type: 'WALLET_RECHARGE',
    });

    // Record a pending payment so verify can look it up
    await prisma.payment.create({
      data: {
        userId: user.id,
        type: 'WALLET_RECHARGE',
        amount,
        razorpayOrderId: order.id,
        metadata: JSON.stringify({ walletRecharge: true }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,  // in paise
        currency: order.currency,
        keyId: getKeyId(),
      },
    });
  } catch (error) {
    console.error('Wallet recharge order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create recharge order' },
      { status: 500 }
    );
  }
}
