import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createPaymentLink } from '@/lib/setu';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ₹100 (10 000 paise) minimum, ₹50 000 (5 000 000 paise) maximum
// Matches existing WALLET_MIN_RECHARGE / WALLET_MAX_RECHARGE limits.
const rechargeSchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number of paise')
    .min(10000, 'Minimum recharge is ₹100')
    .max(5000000, 'Maximum recharge is ₹50,000'),
});

// POST /api/wallet/recharge — create a Setu UPI payment link for wallet top-up
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

  const { amount } = parsed.data; // paise

  try {
    // Return an existing PENDING link if created in the last 30 minutes.
    // Prevents duplicate links from rapid retries.
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await prisma.setuPayment.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
        amount,
        createdAt: { gte: thirtyMinutesAgo },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          setuPaymentId: existing.setuPaymentId,
          upiLink: existing.upiLink,
          qrCode: existing.qrCode,
          shortUrl: existing.shortUrl,
          expiresAt: existing.expiresAt,
          reused: true,
        },
      });
    }

    // Create a new payment link via Setu Collect API
    const link = await createPaymentLink(user.id, amount);

    // Persist record so the webhook can look it up
    const setuPayment = await prisma.setuPayment.create({
      data: {
        userId: user.id,
        setuPaymentId: link.setuPaymentId,
        amount,
        upiLink: link.upiLink,
        qrCode: link.qrCode,
        shortUrl: link.shortUrl,
        expiresAt: new Date(link.expiresAt),
        metadata: { source: 'wallet_recharge' },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        setuPaymentId: setuPayment.setuPaymentId,
        upiLink: setuPayment.upiLink,
        qrCode: setuPayment.qrCode,
        shortUrl: setuPayment.shortUrl,
        expiresAt: setuPayment.expiresAt,
        reused: false,
      },
    });
  } catch (error) {
    console.error('Wallet recharge error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create recharge link' },
      { status: 500 }
    );
  }
}
